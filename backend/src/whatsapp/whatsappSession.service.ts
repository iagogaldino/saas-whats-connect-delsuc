import path from 'path';
import type { Logger } from 'pino';
import { AppError } from '../errors/AppError';
import type {
  IWhatsAppSessionService,
  WhatsAppSessionServiceBootstrapOptions,
} from './whatsapp.types';
import { WhatsAppUserSession } from './whatsappUserSession';
import { SocketGateway } from '../realtime/socketGateway';
import { WebhookDispatcher } from '../realtime/webhookDispatcher';
import { disableWebhookDeliveryForInstance } from '../services/instance.service';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Registo de sessões [Baileys](https://github.com/WhiskeySockets/Baileys) por utilizador do painel.
 */
export class WhatsAppSessionService implements IWhatsAppSessionService {
  private readonly sessions = new Map<string, WhatsAppUserSession>();
  private readonly initPromises = new Map<string, Promise<void>>();

  constructor(
    private readonly log: Logger,
    private readonly options: WhatsAppSessionServiceBootstrapOptions,
    private readonly socketGateway: SocketGateway,
    private readonly webhookDispatcher: WebhookDispatcher
  ) {}

  private sessionKey(userId: string, instanceId: string): string {
    return `${userId}:${instanceId}`;
  }

  private createSession(userId: string, instanceId: string): WhatsAppUserSession {
    const dataPath = path.join(this.options.baseDataPath, userId, instanceId);
    return new WhatsAppUserSession(this.log.child({ userId, instanceId }), {
      userId,
      instanceId,
      dataPath,
      connectTimeoutMs: this.options.connectTimeoutMs,
      onIncomingMessage: (payload) => {
        this.socketGateway.emitIncomingMessage(userId, instanceId, payload);
        this.webhookDispatcher.deliver(userId, instanceId, payload);
      },
    });
  }

  private isTransientInitError(err: unknown): boolean {
    const msg = errorMessage(err);
    return /econnreset|etimedout|socket|network|fetch|timeout|premature close|503|502/i.test(msg);
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

  async sendOtp(userId: string, instanceId: string, phoneNumber: string, code: string): Promise<void> {
    const session = this.sessions.get(this.sessionKey(userId, instanceId));
    if (!session) {
      throw new AppError(
        'WhatsApp não iniciado. Use o painel para conectar (Gerar QR) antes de enviar códigos.',
        503
      );
    }
    return session.sendOtp(phoneNumber, code);
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
