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

/** `named`: só contactos com nome de agenda gravado (comportamento original). `all`: todos os contactos utilizador sincronizados na coleção para a instância. */
export type ListContactsFilter = 'named' | 'all';

/**
 * Retorna contactos da instância.
 * Por defeito só entradas com `name` não vazio (agenda).
 * Com `filter: 'all'`, inclui qualquer entrada persistida (`@s.whatsapp.net`).
 */
export async function listSavedContactsForUser(
  userId: string,
  instanceId: string,
  opts?: { filter?: ListContactsFilter }
): Promise<SavedContactItem[]> {
  const uid = new mongoose.Types.ObjectId(userId);
  const iid = new mongoose.Types.ObjectId(instanceId);
  const base = { userId: uid, instanceId: iid };

  const filter =
    opts?.filter === 'all'
      ? base
      : { ...base, name: { $exists: true, $ne: '' } };

  const docs = await WhatsAppContact.find(filter)
    .sort(opts?.filter === 'all' ? { name: 1, jid: 1 } : { name: 1 })
    .lean();

  return docs.map((doc) => ({
    jid: doc.jid,
    name: doc.name ?? '',
    phone: doc.phone ?? jidToPhone(doc.jid),
    notify: doc.notify || undefined,
  }));
}
