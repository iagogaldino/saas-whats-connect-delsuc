import type { proto } from '@whiskeysockets/baileys';
import type { WhatsAppIncomingMessageReply } from './whatsapp.types';

type MessageKeyWithPn = proto.IMessageKey & { participantPn?: string };

export function isGroupChatJid(jid: string | undefined | null): boolean {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function extractPhoneFromJid(rawJid: string): string | null {
  const trimmed = rawJid.trim();
  if (!trimmed.includes('@')) return null;
  const [userPartRaw, domainRaw] = trimmed.split('@');
  const userPart = (userPartRaw ?? '').split(':')[0] ?? '';
  const domain = (domainRaw ?? '').toLowerCase();
  if (domain !== 's.whatsapp.net' && domain !== 'c.us') {
    return null;
  }
  const digits = digitsOnly(userPart);
  if (digits.length < 8 || digits.length > 20) {
    return null;
  }
  return digits;
}

export function normalizeSenderPhone(rawJid: string): string {
  const phone = extractPhoneFromJid(rawJid);
  return phone ?? '';
}

export function resolveIncomingRouting(msg: proto.IWebMessageInfo): {
  chatJid: string;
  senderJid: string;
  isGroup: boolean;
  from: string;
} {
  const remoteJid = msg.key?.remoteJid ?? '';
  const isGroup = isGroupChatJid(remoteJid);
  const key = msg.key as MessageKeyWithPn | undefined;

  const senderJid = isGroup ? (key?.participantPn ?? key?.participant ?? '') : remoteJid;
  const from =
    normalizeSenderPhone(key?.participantPn ?? senderJid) || normalizeSenderPhone(senderJid);

  return { chatJid: remoteJid, senderJid, isGroup, from };
}

function getContextInfo(message: proto.IMessage | null | undefined) {
  if (!message) return undefined;
  return (
    message.extendedTextMessage?.contextInfo ??
    message.imageMessage?.contextInfo ??
    message.videoMessage?.contextInfo ??
    message.audioMessage?.contextInfo ??
    message.documentMessage?.contextInfo ??
    message.stickerMessage?.contextInfo
  );
}

export function extractTextFromProtoMessage(message: proto.IMessage | null | undefined): string {
  if (!message) return '';
  if (typeof message.conversation === 'string') return message.conversation;
  if (typeof message.extendedTextMessage?.text === 'string') return message.extendedTextMessage.text;
  if (typeof message.imageMessage?.caption === 'string') return message.imageMessage.caption;
  if (typeof message.videoMessage?.caption === 'string') return message.videoMessage.caption;
  if (typeof message.documentMessage?.caption === 'string') return message.documentMessage.caption;
  return '';
}

export function getProtoMessageType(message: proto.IMessage | null | undefined): string {
  if (!message) return 'unknown';
  const keys = Object.keys(message).filter((k) => k !== 'messageContextInfo');
  if (keys.length === 0) return 'unknown';
  return keys[0] ?? 'unknown';
}

export function extractReplyFromMessage(
  message: proto.IMessage | null | undefined
): WhatsAppIncomingMessageReply | undefined {
  const ctx = getContextInfo(message);
  if (!ctx?.stanzaId) return undefined;
  const quoted = ctx.quotedMessage;
  return {
    quotedMessageId: ctx.stanzaId,
    quotedParticipant: ctx.participant ?? null,
    quotedText: extractTextFromProtoMessage(quoted ?? undefined),
    quotedType: getProtoMessageType(quoted ?? undefined),
  };
}
