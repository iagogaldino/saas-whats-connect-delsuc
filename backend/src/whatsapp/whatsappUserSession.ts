import qrcode from 'qrcode-terminal';
import { rm } from 'fs/promises';
import { Readable } from 'stream';
import type { Logger } from 'pino';
import makeWASocket, {
  downloadMediaMessage,
  DisconnectReason,
  fetchLatestBaileysVersion,
  proto,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { AppError } from '../errors/AppError';
import type {
  WhatsAppConversationMessagesBody,
  WhatsAppIncomingMessageEvent,
  WhatsAppMediaSendInput,
} from './whatsapp.types';
import type { IWhatsAppSessionClient } from './whatsapp.provider';

export type WhatsAppContactChangePartial = {
  jid: string;
  name?: string;
  notify?: string;
  pushName?: string;
};

export type WhatsAppUserSessionOptions = {
  userId: string;
  instanceId: string;
  /** Pasta onde o Baileys grava o estado (`useMultiFileAuthState`). */
  dataPath: string;
  /** Timeout de ligação WebSocket (ms), alinhado a `WWEBJS_AUTH_TIMEOUT_MS`. */
  connectTimeoutMs: number;
  /** Callback para encaminhar mensagens recebidas ao canal realtime do utilizador. */
  onIncomingMessage?: (payload: WhatsAppIncomingMessageEvent) => void;
  /** Callback para persistir alterações de contatos vindas dos eventos do Baileys. */
  onContactsChanged?: (contacts: WhatsAppContactChangePartial[]) => void;
};

function maskCode(code: string): string {
  const t = code.trim();
  if (t.length <= 2) return '**';
  if (t.length <= 8) return `••••${t.slice(-2)}`;
  return `••${t.slice(0, 2)}…${t.slice(-2)}(${t.length})`;
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

function buildOtpMessage(code: string): string {
  return code;
}

function toMainUserJid(fullJid: string | undefined): string | null {
  if (!fullJid) return null;
  const atIdx = fullJid.indexOf('@');
  if (atIdx <= 0) return null;
  const userPart = fullJid.slice(0, atIdx);
  const user = userPart.split(':')[0];
  if (!user) return null;
  return `${user}@s.whatsapp.net`;
}

/**
 * Uma sessão [Baileys](https://github.com/WhiskeySockets/Baileys) por utilizador do painel (sem Puppeteer).
 */
export class WhatsAppUserSession implements IWhatsAppSessionClient {
  private sock: WASocket | null = null;
  private saveCreds: (() => Promise<void>) | null = null;
  private ready = false;
  private latestQr: string | null = null;
  private initPromise: Promise<void> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnecting = false;
  private recoveringFromLogout = false;
  /** Evita reconexão automática e limpeza agressiva quando o utilizador pede desconexão no painel. */
  private intentionalClose = false;

  constructor(
    private readonly log: Logger,
    private readonly options: WhatsAppUserSessionOptions
  ) {}

  isReady(): boolean {
    return this.ready;
  }

  getLatestQr(): string | null {
    return this.latestQr;
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = (async () => {
      this.log.info('WhatsApp: inicializando cliente (Baileys)');
      const { state, saveCreds } = await useMultiFileAuthState(this.options.dataPath);
      this.saveCreds = saveCreds;

      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307] as [number, number, number],
        isLatest: false,
      }));

      const sock = makeWASocket({
        version,
        auth: state,
        logger: this.log as Parameters<typeof makeWASocket>[0]['logger'],
        connectTimeoutMs: this.options.connectTimeoutMs,
        defaultQueryTimeoutMs: undefined,
        markOnlineOnConnect: false,
      });

      this.sock = sock;

      sock.ev.on('creds.update', saveCreds);

      const emitContacts = (
        list: ReadonlyArray<{ id?: string; name?: string; notify?: string; verifiedName?: string }>
      ): void => {
        if (!this.options.onContactsChanged) return;
        const partials: WhatsAppContactChangePartial[] = [];
        for (const c of list) {
          if (!c?.id) continue;
          const partial: WhatsAppContactChangePartial = { jid: c.id };
          if (typeof c.name === 'string') partial.name = c.name;
          if (typeof c.notify === 'string') {
            partial.notify = c.notify;
            partial.pushName = c.notify;
          }
          partials.push(partial);
        }
        if (partials.length === 0) return;
        try {
          this.options.onContactsChanged(partials);
        } catch (err) {
          this.log.warn(
            { err: err instanceof Error ? err.message : String(err) },
            'WhatsApp: erro ao processar alteração de contatos'
          );
        }
      };

      sock.ev.on('messaging-history.set', (history) => {
        const contacts = (history as { contacts?: unknown }).contacts;
        if (Array.isArray(contacts) && contacts.length > 0) {
          emitContacts(contacts as Parameters<typeof emitContacts>[0]);
        }
      });
      sock.ev.on('contacts.upsert', (list) => {
        emitContacts(list as Parameters<typeof emitContacts>[0]);
      });
      sock.ev.on('contacts.update', (list) => {
        emitContacts(list as Parameters<typeof emitContacts>[0]);
      });

      sock.ev.on('messages.upsert', async (update) => {
        if (update.type !== 'notify') return;
        for (const msg of update.messages) {
          if (msg.key.fromMe) continue;
          const remoteJid = msg.key.remoteJid ?? '';
          if (!remoteJid || remoteJid.endsWith('@broadcast')) continue;

          const media = await this.extractIncomingMedia(msg);
          const payload: WhatsAppIncomingMessageEvent = {
            messageId: msg.key.id ?? `msg_${Date.now()}`,
            from: remoteJid,
            to: msg.pushName ?? null,
            timestamp: new Date(
              (Number(msg.messageTimestamp ?? Math.floor(Date.now() / 1000)) || Math.floor(Date.now() / 1000)) *
                1000
            ).toISOString(),
            text: this.extractIncomingText(msg.message),
            userId: this.options.userId,
            instanceId: this.options.instanceId,
            media,
          };

          this.options.onIncomingMessage?.(payload);
        }
      });

      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.latestQr = qr;
          this.log.info('WhatsApp: QR code recebido — escaneie com o aplicativo');
          qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
          this.ready = true;
          this.latestQr = null;
          this.log.info('WhatsApp: cliente pronto (Baileys)');
        }

        if (connection === 'close') {
          this.ready = false;
          this.latestQr = null;
          if (this.intentionalClose) {
            this.log.info('WhatsApp: ligação encerrada (desconexão manual)');
            return;
          }
          const boom = lastDisconnect?.error as Boom | undefined;
          const code = boom?.output?.statusCode;
          this.log.warn(
            { code, message: boom?.message },
            'WhatsApp: ligação encerrada'
          );
          if (code === DisconnectReason.loggedOut) {
            void this.resetInvalidSessionAndReinitialize();
            return;
          }
          this.scheduleReconnect();
        }
      });
    })();

    try {
      await this.initPromise;
    } catch (err) {
      this.initPromise = null;
      throw err;
    }
  }

  async destroy(): Promise<void> {
    this.intentionalClose = true;
    this.initPromise = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnecting = false;
    this.recoveringFromLogout = false;
    this.ready = false;
    this.latestQr = null;
    const s = this.sock;
    this.sock = null;
    this.saveCreds = null;
    if (!s) {
      await rm(this.options.dataPath, { recursive: true, force: true }).catch(() => {});
      return;
    }
    try {
      await s.logout();
    } catch {
      /* ignore */
    }
    try {
      s.end(undefined);
    } catch {
      /* ignore */
    }
    try {
      s.ev.removeAllListeners('connection.update');
      s.ev.removeAllListeners('creds.update');
    } catch {
      /* ignore */
    }
    await rm(this.options.dataPath, { recursive: true, force: true }).catch(() => {});
  }

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    if (!this.ready || !this.sock) {
      throw new AppError(
        'Serviço WhatsApp indisponível. Aguarde a conexão ou escaneie o QR code no painel.',
        503
      );
    }

    this.log.info(
      { phoneNumber, codePreview: maskCode(code) },
      'WhatsApp: tentativa de envio de OTP'
    );

    const digits = digitsOnly(phoneNumber);
    if (digits.length < 8 || digits.length > 15) {
      throw new AppError('Número inválido ou sem WhatsApp.', 400);
    }

    const jid = `${digits}@s.whatsapp.net`;

    let registered;
    try {
      registered = await this.sock.onWhatsApp(jid);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error({ err: message }, 'WhatsApp: erro ao verificar número');
      throw new AppError(
        'Serviço WhatsApp indisponível. Tente novamente em instantes.',
        503
      );
    }

    const row = registered?.[0];
    if (!row || !row.exists) {
      this.log.warn({ phoneNumber }, 'WhatsApp: número não registrado no WhatsApp');
      throw new AppError('Número não possui WhatsApp.', 400);
    }

    const targetJid = row.jid;

    const text = buildOtpMessage(code);

    try {
      await this.sock.sendMessage(targetJid, { text });
      this.log.info(
        { phoneNumber, codePreview: maskCode(code) },
        'WhatsApp: OTP enviado com sucesso'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error({ err: message, phoneNumber }, 'WhatsApp: falha ao enviar mensagem');
      if (this.looksLikeInvalidNumberError(message)) {
        throw new AppError('Número inválido para envio no WhatsApp.', 400);
      }
      throw new AppError(
        'Serviço WhatsApp indisponível ao enviar a mensagem.',
        503
      );
    }
  }

  async sendMedia(input: WhatsAppMediaSendInput): Promise<void> {
    if (!this.ready || !this.sock) {
      throw new AppError(
        'Serviço WhatsApp indisponível. Aguarde a conexão ou escaneie o QR code no painel.',
        503
      );
    }

    const digits = digitsOnly(input.phoneNumber);
    if (digits.length < 8 || digits.length > 15) {
      throw new AppError('Número inválido ou sem WhatsApp.', 400);
    }
    if (!input.fileBuffer || input.fileBuffer.length <= 0) {
      throw new AppError('Arquivo inválido ou vazio.', 400);
    }

    const jid = `${digits}@s.whatsapp.net`;

    let registered;
    try {
      registered = await this.sock.onWhatsApp(jid);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error({ err: message }, 'WhatsApp: erro ao verificar número para envio de arquivo');
      throw new AppError(
        'Serviço WhatsApp indisponível. Tente novamente em instantes.',
        503
      );
    }

    const row = registered?.[0];
    if (!row || !row.exists) {
      this.log.warn({ phoneNumber: input.phoneNumber }, 'WhatsApp: número não registrado no WhatsApp');
      throw new AppError('Número não possui WhatsApp.', 400);
    }

    const targetJid = row.jid;
    const caption = input.caption?.trim() || undefined;

    try {
      await this.sock.sendMessage(targetJid, {
        document: input.fileBuffer,
        mimetype: input.mimeType,
        fileName: input.fileName,
        caption,
      });
      this.log.info(
        { phoneNumber: input.phoneNumber, fileName: input.fileName, mimeType: input.mimeType },
        'WhatsApp: arquivo enviado com sucesso'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error(
        { err: message, phoneNumber: input.phoneNumber, fileName: input.fileName },
        'WhatsApp: falha ao enviar arquivo'
      );
      if (this.looksLikeInvalidNumberError(message)) {
        throw new AppError('Número inválido para envio no WhatsApp.', 400);
      }
      throw new AppError(
        'Serviço WhatsApp indisponível ao enviar o arquivo.',
        503
      );
    }
  }

  async listConversationMessages(
    jid: string,
    opts?: { limit?: number; beforeMessageId?: string }
  ): Promise<WhatsAppConversationMessagesBody> {
    if (!this.ready || !this.sock) {
      throw new AppError(
        'Serviço WhatsApp indisponível. Aguarde a conexão ou escaneie o QR code no painel.',
        503
      );
    }

    const limit = Math.max(1, Math.min(opts?.limit ?? 20, 100));
    const cursor =
      opts?.beforeMessageId && opts.beforeMessageId.trim().length > 0
        ? ({ id: opts.beforeMessageId.trim(), remoteJid: jid, fromMe: false } as proto.IMessageKey)
        : undefined;

    const hasLoadMessages = typeof (this.sock as WASocket & { loadMessages?: unknown }).loadMessages === 'function';
    this.log.info(
      {
        jid,
        limit,
        beforeMessageId: opts?.beforeMessageId ?? null,
        hasLoadMessages,
      },
      'WhatsApp: iniciando listagem de mensagens da conversa'
    );

    let rows: proto.IWebMessageInfo[];
    try {
      const sockWithHistory = this.sock as WASocket & {
        loadMessages?: (
          remoteJid: string,
          count: number,
          cursor?: proto.IMessageKey
        ) => Promise<proto.IWebMessageInfo[]>;
      };
      if (!sockWithHistory.loadMessages) {
        throw new AppError(
          'Versão atual do Baileys não expõe carregamento de histórico de mensagens.',
          503
        );
      }
      rows = await sockWithHistory.loadMessages(jid, limit, cursor);
      this.log.info(
        { jid, limit, returnedCount: rows.length },
        'WhatsApp: listagem de mensagens da conversa concluída'
      );
    } catch (err) {
      if (err instanceof AppError) {
        this.log.warn(
          {
            jid,
            limit,
            beforeMessageId: opts?.beforeMessageId ?? null,
            message: err.message,
            statusCode: err.statusCode,
          },
          'WhatsApp: erro de aplicação ao listar mensagens da conversa'
        );
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.log.error(
        {
          err: message,
          stack: err instanceof Error ? err.stack : undefined,
          jid,
          limit,
          beforeMessageId: opts?.beforeMessageId ?? null,
          hasLoadMessages,
        },
        'WhatsApp: falha inesperada ao listar mensagens da conversa'
      );
      throw new AppError('Não foi possível listar mensagens da conversa no WhatsApp.', 503);
    }

    const items = rows.map((msg) => {
      const key = msg.key ?? {};
      const remoteJid = key.remoteJid ?? jid;
      return {
        id: key.id ?? `msg_${Date.now()}`,
        jid: remoteJid,
        fromMe: Boolean(key.fromMe),
        timestamp: this.toIsoTimestamp(msg.messageTimestamp),
        text: this.extractIncomingText(msg.message),
        type: this.getMessageType(msg.message),
      };
    });

    const last = rows.at(-1);
    const nextCursor = last?.key?.id ?? null;
    return { items, nextCursor };
  }

  async updateProfilePhoto(imageBuffer: Buffer, mimeType: string): Promise<void> {
    if (!this.ready || !this.sock) {
      throw new AppError(
        'Serviço WhatsApp indisponível. Aguarde a conexão ou escaneie o QR code no painel.',
        503
      );
    }
    const ownJid = toMainUserJid(this.sock.user?.id);
    if (!ownJid) {
      throw new AppError('Não foi possível identificar a conta WhatsApp conectada.', 503);
    }
    try {
      await this.sock.updateProfilePicture(ownJid, { stream: Readable.from(imageBuffer) });
      this.log.info({ ownJid, mimeType }, 'WhatsApp: foto de perfil atualizada');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error({ err: message }, 'WhatsApp: falha ao atualizar foto de perfil');
      throw new AppError('Não foi possível atualizar a foto de perfil do WhatsApp.', 503);
    }
  }

  async getProfilePhotoUrl(): Promise<string | null> {
    if (!this.ready || !this.sock) {
      throw new AppError(
        'Serviço WhatsApp indisponível. Aguarde a conexão ou escaneie o QR code no painel.',
        503
      );
    }
    const ownJid = toMainUserJid(this.sock.user?.id);
    if (!ownJid) {
      throw new AppError('Não foi possível identificar a conta WhatsApp conectada.', 503);
    }
    try {
      const url = await this.sock.profilePictureUrl(ownJid, 'image');
      return url ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Quando não existe foto definida, o Baileys pode responder com erro de recurso ausente.
      if (/404|not[\s-]?found|no profile picture/i.test(message)) {
        return null;
      }
      this.log.error({ err: message }, 'WhatsApp: falha ao consultar foto de perfil');
      throw new AppError('Não foi possível consultar a foto de perfil do WhatsApp.', 503);
    }
  }

  private looksLikeInvalidNumberError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      lower.includes('invalid wid') ||
      lower.includes('not registered') ||
      lower.includes('invalid number')
    );
  }

  private extractIncomingText(message: unknown): string {
    if (!message || typeof message !== 'object') return '';
    const m = message as Record<string, unknown>;

    const conversation = m.conversation;
    if (typeof conversation === 'string') return conversation;

    const ext = m.extendedTextMessage as { text?: unknown } | undefined;
    if (ext && typeof ext.text === 'string') return ext.text;

    const image = m.imageMessage as { caption?: unknown } | undefined;
    if (image && typeof image.caption === 'string') return image.caption;

    const video = m.videoMessage as { caption?: unknown } | undefined;
    if (video && typeof video.caption === 'string') return video.caption;

    return '';
  }

  private async extractIncomingMedia(
    msg: proto.IWebMessageInfo
  ): Promise<WhatsAppIncomingMessageEvent['media'] | undefined> {
    const message = msg.message;
    if (!message || typeof message !== 'object') return undefined;
    const m = message as Record<string, unknown>;
    const image = m.imageMessage as
      | { mimetype?: unknown; fileName?: unknown; fileLength?: unknown }
      | undefined;
    if (image) {
      const downloaded = await this.tryDownloadIncomingMedia(msg, 'image');
      return {
        fileBuffer: downloaded,
        mimeType: typeof image.mimetype === 'string' ? image.mimetype : undefined,
        fileName: typeof image.fileName === 'string' ? image.fileName : 'image.jpg',
        size: typeof image.fileLength === 'number' ? image.fileLength : undefined,
      };
    }
    const video = m.videoMessage as
      | { mimetype?: unknown; fileName?: unknown; fileLength?: unknown }
      | undefined;
    if (video) {
      const downloaded = await this.tryDownloadIncomingMedia(msg, 'video');
      return {
        fileBuffer: downloaded,
        mimeType: typeof video.mimetype === 'string' ? video.mimetype : undefined,
        fileName: typeof video.fileName === 'string' ? video.fileName : 'video.mp4',
        size: typeof video.fileLength === 'number' ? video.fileLength : undefined,
      };
    }
    const document = m.documentMessage as
      | { mimetype?: unknown; fileName?: unknown; fileLength?: unknown }
      | undefined;
    if (document) {
      const downloaded = await this.tryDownloadIncomingMedia(msg, 'document');
      return {
        fileBuffer: downloaded,
        mimeType: typeof document.mimetype === 'string' ? document.mimetype : undefined,
        fileName: typeof document.fileName === 'string' ? document.fileName : undefined,
        size: typeof document.fileLength === 'number' ? document.fileLength : undefined,
      };
    }
    return undefined;
  }

  private async tryDownloadIncomingMedia(
    msg: proto.IWebMessageInfo,
    mediaType: 'image' | 'video' | 'document'
  ): Promise<Buffer | undefined> {
    if (!this.sock) return undefined;
    try {
      const data = await downloadMediaMessage(msg, 'buffer', {}, {
        logger: this.log,
        reuploadRequest: this.sock.updateMediaMessage,
      });
      if (!data) return undefined;
      return Buffer.isBuffer(data) ? data : Buffer.from(data as Uint8Array);
    } catch (err) {
      this.log.warn(
        {
          err: err instanceof Error ? err.message : String(err),
          mediaType,
          messageId: msg.key?.id,
        },
        'WhatsApp: não foi possível baixar mídia recebida'
      );
      return undefined;
    }
  }

  private getMessageType(message: unknown): string {
    if (!message || typeof message !== 'object') return 'unknown';
    const m = message as Record<string, unknown>;
    const keys = Object.keys(m);
    if (keys.length === 0) return 'unknown';
    return String(keys[0]);
  }

  private toIsoTimestamp(raw: unknown): string {
    if (raw instanceof Date) return raw.toISOString();
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      return new Date(raw * 1000).toISOString();
    }
    if (typeof raw === 'string') {
      const num = Number(raw);
      if (Number.isFinite(num) && num > 0) {
        return new Date(num * 1000).toISOString();
      }
    }
    if (typeof raw === 'object' && raw && 'toString' in raw) {
      const num = Number((raw as { toString(): string }).toString());
      if (Number.isFinite(num) && num > 0) {
        return new Date(num * 1000).toISOString();
      }
    }
    return new Date().toISOString();
  }

  private scheduleReconnect(delayMs = 1_500): void {
    if (this.intentionalClose || this.reconnecting || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnecting = true;
      this.initPromise = null;
      this.initialize()
        .then(() => {
          this.log.info('WhatsApp: reconexão concluída');
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          this.log.error({ err: message }, 'WhatsApp: falha na reconexão, nova tentativa agendada');
          this.scheduleReconnect(3_000);
        })
        .finally(() => {
          this.reconnecting = false;
        });
    }, delayMs);
  }

  private async resetInvalidSessionAndReinitialize(): Promise<void> {
    if (this.intentionalClose || this.recoveringFromLogout) return;
    this.recoveringFromLogout = true;

    try {
      this.log.warn('WhatsApp: sessão inválida, limpando credenciais e reiniciando pareamento');
      this.sock = null;
      this.saveCreds = null;
      this.initPromise = null;
      await rm(this.options.dataPath, { recursive: true, force: true });
      this.scheduleReconnect(500);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error({ err: message }, 'WhatsApp: falha ao limpar sessão inválida');
      this.scheduleReconnect(3_000);
    } finally {
      this.recoveringFromLogout = false;
    }
  }
}
