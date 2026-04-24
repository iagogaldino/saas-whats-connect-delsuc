import mongoose from 'mongoose';
import { ApiRequestLog } from '../models/ApiRequestLog';

const MAX_METHOD_LEN = 12;
const MAX_PATH_LEN = 300;
const MAX_IP_LEN = 64;
const MAX_UA_LEN = 300;

export type ApiRequestLogListItem = {
  id: string;
  instanceId: string | null;
  apiKeyId: string;
  method: string;
  path: string;
  statusCode: number;
  ip: string | null;
  userAgent: string | null;
  requestHeaders: Record<string, string>;
  durationMs: number | null;
  createdAt: string;
};

export type ListApiRequestLogsResult = {
  items: ApiRequestLogListItem[];
  total: number;
  page: number;
  limit: number;
};

export async function recordApiKeyRequestLog(input: {
  userId: string;
  instanceId?: string;
  apiKeyId: string;
  method: string;
  path: string;
  statusCode: number;
  ip?: string;
  userAgent?: string;
  requestHeaders?: Record<string, string>;
  durationMs?: number;
}): Promise<void> {
  await ApiRequestLog.create({
    userId: new mongoose.Types.ObjectId(input.userId),
    ...(input.instanceId ? { instanceId: new mongoose.Types.ObjectId(input.instanceId) } : {}),
    apiKeyId: new mongoose.Types.ObjectId(input.apiKeyId),
    method: input.method.toUpperCase().slice(0, MAX_METHOD_LEN),
    path: input.path.slice(0, MAX_PATH_LEN),
    statusCode: input.statusCode,
    ...(input.ip ? { ip: input.ip.slice(0, MAX_IP_LEN) } : {}),
    ...(input.userAgent ? { userAgent: input.userAgent.slice(0, MAX_UA_LEN) } : {}),
    ...(input.requestHeaders ? { requestHeaders: input.requestHeaders } : {}),
    ...(typeof input.durationMs === 'number' ? { durationMs: Math.max(0, Math.floor(input.durationMs)) } : {}),
  });
}

export async function listApiRequestLogsForUser(
  userId: string,
  instanceId: string | null,
  opts: { page: number; limit: number }
): Promise<ListApiRequestLogsResult> {
  const { page, limit } = opts;
  const skip = (page - 1) * limit;
  const filter: {
    userId: mongoose.Types.ObjectId;
    instanceId?: mongoose.Types.ObjectId;
  } = {
    userId: new mongoose.Types.ObjectId(userId),
  };
  if (instanceId) {
    filter.instanceId = new mongoose.Types.ObjectId(instanceId);
  }

  const [docs, total] = await Promise.all([
    ApiRequestLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ApiRequestLog.countDocuments(filter),
  ]);

  const items: ApiRequestLogListItem[] = docs.map((doc) => ({
    id: doc._id.toString(),
    instanceId: doc.instanceId ? doc.instanceId.toString() : null,
    apiKeyId: doc.apiKeyId.toString(),
    method: doc.method,
    path: doc.path,
    statusCode: doc.statusCode,
    ip: doc.ip ?? null,
    userAgent: doc.userAgent ?? null,
    requestHeaders: Object.fromEntries(
      Object.entries((doc.requestHeaders as Record<string, string> | undefined) ?? {}).map(([key, value]) => [
        key,
        String(value),
      ])
    ),
    durationMs: typeof doc.durationMs === 'number' ? doc.durationMs : null,
    createdAt:
      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date(doc.createdAt).toISOString(),
  }));

  return { items, total, page, limit };
}
