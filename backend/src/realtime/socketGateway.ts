import type { Server as HttpServer } from 'http';
import type { Logger } from 'pino';
import { Server, type Socket } from 'socket.io';
import { validateApiKey } from '../services/apiKey.service';
import { getOwnedInstanceOrThrow } from '../services/instance.service';
import { normalizeOutboundChatJid } from '../whatsapp/whatsappMessageMeta';
import type { WhatsAppIncomingMessageEvent, WhatsAppOutboundReplyQuote } from '../whatsapp';
import { parseOutboundReplyQuote } from '../validation/outboundReply.schema';

type ListeningState = {
  enabled: boolean;
  socketIds: Set<string>;
};

type MessageSendPayload = {
  phoneNumber?: string;
  chatJid?: string;
  text: string;
  replyTo?: WhatsAppOutboundReplyQuote;
};

type MessageSendAck =
  | { ok: true; message: string }
  | { ok: false; error: string; status?: number };

type SendMessageInput = {
  phoneNumber?: string;
  chatJid?: string;
  text: string;
  replyTo?: WhatsAppOutboundReplyQuote;
};

type SendMessageHandler = (
  userId: string,
  instanceId: string,
  input: SendMessageInput
) => Promise<void>;
type LoadListeningStateHandler = (userId: string, instanceId: string) => Promise<boolean>;
type PersistListeningStateHandler = (userId: string, instanceId: string, enabled: boolean) => Promise<void>;

function stateKey(userId: string, instanceId: string): string {
  return `${userId}:${instanceId}`;
}

function userRoom(userId: string, instanceId: string): string {
  return `user:${userId}:instance:${instanceId}`;
}

function socketAuthToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.apiKey;
  if (typeof authToken === 'string' && authToken.trim()) return authToken.trim();

  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) return token;
  }

  const xApiKey = socket.handshake.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey.trim()) return xApiKey.trim();

  return null;
}

function socketInstanceId(socket: Socket): string | null {
  const authValue = socket.handshake.auth?.instanceId;
  if (typeof authValue === 'string' && authValue.trim()) return authValue.trim();
  const queryValue = socket.handshake.query.instanceId;
  if (typeof queryValue === 'string' && queryValue.trim()) return queryValue.trim();
  return null;
}

export class SocketGateway {
  private io: Server | null = null;
  private readonly states = new Map<string, ListeningState>();
  private log: Logger | null = null;
  private sendMessageHandler: SendMessageHandler | null = null;
  private loadListeningStateHandler: LoadListeningStateHandler | null = null;
  private persistListeningStateHandler: PersistListeningStateHandler | null = null;

  attach(server: HttpServer, log: Logger): void {
    this.log = log;
    this.io = new Server(server, {
      cors: { origin: true, credentials: true },
      path: '/socket.io',
    });

    this.io.use(async (socket, next) => {
      try {
        const token = socketAuthToken(socket);
        if (!token) {
          next(new Error('api_key_missing'));
          return;
        }

        const user = await validateApiKey(token);
        if (!user) {
          next(new Error('api_key_invalid'));
          return;
        }

        const instanceId = socketInstanceId(socket);
        if (!instanceId) {
          next(new Error('instance_id_missing'));
          return;
        }

        const instance = await getOwnedInstanceOrThrow(user.id, instanceId);

        const state = await this.ensureState(user.id, instance.id);
        if (!state.enabled) {
          next(new Error('listening_disabled'));
          return;
        }

        socket.data.userId = user.id;
        socket.data.instanceId = instance.id;
        socket.data.apiKeyId = user.apiKeyId;
        next();
      } catch {
        next(new Error('socket_auth_failed'));
      }
    });

    this.io.on('connection', (socket) => {
      const userId = socket.data.userId as string;
      const instanceId = socket.data.instanceId as string;
      const state = this.getOrCreateState(userId, instanceId);

      socket.join(userRoom(userId, instanceId));
      state.socketIds.add(socket.id);
      this.log?.info(
        { userId, instanceId, socketId: socket.id, connectedClients: state.socketIds.size },
        'Socket connected'
      );

      socket.on('disconnect', () => {
        state.socketIds.delete(socket.id);
        this.log?.info(
          { userId, instanceId, socketId: socket.id, connectedClients: state.socketIds.size },
          'Socket disconnected'
        );
      });

      socket.on(
        'whatsapp.message.send',
        async (payload: MessageSendPayload, ack?: (response: MessageSendAck) => void) => {
          const done = typeof ack === 'function' ? ack : () => {};
          try {
            if (!this.sendMessageHandler) {
              done({ ok: false, error: 'message_send_not_available', status: 503 });
              return;
            }
            const parsed = this.parseSendPayload(payload);
            if (!parsed.ok) {
              done({ ok: false, error: parsed.error, status: 400 });
              return;
            }

            await this.sendMessageHandler(userId, instanceId, parsed.input);
            done({ ok: true, message: 'Mensagem enviada' });
          } catch (err) {
            const e = err as Error & { status?: number };
            done({ ok: false, error: e.message ?? 'send_failed', status: e.status });
          }
        }
      );
    });
  }

  setSendMessageHandler(handler: SendMessageHandler): void {
    this.sendMessageHandler = handler;
  }

  setListeningPersistenceHandlers(
    loadHandler: LoadListeningStateHandler,
    persistHandler: PersistListeningStateHandler
  ): void {
    this.loadListeningStateHandler = loadHandler;
    this.persistListeningStateHandler = persistHandler;
  }

  async getListeningStatus(userId: string, instanceId: string): Promise<{ enabled: boolean; connectedClients: number }> {
    const state = await this.ensureState(userId, instanceId);
    return {
      enabled: state.enabled,
      connectedClients: state.socketIds.size,
    };
  }

  async setListeningEnabled(
    userId: string,
    instanceId: string,
    enabled: boolean
  ): Promise<{ enabled: boolean; connectedClients: number }> {
    const state = await this.ensureState(userId, instanceId);

    if (this.persistListeningStateHandler) {
      await this.persistListeningStateHandler(userId, instanceId, enabled);
    }

    // Confirma no storage persistido qual foi o estado final efetivo antes de responder.
    if (this.loadListeningStateHandler) {
      state.enabled = await this.loadListeningStateHandler(userId, instanceId);
    } else {
      state.enabled = enabled;
    }

    if (!state.enabled) {
      for (const socketId of state.socketIds) {
        this.io?.sockets.sockets.get(socketId)?.disconnect(true);
      }
      state.socketIds.clear();
    }

    return {
      enabled: state.enabled,
      connectedClients: state.socketIds.size,
    };
  }

  emitIncomingMessage(userId: string, instanceId: string, payload: WhatsAppIncomingMessageEvent): void {
    const state = this.states.get(stateKey(userId, instanceId));
    if (!state?.enabled) return;
    this.io?.to(userRoom(userId, instanceId)).emit('whatsapp.message.received', payload);
  }

  private getOrCreateState(userId: string, instanceId: string): ListeningState {
    const key = stateKey(userId, instanceId);
    let state = this.states.get(key);
    if (!state) {
      state = { enabled: false, socketIds: new Set<string>() };
      this.states.set(key, state);
    }
    return state;
  }

  private async ensureState(userId: string, instanceId: string): Promise<ListeningState> {
    const key = stateKey(userId, instanceId);
    const existing = this.states.get(key);
    if (existing) return existing;
    const state = this.getOrCreateState(userId, instanceId);
    if (this.loadListeningStateHandler) {
      state.enabled = await this.loadListeningStateHandler(userId, instanceId);
    }
    return state;
  }

  private parseSendPayload(payload: unknown):
    | { ok: true; input: SendMessageInput }
    | { ok: false; error: string } {
    if (!payload || typeof payload !== 'object') {
      return { ok: false, error: 'invalid_payload' };
    }
    const p = payload as Partial<MessageSendPayload> & { replyTo?: unknown };
    const text = (p.text ?? '').trim();
    const phoneNumber = (p.phoneNumber ?? '').replace(/\D/g, '');
    const chatJidRaw = (p.chatJid ?? '').trim();
    const hasPhone = phoneNumber.length >= 10 && phoneNumber.length <= 15;
    const normalizedJid = chatJidRaw ? normalizeOutboundChatJid(chatJidRaw) : null;
    const hasJid = Boolean(normalizedJid);

    let replyTo: WhatsAppOutboundReplyQuote | undefined;
    if (p.replyTo !== undefined && p.replyTo !== null) {
      const parsedReply = parseOutboundReplyQuote(p.replyTo);
      if (!parsedReply.ok) {
        return { ok: false, error: 'invalid_reply_to' };
      }
      replyTo = parsedReply.replyTo;
    }

    if (!hasPhone && !hasJid) {
      return { ok: false, error: 'invalid_destination' };
    }
    if (hasPhone && hasJid) {
      return { ok: false, error: 'ambiguous_destination' };
    }
    if (text.length < 1 || text.length > 200) {
      return { ok: false, error: 'invalid_text' };
    }

    if (hasJid) {
      return { ok: true, input: { chatJid: normalizedJid!, text, replyTo } };
    }
    return { ok: true, input: { phoneNumber, text, replyTo } };
  }
}
