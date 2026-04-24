import crypto from 'crypto';
import mongoose from 'mongoose';
import { AppError } from '../errors/AppError';
import { WhatsAppInstance } from '../models/WhatsAppInstance';

export type WhatsAppInstanceListItem = {
  id: string;
  name: string;
  code: string;
  realtimeListeningEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

function buildCode(): string {
  const suffix = crypto.randomBytes(4).toString('hex');
  return `inst-${suffix}`;
}

function toItem(doc: {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  realtimeListeningEnabled?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}): WhatsAppInstanceListItem {
  return {
    id: doc._id.toString(),
    name: doc.name,
    code: doc.code,
    realtimeListeningEnabled: Boolean(doc.realtimeListeningEnabled),
    createdAt:
      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date(doc.createdAt).toISOString(),
    updatedAt:
      doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : new Date(doc.updatedAt).toISOString(),
  };
}

export async function createInstance(userId: string, name?: string): Promise<WhatsAppInstanceListItem> {
  const uid = new mongoose.Types.ObjectId(userId);
  const safeName = name?.trim() || `Instancia ${new Date().toLocaleString('pt-BR')}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = buildCode();
    try {
      const created = await WhatsAppInstance.create({
        userId: uid,
        name: safeName,
        code,
      });
      return toItem(created);
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: number }).code === 11000
      ) {
        continue;
      }
      throw err;
    }
  }

  throw new AppError('Nao foi possivel gerar identificador da instancia', 500);
}

export async function listInstancesForUser(userId: string): Promise<WhatsAppInstanceListItem[]> {
  const uid = new mongoose.Types.ObjectId(userId);
  const docs = await WhatsAppInstance.find({ userId: uid }).sort({ createdAt: -1 }).lean();
  return docs.map((doc) => toItem(doc));
}

export async function getOwnedInstanceOrThrow(
  userId: string,
  instanceRef: string
): Promise<WhatsAppInstanceListItem> {
  const ref = instanceRef.trim();
  if (!ref) {
    throw new AppError('Instancia invalida', 400);
  }

  const uid = new mongoose.Types.ObjectId(userId);
  const filter: {
    userId: mongoose.Types.ObjectId;
    _id?: mongoose.Types.ObjectId;
    code?: string;
  } = { userId: uid };

  if (mongoose.Types.ObjectId.isValid(ref)) {
    filter._id = new mongoose.Types.ObjectId(ref);
  } else {
    filter.code = ref;
  }

  const doc = await WhatsAppInstance.findOne(filter).lean();
  if (!doc) {
    throw new AppError('Instancia nao encontrada', 404);
  }
  return toItem(doc);
}

export async function getRealtimeListeningEnabled(
  userId: string,
  instanceId: string
): Promise<boolean> {
  const doc = await getOwnedInstanceOrThrow(userId, instanceId);
  return doc.realtimeListeningEnabled;
}

export async function setRealtimeListeningEnabled(
  userId: string,
  instanceId: string,
  enabled: boolean
): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(instanceId)) return false;
  const res = await WhatsAppInstance.updateOne(
    { _id: new mongoose.Types.ObjectId(instanceId), userId: new mongoose.Types.ObjectId(userId) },
    { $set: { realtimeListeningEnabled: enabled } }
  );
  return res.matchedCount === 1;
}
