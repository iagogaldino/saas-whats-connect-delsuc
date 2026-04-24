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
 * ## POST /api/v1/auth/instances/:instanceId/send-code
 * - Auth: Bearer
 * - Body: `{ phoneNumber, message }` (validação zod existente)
 * - 200: `{ ok: true, message: 'Código enviado' }`
 * - Erros via AppError: 400 (número inválido / sem WhatsApp), 503 (sessão não pronta / serviço indisponível)
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

export type WhatsAppListeningStatusBody = {
  enabled: boolean;
  connectedClients: number;
};

export type WhatsAppIncomingMessageEvent = {
  messageId: string;
  from: string;
  to: string | null;
  timestamp: string;
  text: string;
  userId: string;
  instanceId: string;
};

/** Métodos expostos ao Express (rotas auth + whatsapp). */
export interface IWhatsAppSessionService {
  startPairing(userId: string, instanceId: string): void;
  getQr(userId: string, instanceId: string): string | null;
  isReady(userId: string, instanceId: string): boolean;
  isPairingPending(userId: string, instanceId: string): boolean;
  /** Cota (plano grátis) e registo de sucesso em histórico aplicam-se aqui. */
  sendOtp(userId: string, instanceId: string, phoneNumber: string, code: string): Promise<void>;
  destroySession(userId: string, instanceId: string): Promise<void>;
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
