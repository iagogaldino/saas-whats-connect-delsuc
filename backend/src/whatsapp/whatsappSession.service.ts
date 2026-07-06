import path from 'path';
import type { Logger } from 'pino';
import { AppError } from '../errors/AppError';
import type {
  WhatsAppConversationMessagesBody,
  IWhatsAppSessionService,
  WhatsAppContact,
  WhatsAppIncomingMessageEvent,
  WhatsAppMediaSendInput,
  WhatsAppSessionServiceBootstrapOptions,
} from './whatsapp.types';
import { SocketGateway } from '../realtime/socketGateway';
import { WebhookDispatcher } from '../realtime/webhookDispatcher';
import {
  disableWebhookDeliveryForInstance,
  getMessagePersistenceEnabled,
} from '../services/instance.service';
import { assertFreePlanCanSend } from '../services/billing.service';
import {
  formatSendError,
  listConversationForUser,
  recordIncomingMessage,
  recordSend,
} from '../services/sentMessage.service';
import {
  listSavedContactsForUser,
  upsertContacts,
} from '../services/whatsappContact.service';
import type { IWhatsAppSessionClient, WhatsAppProvider } from './whatsapp.provider';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Payload serializável para log (omite bytes de mídia). */
function incomingPayloadForLog(payload: WhatsAppIncomingMessageEvent): Record<string, unknown> {
  const media = payload.media;
  return {
    messageId: payload.messageId,
    from: payload.from,
    to: payload.to,
    timestamp: payload.timestamp,
    text: payload.text,
    userId: payload.userId,
    instanceId: payload.instanceId,
    isGroup: payload.isGroup,
    chatJid: payload.chatJid,
    senderJid: payload.senderJid,
    ...(payload.reply ? { reply: payload.reply } : {}),
    ...(media
      ? {
          media: {
            mimeType: media.mimeType,
            fileName: media.fileName,
            size: media.size,
            fileBuffer: media.fileBuffer
              ? `<Buffer ${media.fileBuffer.length} bytes>`
              : undefined,
          },
        }
      : {}),
  };
}

/**
 * Registo de sessões [Baileys](https://github.com/WhiskeySockets/Baileys) por utilizador do painel.
 */
export class WhatsAppSessionService implements IWhatsAppSessionService {
  private readonly sessions = new Map<string, IWhatsAppSessionClient>();
  private readonly initPromises = new Map<string, Promise<void>>();

  constructor(
    private readonly log: Logger,
    private readonly options: WhatsAppSessionServiceBootstrapOptions,
    private readonly provider: WhatsAppProvider,
    private readonly socketGateway: SocketGateway,
    private readonly webhookDispatcher: WebhookDispatcher
  ) {}

  private sessionKey(userId: string, instanceId: string): string {
    return `${userId}:${instanceId}`;
  }

  private createSession(userId: string, instanceId: string): IWhatsAppSessionClient {
    const dataPath = path.join(this.options.baseDataPath, userId, instanceId);
    return this.provider.createSessionClient(this.log.child({ userId, instanceId }), {
      userId,
      instanceId,
      dataPath,
      connectTimeoutMs: this.options.connectTimeoutMs,
      onIncomingMessage: (payload) => {
        this.log.info(
          { payload: incomingPayloadForLog(payload) },
          'WhatsApp: payload de mensagem recebida'
        );
        void this.shouldPersistMessages(userId, instanceId)
          .then((enabled) => {
            if (!enabled) return;
            return recordIncomingMessage(payload).catch((err) => {
              this.log.warn(
                { err: err instanceof Error ? err.message : String(err), userId, instanceId },
                'WhatsApp: falha ao gravar mensagem recebida'
              );
            });
          })
          .catch(() => {});
        this.socketGateway.emitIncomingMessage(userId, instanceId, payload);
        this.webhookDispatcher.deliver(userId, instanceId, payload);
      },
      onContactsChanged: (contacts) => {
        void upsertContacts(userId, instanceId, contacts).catch((err) => {
          this.log.warn(
            { err: err instanceof Error ? err.message : String(err), userId, instanceId },
            'WhatsApp: falha ao gravar contatos'
          );
        });
      },
    });
  }

  private isTransientInitError(err: unknown): boolean {
    const msg = errorMessage(err);
    return /econnreset|etimedout|socket|network|fetch|timeout|premature close|503|502/i.test(msg);
  }

  private async shouldPersistMessages(userId: string, instanceId: string): Promise<boolean> {
    try {
      return await getMessagePersistenceEnabled(userId, instanceId);
    } catch {
      return true;
    }
  }

  startPairing(userId: string, instanceId: string): void {
    const key = this.sessionKey(userId, instanceId);
    if (this.initPromises.has(key)) {
      return;
    }

    let session = this.sessions.get(key);
    if (!session) {
      session = this.createSession(userId, instanceId);
      this.sessions.set(key, session);
    }

    if (session.isReady()) {
      return;
    }

    const p = (async () => {
      let current = session!;
      const maxAttempts = 6;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await current.initialize();
          return;
        } catch (err: unknown) {
          const transient = this.isTransientInitError(err);
          const giveUp = !transient || attempt === maxAttempts;
          if (giveUp) {
            this.log.error(
              { err, userId, instanceId, attempt, message: errorMessage(err) },
              'WhatsApp: falha ao inicializar sessão'
            );
            this.sessions.delete(key);
            return;
          }
          this.log.warn(
            { userId, instanceId, attempt, message: errorMessage(err) },
            'WhatsApp: erro transitório na inicialização; nova tentativa'
          );
          await current.destroy().catch(() => {});
          await delay(7500);
          current = this.createSession(userId, instanceId);
          this.sessions.set(key, current);
        }
      }
    })().finally(() => {
      this.initPromises.delete(key);
    });

    this.initPromises.set(key, p);
  }

  getQr(userId: string, instanceId: string): string | null {
    return this.sessions.get(this.sessionKey(userId, instanceId))?.getLatestQr() ?? null;
  }

  isReady(userId: string, instanceId: string): boolean {
    return this.sessions.get(this.sessionKey(userId, instanceId))?.isReady() ?? false;
  }

  isPairingPending(userId: string, instanceId: string): boolean {
    const s = this.sessions.get(this.sessionKey(userId, instanceId));
    if (!s) return false;
    return !s.isReady();
  }

  async updateProfilePhoto(
    userId: string,
    instanceId: string,
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<void> {
    const session = this.sessions.get(this.sessionKey(userId, instanceId));
    if (!session) {
      throw new AppError(
        'WhatsApp não iniciado. Use o painel para conectar (Gerar QR) antes de alterar a foto.',
        503
      );
    }
    await session.updateProfilePhoto(imageBuffer, mimeType);
  }

  async getProfilePhotoUrl(userId: string, instanceId: string): Promise<string | null> {
    const session = this.sessions.get(this.sessionKey(userId, instanceId));
    if (!session) {
      throw new AppError(
        'WhatsApp não iniciado. Use o painel para conectar (Gerar QR) antes de consultar a foto.',
        503
      );
    }
    return session.getProfilePhotoUrl();
  }

  async getContactProfilePhotoUrl(
    userId: string,
    instanceId: string,
    jid: string
  ): Promise<string | null> {
    const session = this.sessions.get(this.sessionKey(userId, instanceId));
    if (!session) {
      throw new AppError(
        'WhatsApp não iniciado. Use o painel para conectar (Gerar QR) antes de consultar a foto.',
        503
      );
    }
    return session.getContactProfilePhotoUrl(jid);
  }

  async sendOtp(userId: string, instanceId: string, phoneNumber: string, code: string): Promise<void> {
    const session = this.sessions.get(this.sessionKey(userId, instanceId));
    if (!session) {
      throw new AppError(
        'WhatsApp não iniciado. Use o painel para conectar (Gerar QR) antes de enviar códigos.',
        503
      );
    }
    await assertFreePlanCanSend(userId);
    const persistEnabled = await this.shouldPersistMessages(userId, instanceId);
    try {
      await session.sendOtp(phoneNumber, code);
      if (persistEnabled) {
        await recordSend(userId, instanceId, phoneNumber, 'success', undefined, code).catch(() => {
          /* não re-lança; envio WhatsApp já concluiu */
        });
      }
    } catch (err) {
      if (persistEnabled) {
        await recordSend(userId, instanceId, phoneNumber, 'failed', formatSendError(err), code).catch(() => {
          /* não re-lança; erro principal mantém-se */
        });
      }
      throw err;
    }
  }

  async sendTextToJid(userId: string, instanceId: string, chatJid: string, text: string): Promise<void> {
    const session = this.sessions.get(this.sessionKey(userId, instanceId));
    if (!session) {
      throw new AppError(
        'WhatsApp não iniciado. Use o painel para conectar (Gerar QR) antes de enviar mensagens.',
        503
      );
    }
    await assertFreePlanCanSend(userId);
    const persistEnabled = await this.shouldPersistMessages(userId, instanceId);
    const historyKey = chatJid.split('@')[0] ?? chatJid;
    try {
      await session.sendTextToJid(chatJid, text);
      if (persistEnabled) {
        await recordSend(userId, instanceId, historyKey, 'success', undefined, text).catch(() => {
          /* não re-lança; envio WhatsApp já concluiu */
        });
      }
    } catch (err) {
      if (persistEnabled) {
        await recordSend(userId, instanceId, historyKey, 'failed', formatSendError(err), text).catch(() => {
          /* não re-lança; erro principal mantém-se */
        });
      }
      throw err;
    }
  }

  async sendMedia(userId: string, instanceId: string, input: WhatsAppMediaSendInput): Promise<void> {
    const session = this.sessions.get(this.sessionKey(userId, instanceId));
    if (!session) {
      throw new AppError(
        'WhatsApp não iniciado. Use o painel para conectar (Gerar QR) antes de enviar arquivos.',
        503
      );
    }
    await assertFreePlanCanSend(userId);
    const persistEnabled = await this.shouldPersistMessages(userId, instanceId);
    const historyMessage = input.caption?.trim() || `[arquivo] ${input.fileName}`;
    try {
      await session.sendMedia(input);
      if (persistEnabled) {
        await recordSend(userId, instanceId, input.phoneNumber, 'success', undefined, historyMessage, {
          type: 'media',
          media: {
            fileBuffer: input.fileBuffer,
            mimeType: input.mimeType,
            fileName: input.fileName,
          },
        }).catch(() => {
          /* não re-lança; envio WhatsApp já concluiu */
        });
      }
    } catch (err) {
      if (persistEnabled) {
        await recordSend(
          userId,
          instanceId,
          input.phoneNumber,
          'failed',
          formatSendError(err),
          historyMessage,
          { type: 'media' }
        ).catch(() => {
          /* não re-lança; erro principal mantém-se */
        });
      }
      throw err;
    }
  }

  async getSavedContacts(
    userId: string,
    instanceId: string,
    opts?: { filter?: 'named' | 'all' }
  ): Promise<WhatsAppContact[]> {
    return listSavedContactsForUser(userId, instanceId, opts);
  }

  async listConversationMessages(
    userId: string,
    instanceId: string,
    jid: string,
    opts?: { limit?: number; beforeMessageId?: string }
  ): Promise<WhatsAppConversationMessagesBody> {
    return listConversationForUser(userId, instanceId, jid, opts);
  }

  async destroySession(userId: string, instanceId: string): Promise<void> {
    const key = this.sessionKey(userId, instanceId);
    const session = this.sessions.get(key);
    if (!session) return;
    await session.destroy();
    this.sessions.delete(key);
    this.initPromises.delete(key);
  }

  getListeningStatus(
    userId: string,
    instanceId: string
  ): Promise<{ enabled: boolean; connectedClients: number }> {
    return this.socketGateway.getListeningStatus(userId, instanceId);
  }

  async setListeningEnabled(
    userId: string,
    instanceId: string,
    enabled: boolean
  ): Promise<{ enabled: boolean; connectedClients: number }> {
    if (enabled) {
      await disableWebhookDeliveryForInstance(userId, instanceId);
    }
    return this.socketGateway.setListeningEnabled(userId, instanceId, enabled);
  }
}
