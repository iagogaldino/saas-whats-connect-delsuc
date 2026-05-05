import type { Logger } from 'pino';
import { WhatsAppUserSession } from '../whatsappUserSession';
import type { WhatsAppProvider, WhatsAppSessionClientOptions } from '../whatsapp.provider';

function createBaileysSessionClient(log: Logger, options: WhatsAppSessionClientOptions): WhatsAppUserSession {
  return new WhatsAppUserSession(log, options);
}

export function createBaileysProvider(): WhatsAppProvider {
  return {
    name: 'baileys',
    capabilities: {
      supportsConversationHistory: true,
    },
    createSessionClient: createBaileysSessionClient,
  };
}

