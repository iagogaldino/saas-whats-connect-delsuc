import mongoose from 'mongoose';
import crypto from 'crypto';
import { mkdir, readFile, rm, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { AppError } from '../errors/AppError';
import { SentMessage } from '../models/SentMessage';
import type {
  WhatsAppConversationMessage,
  WhatsAppConversationMessagesBody,
  WhatsAppIncomingMessageEvent,
} from '../whatsapp/whatsapp.types';

const MAX_ERROR_LEN = 500;
const MAX_MESSAGE_LEN = 500;
const DEFAULT_MEDIA_DIR = './.message_media';

export type SentMessageListItem = {
  id: string;
  phoneNumber: string;
  status: 'success' | 'failed';
  errorMessage: string | null;
  message: string | null;
  createdAt: string;
};

export type ListMessagesResult = {
  items: SentMessageListItem[];
  total: number;
  page: number;
  limit: number;
};

export type MessageMediaResult = {
  fileBuffer: Buffer;
  mimeType: string;
  fileName: string;
};

export type DeleteMessagesResult = {
  deletedMessages: number;
  deletedMediaFiles: number;
  mediaDeleteErrors: number;
};

export function formatSendError(err: unknown): string {
  if (err instanceof AppError) return err.message.slice(0, MAX_ERROR_LEN);
  if (err instanceof Error) return err.message.slice(0, MAX_ERROR_LEN);
  return String(err).slice(0, MAX_ERROR_LEN);
}

function normalizePhone(phoneOrJid: string): string {
  const left = phoneOrJid.split('@')[0] || phoneOrJid;
  return left.replace(/\D/g, '');
}

function normalizeJid(phoneOrJid: string): string {
  if (phoneOrJid.includes('@')) {
    return phoneOrJid.replace('@c.us', '@s.whatsapp.net');
  }
  const phone = normalizePhone(phoneOrJid);
  return `${phone}@s.whatsapp.net`;
}

function resolveMediaDirAbsolute(): string {
  const configured = (process.env.MESSAGE_MEDIA_DIR || DEFAULT_MEDIA_DIR).trim();
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

function resolveScopedMediaAbsolutePath(
  relativeMediaPath: string,
  userId: string,
  instanceId: string
): string | null {
  const baseDir = resolveMediaDirAbsolute();
  const scopedRoot = path.resolve(baseDir, userId, instanceId);
  const candidate = path.resolve(baseDir, relativeMediaPath);
  if (candidate === scopedRoot || candidate.startsWith(`${scopedRoot}${path.sep}`)) {
    return candidate;
  }
  return null;
}

async function deleteMediaPathsForScope(
  mediaPaths: string[],
  userId: string,
  instanceId: string
): Promise<{ deletedMediaFiles: number; mediaDeleteErrors: number }> {
  let deletedMediaFiles = 0;
  let mediaDeleteErrors = 0;
  const uniquePaths = [...new Set(mediaPaths.filter((item) => item && item.trim().length > 0))];

  for (const relativePath of uniquePaths) {
    const safeAbsolutePath = resolveScopedMediaAbsolutePath(relativePath, userId, instanceId);
    if (!safeAbsolutePath) {
      mediaDeleteErrors += 1;
      continue;
    }
    try {
      await unlink(safeAbsolutePath);
      deletedMediaFiles += 1;
    } catch {
      mediaDeleteErrors += 1;
    }
  }

  return { deletedMediaFiles, mediaDeleteErrors };
}

async function saveMediaFile(input: {
  userId: string;
  instanceId: string;
  buffer: Buffer;
  fileName: string;
}): Promise<{ mediaPath: string; mediaFileName: string; mediaSize: number }> {
  const safeFileName = input.fileName.replace(/[^\w.\-]/g, '_') || 'media.bin';
  const mediaId = crypto.randomUUID();
  const relativePath = path.join(input.userId, input.instanceId, `${mediaId}_${safeFileName}`);
  const absPath = path.join(resolveMediaDirAbsolute(), relativePath);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, input.buffer);
  return {
    mediaPath: relativePath.replace(/\\/g, '/'),
    mediaFileName: safeFileName,
    mediaSize: input.buffer.length,
  };
}

export async function recordSend(
  userId: string,
  instanceId: string,
  phoneNumber: string,
  status: 'success' | 'failed',
  errorMessage?: string,
  message?: string,
  opts?: {
    messageId?: string;
    type?: 'text' | 'media';
    messageTimestamp?: Date;
    media?: {
      fileBuffer: Buffer;
      mimeType: string;
      fileName: string;
    };
  }
): Promise<void> {
  const payload: {
    userId: mongoose.Types.ObjectId;
    instanceId: mongoose.Types.ObjectId;
    phoneNumber: string;
    status: 'success' | 'failed';
    errorMessage?: string;
    message?: string;
    direction: 'outbound';
    fromMe: true;
    type: string;
    jid: string;
    messageTimestamp: Date;
    messageId?: string;
    mediaPath?: string;
    mediaMimeType?: string;
    mediaFileName?: string;
    mediaSize?: number;
  } = {
    userId: new mongoose.Types.ObjectId(userId),
    instanceId: new mongoose.Types.ObjectId(instanceId),
    phoneNumber: normalizePhone(phoneNumber),
    jid: normalizeJid(phoneNumber),
    status,
    direction: 'outbound',
    fromMe: true,
    type: opts?.type ?? 'text',
    messageTimestamp: opts?.messageTimestamp ?? new Date(),
  };
  if (errorMessage) {
    payload.errorMessage = errorMessage.slice(0, MAX_ERROR_LEN);
  }
  if (message) {
    payload.message = message.slice(0, MAX_MESSAGE_LEN);
  }
  if (opts?.messageId?.trim()) {
    payload.messageId = opts.messageId.trim();
  }
  if (message && message.startsWith('[arquivo]') && !opts?.type) {
    payload.type = 'media';
  }
  if (opts?.media) {
    const mediaSaved = await saveMediaFile({
      userId,
      instanceId,
      buffer: opts.media.fileBuffer,
      fileName: opts.media.fileName,
    });
    payload.mediaPath = mediaSaved.mediaPath;
    payload.mediaFileName = mediaSaved.mediaFileName;
    payload.mediaSize = mediaSaved.mediaSize;
    payload.mediaMimeType = opts.media.mimeType;
  }
  await SentMessage.create(payload);
}

export async function recordIncomingMessage(event: WhatsAppIncomingMessageEvent): Promise<void> {
  const payload: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(event.userId),
    instanceId: new mongoose.Types.ObjectId(event.instanceId),
    phoneNumber: normalizePhone(event.from),
    jid: normalizeJid(event.from),
    messageId: event.messageId,
    direction: 'inbound',
    fromMe: false,
    type: event.media ? 'media' : 'text',
    status: 'success',
    message: event.text?.slice(0, MAX_MESSAGE_LEN) || '',
    messageTimestamp: new Date(event.timestamp),
    mediaMimeType: event.media?.mimeType,
    mediaFileName: event.media?.fileName,
    mediaSize: event.media?.size,
  };
  if (event.media?.fileBuffer && event.media.fileBuffer.length > 0) {
    const mediaSaved = await saveMediaFile({
      userId: event.userId,
      instanceId: event.instanceId,
      buffer: event.media.fileBuffer,
      fileName: event.media.fileName || 'incoming.bin',
    });
    payload.mediaPath = mediaSaved.mediaPath;
    payload.mediaFileName = mediaSaved.mediaFileName;
    payload.mediaSize = mediaSaved.mediaSize;
  }
  await SentMessage.create(payload);
}

export async function listForUser(
  userId: string,
  instanceId: string,
  opts: { page: number; limit: number }
): Promise<ListMessagesResult> {
  const { page, limit } = opts;
  const skip = (page - 1) * limit;
  const filter = {
    userId: new mongoose.Types.ObjectId(userId),
    instanceId: new mongoose.Types.ObjectId(instanceId),
    direction: 'outbound',
  };

  const [docs, total] = await Promise.all([
    SentMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SentMessage.countDocuments(filter),
  ]);

  const items: SentMessageListItem[] = docs.map((doc) => ({
    id: doc._id.toString(),
    phoneNumber: doc.phoneNumber,
    status: doc.status as 'success' | 'failed',
    errorMessage: doc.errorMessage ?? null,
    message: doc.message ?? null,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : new Date(doc.createdAt).toISOString(),
  }));

  return { items, total, page, limit };
}

export async function listConversationForUser(
  userId: string,
  instanceId: string,
  jid: string,
  opts?: { limit?: number; beforeMessageId?: string }
): Promise<WhatsAppConversationMessagesBody> {
  const limit = Math.max(1, Math.min(opts?.limit ?? 20, 100));
  const filter: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    instanceId: new mongoose.Types.ObjectId(instanceId),
    jid: normalizeJid(jid),
  };
  const docs = await SentMessage.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  const mapped: WhatsAppConversationMessage[] = docs.map((doc) => ({
    id: (doc.messageId as string | undefined) ?? doc._id.toString(),
    jid: (doc.jid as string | undefined) ?? normalizeJid(String(doc.phoneNumber ?? '')),
    fromMe: Boolean(doc.fromMe ?? doc.direction === 'outbound'),
    timestamp:
      doc.messageTimestamp instanceof Date
        ? doc.messageTimestamp.toISOString()
        : doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : new Date(doc.createdAt).toISOString(),
    text: (doc.message as string | undefined) ?? '',
    type: (doc.type as string | undefined) ?? 'text',
    mediaUrl: doc.mediaPath ? `/api/v1/instances/${instanceId}/whatsapp/messages/${doc._id.toString()}/media` : undefined,
    mediaMimeType: (doc.mediaMimeType as string | undefined) ?? undefined,
    mediaFileName: (doc.mediaFileName as string | undefined) ?? undefined,
    mediaSize: (doc.mediaSize as number | undefined) ?? undefined,
  }));
  let items = mapped.slice(0, limit);
  if (opts?.beforeMessageId) {
    const idx = mapped.findIndex((m) => m.id === opts.beforeMessageId);
    items = idx >= 0 ? mapped.slice(idx + 1, idx + 1 + limit) : [];
  }
  const nextCursor = items.length > 0 ? items[items.length - 1].id : null;
  return { items, nextCursor };
}

export async function getMessageMediaForUser(
  userId: string,
  instanceId: string,
  messageId: string
): Promise<MessageMediaResult> {
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw new AppError('ID de mensagem inválido', 400);
  }
  const doc = await SentMessage.findOne({
    _id: new mongoose.Types.ObjectId(messageId),
    userId: new mongoose.Types.ObjectId(userId),
    instanceId: new mongoose.Types.ObjectId(instanceId),
  })
    .select({ mediaPath: 1, mediaMimeType: 1, mediaFileName: 1 })
    .lean();
  if (!doc?.mediaPath) {
    throw new AppError('Mídia não encontrada para esta mensagem', 404);
  }

  const absPath = path.join(resolveMediaDirAbsolute(), String(doc.mediaPath));
  try {
    await stat(absPath);
  } catch {
    throw new AppError('Arquivo de mídia não encontrado no armazenamento', 404);
  }

  return {
    fileBuffer: await readFile(absPath),
    mimeType: String(doc.mediaMimeType || 'application/octet-stream'),
    fileName: String(doc.mediaFileName || 'media.bin'),
  };
}

export async function deleteConversationMessagesForUser(
  userId: string,
  instanceId: string,
  jid: string
): Promise<DeleteMessagesResult> {
  const normalizedJid = normalizeJid(jid);
  const filter = {
    userId: new mongoose.Types.ObjectId(userId),
    instanceId: new mongoose.Types.ObjectId(instanceId),
    jid: normalizedJid,
  };
  const docs = await SentMessage.find(filter).select({ _id: 1, mediaPath: 1 }).lean();
  if (docs.length === 0) {
    return { deletedMessages: 0, deletedMediaFiles: 0, mediaDeleteErrors: 0 };
  }

  const mediaPaths = docs
    .map((doc) => (typeof doc.mediaPath === 'string' ? doc.mediaPath : ''))
    .filter((value) => value.length > 0);
  const docIds = docs.map((doc) => doc._id);
  const deleteResult = await SentMessage.deleteMany({ _id: { $in: docIds } });
  const mediaResult = await deleteMediaPathsForScope(mediaPaths, userId, instanceId);
  return {
    deletedMessages: deleteResult.deletedCount ?? 0,
    deletedMediaFiles: mediaResult.deletedMediaFiles,
    mediaDeleteErrors: mediaResult.mediaDeleteErrors,
  };
}

export async function deleteAllMessagesForUser(
  userId: string,
  instanceId: string
): Promise<DeleteMessagesResult> {
  const filter = {
    userId: new mongoose.Types.ObjectId(userId),
    instanceId: new mongoose.Types.ObjectId(instanceId),
  };
  const docs = await SentMessage.find(filter).select({ _id: 1, mediaPath: 1 }).lean();
  if (docs.length === 0) {
    return { deletedMessages: 0, deletedMediaFiles: 0, mediaDeleteErrors: 0 };
  }

  const mediaPaths = docs
    .map((doc) => (typeof doc.mediaPath === 'string' ? doc.mediaPath : ''))
    .filter((value) => value.length > 0);
  const uniqueMediaPaths = [...new Set(mediaPaths)];
  const deleteResult = await SentMessage.deleteMany(filter);

  let deletedMediaFiles = 0;
  let mediaDeleteErrors = 0;
  const instanceMediaDir = path.resolve(resolveMediaDirAbsolute(), userId, instanceId);
  try {
    await rm(instanceMediaDir, { recursive: true, force: true });
    deletedMediaFiles = uniqueMediaPaths.length;
  } catch {
    const fallback = await deleteMediaPathsForScope(uniqueMediaPaths, userId, instanceId);
    deletedMediaFiles = fallback.deletedMediaFiles;
    mediaDeleteErrors = fallback.mediaDeleteErrors;
  }

  return {
    deletedMessages: deleteResult.deletedCount ?? 0,
    deletedMediaFiles,
    mediaDeleteErrors,
  };
}

/** Início e fim do dia civil em UTC (para limite do plano grátis). */
export function utcDayBounds(date = new Date()): { start: Date; end: Date } {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
  return { start, end };
}

/** Contagem de envios com sucesso hoje (UTC) para o utilizador (todas as instâncias). */
export async function countSuccessfulSendsToday(userId: string): Promise<number> {
  const { start, end } = utcDayBounds();
  return SentMessage.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    status: 'success',
    createdAt: { $gte: start, $lt: end },
  });
}
