import type { Logger } from 'pino';
import type {
  WhatsAppConversationMessagesBody,
  WhatsAppIncomingMessageEvent,
  WhatsAppMediaSendInput,
  WhatsAppOutboundReplyQuote,
} from './whatsapp.types';
import type { WhatsAppContactChangePartial } from './whatsappUserSession';

export type WhatsAppSessionClientOptions = {
  userId: string;
  instanceId: string;
  dataPath: string;
  connectTimeoutMs: number;
  onIncomingMessage?: (payload: WhatsAppIncomingMessageEvent) => void;
  onContactsChanged?: (contacts: WhatsAppContactChangePartial[]) => void;
};

export type WhatsAppProviderCapabilities = {
  supportsConversationHistory: boolean;
};

export interface IWhatsAppSessionClient {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  isReady(): boolean;
  getLatestQr(): string | null;
  sendOtp(phoneNumber: string, code: string, replyTo?: WhatsAppOutboundReplyQuote): Promise<void>;
  sendTextToJid(chatJid: string, text: string, replyTo?: WhatsAppOutboundReplyQuote): Promise<void>;
  sendMedia(input: WhatsAppMediaSendInput): Promise<void>;
  updateProfilePhoto(imageBuffer: Buffer, mimeType: string): Promise<void>;
  getProfilePhotoUrl(): Promise<string | null>;
  getContactProfilePhotoUrl(jid: string): Promise<string | null>;
  listConversationMessages(
    jid: string,
    opts?: { limit?: number; beforeMessageId?: string }
  ): Promise<WhatsAppConversationMessagesBody>;
}

export type WhatsAppSessionClientFactory = (
  log: Logger,
  options: WhatsAppSessionClientOptions
) => IWhatsAppSessionClient;

export type WhatsAppProvider = {
  name: string;
  capabilities: WhatsAppProviderCapabilities;
  createSessionClient: WhatsAppSessionClientFactory;
};

