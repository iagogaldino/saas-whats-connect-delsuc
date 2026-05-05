import type { Logger } from 'pino';
import type { WhatsAppProvider } from './whatsapp.provider';
import { createBaileysProvider } from './providers/baileys.provider';

export function createWhatsAppProvider(log: Logger): WhatsAppProvider {
  const providerName = (process.env.WHATSAPP_PROVIDER || 'baileys').trim().toLowerCase();
  switch (providerName) {
    case 'baileys':
      return createBaileysProvider();
    default:
      log.warn({ providerName }, 'WhatsApp provider inválido; fallback para baileys');
      return createBaileysProvider();
  }
}

