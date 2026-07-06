import mongoose from 'mongoose';
import { WhatsAppGroup } from '../models/WhatsAppGroup';

export async function upsertGroupSubject(
  userId: string,
  instanceId: string,
  jid: string,
  subject: string
): Promise<void> {
  const trimmed = subject.trim();
  if (!trimmed || !jid.endsWith('@g.us')) return;

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const instanceObjectId = new mongoose.Types.ObjectId(instanceId);

  await WhatsAppGroup.updateOne(
    { userId: userObjectId, instanceId: instanceObjectId, jid },
    {
      $set: { subject: trimmed },
      $setOnInsert: { userId: userObjectId, instanceId: instanceObjectId, jid },
    },
    { upsert: true }
  );
}

export async function getSavedGroupSubject(
  userId: string,
  instanceId: string,
  jid: string
): Promise<string | null> {
  const doc = await WhatsAppGroup.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    instanceId: new mongoose.Types.ObjectId(instanceId),
    jid,
  })
    .select('subject')
    .lean();

  const subject = doc?.subject?.trim();
  return subject || null;
}
