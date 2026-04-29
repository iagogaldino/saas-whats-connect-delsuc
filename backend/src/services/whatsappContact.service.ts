import mongoose from 'mongoose';
import { WhatsAppContact } from '../models/WhatsAppContact';

export type SavedContactItem = {
  jid: string;
  name: string;
  phone: string;
  notify?: string;
};

export type IncomingContactPartial = {
  jid: string;
  name?: string;
  notify?: string;
  pushName?: string;
};

const USER_JID_SUFFIX = '@s.whatsapp.net';

function jidToPhone(jid: string): string {
  const at = jid.indexOf('@');
  const userPart = at > 0 ? jid.slice(0, at) : jid;
  const noDevice = userPart.split(':')[0] ?? userPart;
  return noDevice.replace(/\D/g, '');
}

function isUserJid(jid: string | undefined | null): jid is string {
  return typeof jid === 'string' && jid.endsWith(USER_JID_SUFFIX);
}

/**
 * Persiste em lote (upsert) atualizações de contatos vindas do Baileys.
 *
 * - Ignora entradas sem `jid` ou que não sejam JIDs de usuário (`@s.whatsapp.net`).
 * - Aplica apenas os campos presentes na entrada para preservar os valores
 *   atuais quando um evento `contacts.update` traz só deltas.
 */
export async function upsertContacts(
  userId: string,
  instanceId: string,
  contacts: IncomingContactPartial[]
): Promise<void> {
  if (!Array.isArray(contacts) || contacts.length === 0) return;

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const instanceObjectId = new mongoose.Types.ObjectId(instanceId);

  type ContactSet = {
    phone?: string;
    name?: string;
    notify?: string;
    pushName?: string;
  };

  const ops: Array<{
    updateOne: {
      filter: { userId: mongoose.Types.ObjectId; instanceId: mongoose.Types.ObjectId; jid: string };
      update: { $set: ContactSet; $setOnInsert: { userId: mongoose.Types.ObjectId; instanceId: mongoose.Types.ObjectId; jid: string } };
      upsert: true;
    };
  }> = [];

  for (const c of contacts) {
    if (!isUserJid(c.jid)) continue;
    const $set: ContactSet = { phone: jidToPhone(c.jid) };
    if (typeof c.name === 'string') $set.name = c.name;
    if (typeof c.notify === 'string') $set.notify = c.notify;
    if (typeof c.pushName === 'string') $set.pushName = c.pushName;

    ops.push({
      updateOne: {
        filter: { userId: userObjectId, instanceId: instanceObjectId, jid: c.jid },
        update: {
          $set,
          $setOnInsert: { userId: userObjectId, instanceId: instanceObjectId, jid: c.jid },
        },
        upsert: true,
      },
    });
  }

  if (ops.length === 0) return;
  await WhatsAppContact.bulkWrite(ops, { ordered: false });
}

/**
 * Retorna os contatos salvos na agenda (com `name` definido) da instância,
 * ordenados por nome ASC.
 */
export async function listSavedContactsForUser(
  userId: string,
  instanceId: string
): Promise<SavedContactItem[]> {
  const docs = await WhatsAppContact.find({
    userId: new mongoose.Types.ObjectId(userId),
    instanceId: new mongoose.Types.ObjectId(instanceId),
    name: { $exists: true, $ne: '' },
  })
    .sort({ name: 1 })
    .lean();

  return docs.map((doc) => ({
    jid: doc.jid,
    name: doc.name ?? '',
    phone: doc.phone ?? jidToPhone(doc.jid),
    notify: doc.notify || undefined,
  }));
}
