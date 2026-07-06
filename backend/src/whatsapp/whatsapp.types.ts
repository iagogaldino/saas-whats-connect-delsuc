/**
 * Contratos HTTP estáveis (API v1) — não alterar sem atualizar frontend e ApiDocsPage.
 *
 * ## POST /api/v1/instances/:instanceId/whatsapp/pairing/start
 * - Auth: Bearer (JWT ou API key)
 * - 200: `{ ok: true, alreadyConnected: true }` — sessão já pronta
 * - 202: `{ ok: true, alreadyConnected: false }` — pareamento iniciado em background
 *
 * ## GET /api/v1/instances/:instanceId/whatsapp/status
 * - Auth: Bearer
 * - 200: `{ whatsappReady: boolean, pairingPending: boolean }`
 *
 * ## GET /api/v1/instances/:instanceId/whatsapp/qr
 * - Auth: Bearer
 * - 200: `{ qr: string | null }` — payload bruto para QR; null até o evento `qr` (Baileys)
 *
 * ## PUT /api/v1/instances/:instanceId/whatsapp/profile-photo
 * - Auth: Bearer JWT (sessão do painel)
 * - Content-Type: multipart/form-data (`photo`)
 * - 200: `{ ok: true }`
 *
 * ## GET /api/v1/instances/:instanceId/whatsapp/profile-photo
 * - Auth: Bearer JWT (sessão do painel)
 * - 200: `{ url: string | null }` — URL temporária WhatsApp da conta conectada
 *
 * ## GET /api/v1/instances/:instanceId/whatsapp/contacts
 * - Auth: Bearer (JWT ou API key)
 * - Query: `filter` opcional — `named` (omissão) só contactos com nome de agenda
 *   não vazio; `all` todos os contactos utilizador persistidos para a instância.
 * - 200: `{ items: WhatsAppContact[] }` — sincronizados pela sessão Baileys;
 *   `named` ordenado por nome ASC; `all` por nome e JID. Lista vazia até haver dados.
 *   Não inclui foto de perfil; use `GET …/contacts/:jid/profile-photo` por contacto.
 *
 * ## GET /api/v1/instances/:instanceId/whatsapp/contacts/:jid/profile-photo
 * - Auth: Bearer (JWT ou API key)
 * - `:jid` = telefone (ex. `5511999999999`) ou JID (`@s.whatsapp.net`, `@g.us`)
 * - 200: `{ url: string | null }` — URL temporária do WhatsApp; `null` se sem foto ou privacidade
 * - 400: JID inválido; 503: sessão não pronta
 *
 * ## GET /api/v1/instances/:instanceId/whatsapp/conversations/:jid/messages
 * - Auth: Bearer (JWT ou API key)
 * - Query:
 *   - `limit` opcional (1..100, omissão=20)
 *   - `beforeMessageId` opcional (cursor para paginação)
 * - 200: `{ items: WhatsAppConversationMessage[], nextCursor: string | null }`
 *
 * ## GET /api/v1/instances/:instanceId/whatsapp/messages/:messageId/media
 * - Auth: Bearer (JWT ou API key)
 * - `:messageId` = ObjectId MongoDB do registo persistido (não o id Baileys)
 * - 200: corpo binário (`Content-Type` / `Content-Disposition` conforme ficheiro gravado)
 * - 400/404: id inválido ou mídia inexistente
 *
 * ## Webhook / Socket — WhatsAppIncomingMessageEvent (mensagem recebida)
 * - Mesmo corpo no POST webhook e no evento `whatsapp.message.received`
 * - Campos base: messageId, from, to, timestamp, text, userId, instanceId
 * - `isGroup`, `chatJid`, `senderJid` — tipo de conversa e JIDs Baileys (grupo vs contacto)
 * - `reply` opcional — quando a mensagem é resposta a outra (`quotedMessageId`, etc.)
 * - `media` opcional: fileBuffer, mimeType, fileName, size (imagem, vídeo, documento, áudio/nota de voz)
 * - Notas de voz (`audioMessage`/`ptt`): `fileName` típico `voice-note.ogg`, `mimeType` frequentemente `audio/ogg; codecs=opus`
 * - Webhook serializa fileBuffer como `{ type: 'Buffer', data: number[] }`
 *
 * ## POST /api/v1/auth/instances/:instanceId/send-code
 * - Auth: Bearer
 * - Body: `{ phoneNumber, message }` ou `{ chatJid, message }` (mutuamente exclusivos)
 * - `replyTo` opcional — cita mensagem recebida no WhatsApp (ver `WhatsAppOutboundReplyQuote`)
 * - `phoneNumber`: 10..15 dígitos (DDI + número)
 * - `chatJid`: JID completo (`@s.whatsapp.net`, `@lid`, `@g.us`) — use quando `from` vier vazio no recebimento
 * - 200: `{ ok: true, message: 'Código enviado' }`
 * - Erros via AppError: 400 (destino inválido / sem WhatsApp), 503 (sessão não pronta / serviço indisponível)
 *
 * ## POST /api/v1/auth/instances/:instanceId/send-media
 * - Auth: Bearer
 * - Content-Type: multipart/form-data
 * - Form-data: `phoneNumber` (10..15 dígitos), `caption` opcional (até 200 chars), `file`
 * - 200: `{ ok: true, message: 'Arquivo enviado' }`
 * - Erros via AppError: 400 (validação/arquivo inválido), 503 (sessão não pronta / serviço indisponível)
 */

export type PairingStartResponse = {
  ok: true;
  alreadyConnected: boolean;
};

export type WhatsAppStatusBody = {
  whatsappReady: boolean;
  pairingPending: boolean;
};

export type WhatsAppQrBody = {
  qr: string | null;
};

export type WhatsAppProfilePhotoUpdateResponse = {
  ok: true;
};

export type WhatsAppProfilePhotoBody = {
  url: string | null;
};

export type WhatsAppListeningStatusBody = {
  enabled: boolean;
  connectedClients: number;
};

export type WhatsAppContact = {
  jid: string;
  name: string;
  phone: string;
  notify?: string;
};

export type WhatsAppContactsBody = {
  items: WhatsAppContact[];
};

export type WhatsAppIncomingMessageReply = {
  quotedMessageId: string;
  quotedParticipant: string | null;
  quotedText: string;
  quotedType: string;
};

/** Citação ao enviar resposta (campo `replyTo` em send-code / socket). */
export type WhatsAppOutboundReplyQuote = {
  /** `messageId` da mensagem recebida a citar. */
  messageId: string;
  /** `chatJid` da conversa onde a mensagem citada está. */
  chatJid: string;
  /** `senderJid` de quem enviou a citada; recomendado em grupos. */
  participant?: string | null;
  /** Texto/legenda da citada (melhora o preview no WhatsApp). */
  text?: string;
};

export type WhatsAppIncomingMessageEvent = {
  messageId: string;
  from: string;
  to: string | null;
  timestamp: string;
  text: string;
  userId: string;
  instanceId: string;
  isGroup: boolean;
  chatJid: string;
  senderJid: string;
  /** Nome/título do grupo (`groupMetadata.subject`) quando `isGroup` é true. */
  chatName?: string;
  reply?: WhatsAppIncomingMessageReply;
  media?: {
    fileBuffer?: Buffer;
    mimeType?: string;
    fileName?: string;
    size?: number;
  };
};

export type WhatsAppGroupMetadataBody = {
  jid: string;
  subject: string | null;
};

export type WhatsAppConversationMessage = {
  id: string;
  jid: string;
  fromMe: boolean;
  timestamp: string;
  text: string;
  type: string;
  isGroup?: boolean;
  chatJid?: string;
  senderJid?: string;
  reply?: WhatsAppIncomingMessageReply;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaFileName?: string;
  mediaSize?: number;
};

export type WhatsAppConversationMessagesBody = {
  items: WhatsAppConversationMessage[];
  nextCursor: string | null;
};

export type WhatsAppMediaSendInput = {
  phoneNumber: string;
  fileBuffer: Buffer;
  mimeType: string;
  fileName: string;
  caption?: string;
};

/** Métodos expostos ao Express (rotas auth + whatsapp). */
export interface IWhatsAppSessionService {
  startPairing(userId: string, instanceId: string): void;
  getQr(userId: string, instanceId: string): string | null;
  isReady(userId: string, instanceId: string): boolean;
  isPairingPending(userId: string, instanceId: string): boolean;
  updateProfilePhoto(
    userId: string,
    instanceId: string,
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<void>;
  getProfilePhotoUrl(userId: string, instanceId: string): Promise<string | null>;
  getContactProfilePhotoUrl(userId: string, instanceId: string, jid: string): Promise<string | null>;
  getGroupMetadata(userId: string, instanceId: string, jid: string): Promise<WhatsAppGroupMetadataBody>;
  /** Cota (plano grátis) e registo de sucesso em histórico aplicam-se aqui. */
  sendOtp(
    userId: string,
    instanceId: string,
    phoneNumber: string,
    code: string,
    replyTo?: WhatsAppOutboundReplyQuote
  ): Promise<void>;
  /** Envio por JID quando o telefone não está disponível (`@lid`, `@g.us`, etc.). */
  sendTextToJid(
    userId: string,
    instanceId: string,
    chatJid: string,
    text: string,
    replyTo?: WhatsAppOutboundReplyQuote
  ): Promise<void>;
  /** Envio de arquivo/documento para um número WhatsApp. */
  sendMedia(userId: string, instanceId: string, input: WhatsAppMediaSendInput): Promise<void>;
  destroySession(userId: string, instanceId: string): Promise<void>;
  /** Contactos da instância no Mongo; `filter` define se só com nome de agenda ou todos. */
  getSavedContacts(
    userId: string,
    instanceId: string,
    opts?: { filter?: 'named' | 'all' }
  ): Promise<WhatsAppContact[]>;
  listConversationMessages(
    userId: string,
    instanceId: string,
    jid: string,
    opts?: { limit?: number; beforeMessageId?: string }
  ): Promise<WhatsAppConversationMessagesBody>;
  getListeningStatus(userId: string, instanceId: string): Promise<WhatsAppListeningStatusBody>;
  setListeningEnabled(
    userId: string,
    instanceId: string,
    enabled: boolean
  ): Promise<WhatsAppListeningStatusBody>;
}

export type WhatsAppSessionServiceOptions = {
  baseDataPath: string;
};

/** Opções passadas pelo `server.ts` ao construir `WhatsAppSessionService`. */
export type WhatsAppSessionServiceBootstrapOptions = WhatsAppSessionServiceOptions & {
  connectTimeoutMs: number;
};
