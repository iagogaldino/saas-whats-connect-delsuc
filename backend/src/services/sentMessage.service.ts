import mongoose from 'mongoose';
import { AppError } from '../errors/AppError';
import { SentMessage } from '../models/SentMessage';

const MAX_ERROR_LEN = 500;

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

export function formatSendError(err: unknown): string {
  if (err instanceof AppError) return err.message.slice(0, MAX_ERROR_LEN);
  if (err instanceof Error) return err.message.slice(0, MAX_ERROR_LEN);
  return String(err).slice(0, MAX_ERROR_LEN);
}

export async function recordSend(
  userId: string,
  instanceId: string,
  phoneNumber: string,
  status: 'success' | 'failed',
  errorMessage?: string,
  message?: string
): Promise<void> {
  const payload: {
    userId: mongoose.Types.ObjectId;
    instanceId: mongoose.Types.ObjectId;
    phoneNumber: string;
    status: 'success' | 'failed';
    errorMessage?: string;
    message?: string;
  } = {
    userId: new mongoose.Types.ObjectId(userId),
    instanceId: new mongoose.Types.ObjectId(instanceId),
    phoneNumber,
    status,
  };
  if (errorMessage) {
    payload.errorMessage = errorMessage.slice(0, MAX_ERROR_LEN);
  }
  if (message) {
    payload.message = message.slice(0, 500);
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
