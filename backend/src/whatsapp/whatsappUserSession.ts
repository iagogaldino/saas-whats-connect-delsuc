import qrcode from 'qrcode-terminal';
import { rm } from 'fs/promises';
import type { Logger } from 'pino';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { AppError } from '../errors/AppError';
import type { WhatsAppIncomingMessageEvent } from './whatsapp.types';

export type WhatsAppUserSessionOptions = {
  userId: string;
  instanceId: string;
  /** Pasta onde o Baileys grava o estado (`useMultiFileAuthState`). */
  dataPath: string;
  /** Timeout de ligação WebSocket (ms), alinhado a `WWEBJS_AUTH_TIMEOUT_MS`. */
  connectTimeoutMs: number;
  /** Callback para encaminhar mensagens recebidas ao canal realtime do utilizador. */
  onIncomingMessage?: (payload: WhatsAppIncomingMessageEvent) => void;
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

/**
 * Uma sessão [Baileys](https://github.com/WhiskeySockets/Baileys) por utilizador do painel (sem Puppeteer).
 */
export class WhatsAppUserSession {
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
      sock.ev.on('messages.upsert', (update) => {
        if (update.type !== 'notify') return;
        for (const msg of update.messages) {
          if (msg.key.fromMe) continue;
          const remoteJid = msg.key.remoteJid ?? '';
          if (!remoteJid || remoteJid.endsWith('@broadcast')) continue;

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
