import mongoose from 'mongoose';
import { User } from '../models/User';

export async function getRealtimeListeningEnabled(userId: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return false;
  const user = await User.findById(userId).select({ realtimeListeningEnabled: 1 }).lean();
  return Boolean(user?.realtimeListeningEnabled);
}

export async function setRealtimeListeningEnabled(userId: string, enabled: boolean): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return false;
  const res = await User.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $set: { realtimeListeningEnabled: enabled } }
  );
  return res.matchedCount === 1;
}
