import crypto from 'crypto';
import mongoose from 'mongoose';
import { AppError } from '../errors/AppError';
import { ApiRequestLog } from '../models/ApiRequestLog';
import { SentMessage } from '../models/SentMessage';
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

function buildOwnedInstanceFilter(
  userId: string,
  instanceRef: string
): { userId: mongoose.Types.ObjectId; _id?: mongoose.Types.ObjectId; code?: string } | null {
  const ref = instanceRef.trim();
  if (!ref) return null;
  const uid = new mongoose.Types.ObjectId(userId);
  const filter: { userId: mongoose.Types.ObjectId; _id?: mongoose.Types.ObjectId; code?: string } = { userId: uid };
  if (mongoose.Types.ObjectId.isValid(ref)) {
    filter._id = new mongoose.Types.ObjectId(ref);
  } else {
    filter.code = ref;
  }
  return filter;
}

function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export type WebhookPublicConfig = {
  url: string | null;
  enabled: boolean;
  hasSecret: boolean;
  secretLast4: string | null;
};

export type SetWebhookConfigInput = {
  url: string;
  enabled: boolean;
  regenerateSecret?: boolean;
};

export type SetWebhookConfigResult = {
  config: WebhookPublicConfig;
  /** Presente só quando o segredo é gerado ou regenerado */
  secret?: string;
};

function toWebhookPublic(
  url: string,
  enabledFlag: boolean,
  secret: string | undefined | null
): WebhookPublicConfig {
  const u = (url ?? '').trim();
  const s = (secret ?? '').trim();
  return {
    url: u.length > 0 ? u : null,
    enabled: Boolean(enabledFlag) && u.length > 0,
    hasSecret: s.length > 0,
    secretLast4: s.length >= 4 ? s.slice(-4) : null,
  };
}

export async function getWebhookConfigForUser(
  userId: string,
  instanceRef: string
): Promise<WebhookPublicConfig> {
  const filter = buildOwnedInstanceFilter(userId, instanceRef);
  if (!filter) {
    throw new AppError('Instancia invalida', 400);
  }
  const doc = await WhatsAppInstance.findOne(filter)
    .select({ webhookUrl: 1, webhookEnabled: 1, webhookSecret: 1 })
    .lean();
  if (!doc) {
    throw new AppError('Instancia nao encontrada', 404);
  }
  return toWebhookPublic(doc.webhookUrl ?? '', doc.webhookEnabled, doc.webhookSecret);
}

/** Indica o que impede o envio (teste ou mensagens reais). */
export function getWebhookNotReadyReasons(pub: WebhookPublicConfig): string[] {
  const reasons: string[] = [];
  if (!pub.url?.trim()) {
    reasons.push('Defina a URL do webhook (ex.: http://localhost:3847/webhook) e clique em Guardar.');
  }
  if (!pub.enabled) {
    reasons.push('Marque "Ativar envio para esta URL" e clique em Guardar.');
  }
  if (!pub.hasSecret) {
    reasons.push('Grave o formulário com URL e ativo para gerar o segredo (ou use Regenerar segredo).');
  }
  return reasons;
}

/** Desliga o envio por webhook; mantém URL e segredo. Exclusão mútua com o Message Listener (Socket). */
export async function disableWebhookDeliveryForInstance(
  userId: string,
  instanceRef: string
): Promise<boolean> {
  const filter = buildOwnedInstanceFilter(userId, instanceRef);
  if (!filter) return false;
  const res = await WhatsAppInstance.updateOne(filter, { $set: { webhookEnabled: false } });
  return res.matchedCount === 1;
}

/** Configuração mínima para entrega; null se o webhook não deve ser chamado. */
export async function getWebhookDispatchConfig(
  userId: string,
  instanceId: string
): Promise<{ url: string; secret: string } | null> {
  const filter = buildOwnedInstanceFilter(userId, instanceId);
  if (!filter) return null;
  const doc = await WhatsAppInstance.findOne(filter)
    .select({ webhookUrl: 1, webhookEnabled: 1, webhookSecret: 1 })
    .lean();
  if (!doc) return null;
  const url = (doc.webhookUrl ?? '').trim();
  const secret = (doc.webhookSecret ?? '').trim();
  const effective = Boolean(doc.webhookEnabled) && url.length > 0;
  if (!effective || !secret) {
    return null;
  }
  return { url, secret };
}

export async function setWebhookConfig(
  userId: string,
  instanceRef: string,
  input: SetWebhookConfigInput
): Promise<SetWebhookConfigResult> {
  const filter = buildOwnedInstanceFilter(userId, instanceRef);
  if (!filter) {
    throw new AppError('Instancia invalida', 400);
  }
  const current = await WhatsAppInstance.findOne(filter)
    .select({ _id: 1, webhookUrl: 1, webhookEnabled: 1, webhookSecret: 1 })
    .lean();
  if (!current) {
    throw new AppError('Instancia nao encontrada', 404);
  }

  const url = input.url.trim();
  const enabled = Boolean(input.enabled) && url.length > 0;
  const prevSecret = (current.webhookSecret ?? '').trim();
  let newSecret: string | undefined;
  if (input.regenerateSecret) {
    newSecret = generateWebhookSecret();
  } else if (enabled && !prevSecret) {
    newSecret = generateWebhookSecret();
  } else {
    newSecret = undefined;
  }

  const setDoc: {
    webhookUrl: string;
    webhookEnabled: boolean;
    webhookSecret?: string;
  } = {
    webhookUrl: url,
    webhookEnabled: enabled,
  };
  if (newSecret !== undefined) {
    setDoc.webhookSecret = newSecret;
  }

  await WhatsAppInstance.updateOne(
    { _id: current._id, userId: new mongoose.Types.ObjectId(userId) },
    { $set: setDoc }
  );

  const finalSecret = newSecret ?? prevSecret;
  const result: SetWebhookConfigResult = {
    config: toWebhookPublic(url, setDoc.webhookEnabled, finalSecret),
  };
  if (newSecret) {
    result.secret = newSecret;
  }
  return result;
}

export type RemoveInstanceCascadeResult = {
  id: string;
  code: string;
};

export async function removeInstanceCascade(
  userId: string,
  instanceRef: string
): Promise<RemoveInstanceCascadeResult> {
  const owned = await getOwnedInstanceOrThrow(userId, instanceRef);
  const instanceObjectId = new mongoose.Types.ObjectId(owned.id);
  const userObjectId = new mongoose.Types.ObjectId(userId);

  await SentMessage.deleteMany({ userId: userObjectId, instanceId: instanceObjectId });
  await ApiRequestLog.deleteMany({ userId: userObjectId, instanceId: instanceObjectId });
  await WhatsAppInstance.deleteOne({ _id: instanceObjectId, userId: userObjectId });

  return { id: owned.id, code: owned.code };
}
