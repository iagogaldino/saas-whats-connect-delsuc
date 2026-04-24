import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { ApiKey } from '../models/ApiKey';
import { User } from '../models/User';

const SALT_ROUNDS = 10;
const NAME_MAX = 80;

/** Formato: otp_<12 hex prefix>_<32 hex secret> — mantém bcrypt abaixo do limite de 72 bytes. */
const KEY_PATTERN = /^otp_([a-f0-9]{12})_([a-f0-9]{32})$/i;

export type CreatedApiKey = {
  id: string;
  name: string | null;
  key: string;
  createdAt: string;
};

export type ApiKeyListItem = {
  id: string;
  name: string | null;
  keyPrefix: string;
  maskedPreview: string;
  createdAt: string;
  lastUsedAt: string | null;
};

function buildPlainKey(prefix: string, secret: string): string {
  return `otp_${prefix}_${secret}`;
}

export async function createApiKey(
  userId: string,
  name?: string | null
): Promise<CreatedApiKey> {
  const trimmed = name?.trim() || '';
  const safeName = trimmed.length > 0 ? trimmed.slice(0, NAME_MAX) : null;

  for (let attempt = 0; attempt < 8; attempt++) {
    const prefix = randomBytes(6).toString('hex');
    const secret = randomBytes(16).toString('hex');
    const plain = buildPlainKey(prefix, secret);
    const keyHash = await bcrypt.hash(plain, SALT_ROUNDS);

    try {
      const doc = await ApiKey.create({
        userId: new mongoose.Types.ObjectId(userId),
        keyPrefix: prefix,
        keyHash,
        ...(safeName ? { name: safeName } : {}),
      });
      return {
        id: doc._id.toString(),
        name: safeName,
        key: plain,
        createdAt:
          doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date(doc.createdAt).toISOString(),
      };
    } catch (e: unknown) {
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code: number }).code === 11000
      ) {
        continue;
      }
      throw e;
    }
  }

  throw new Error('Não foi possível gerar uma chave única');
}

export async function listApiKeys(userId: string): Promise<ApiKeyListItem[]> {
  const uid = new mongoose.Types.ObjectId(userId);
  const docs = await ApiKey.find({ userId: uid }).sort({ createdAt: -1 }).lean();
  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name ?? null,
    keyPrefix: d.keyPrefix,
    maskedPreview: `otp_${d.keyPrefix}…`,
    createdAt:
      d.createdAt instanceof Date ? d.createdAt.toISOString() : new Date(d.createdAt).toISOString(),
    lastUsedAt: d.lastUsedAt
      ? d.lastUsedAt instanceof Date
        ? d.lastUsedAt.toISOString()
        : new Date(d.lastUsedAt).toISOString()
      : null,
  }));
}

export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  const res = await ApiKey.deleteOne({
    _id: new mongoose.Types.ObjectId(keyId),
    userId: new mongoose.Types.ObjectId(userId),
  });
  return res.deletedCount === 1;
}

export type ValidatedApiKeyUser = { id: string; email: string; apiKeyId: string };

export async function validateApiKey(plainToken: string): Promise<ValidatedApiKeyUser | null> {
  const m = plainToken.trim().match(KEY_PATTERN);
  if (!m) {
    return null;
  }
  const prefix = m[1].toLowerCase();

  const doc = await ApiKey.findOne({ keyPrefix: prefix }).lean();
  if (!doc) {
    return null;
  }

  const ok = await bcrypt.compare(plainToken, doc.keyHash);
  if (!ok) {
    return null;
  }

  const user = await User.findById(doc.userId).lean();
  if (!user) {
    return null;
  }

  void ApiKey.updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {
    /* ignore */
  });

  return {
    id: user._id.toString(),
    email: user.email,
    apiKeyId: doc._id.toString(),
  };
}
