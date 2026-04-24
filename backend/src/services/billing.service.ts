import mongoose from 'mongoose';
import { AppError } from '../errors/AppError';
import { User } from '../models/User';
import { countSuccessfulSendsToday } from './sentMessage.service';
import type { PublicUserPlan } from './userAuth.service';

export function getFreeDailySendLimit(): number {
  const n = Number(process.env.FREE_DAILY_SEND_LIMIT ?? 20);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 20;
}

export async function getUserPlan(userId: string): Promise<PublicUserPlan> {
  const doc = await User.findById(userId).select({ plan: 1 }).lean();
  if (!doc) {
    throw new AppError('Utilizador não encontrado', 404);
  }
  return doc.plan === 'paid' ? 'paid' : 'free';
}

export type BillingSummary = {
  plan: PublicUserPlan;
  freeDailyLimit: number;
  usedToday: number;
  remaining: number | null;
  dayTimezoneNote: 'UTC';
};

export async function getBillingSummary(userId: string): Promise<BillingSummary> {
  const plan = await getUserPlan(userId);
  const freeDailyLimit = getFreeDailySendLimit();
  const usedToday = await countSuccessfulSendsToday(userId);
  if (plan === 'paid') {
    return {
      plan,
      freeDailyLimit,
      usedToday,
      remaining: null,
      dayTimezoneNote: 'UTC',
    };
  }
  const remaining = Math.max(0, freeDailyLimit - usedToday);
  return {
    plan,
    freeDailyLimit,
    usedToday,
    remaining,
    dayTimezoneNote: 'UTC',
  };
}

export async function assertFreePlanCanSend(userId: string): Promise<void> {
  const plan = await getUserPlan(userId);
  if (plan === 'paid') return;
  const limit = getFreeDailySendLimit();
  const used = await countSuccessfulSendsToday(userId);
  if (used >= limit) {
    throw new AppError('Limite diário atingido. Atualize o plano.', 403);
  }
}

export function isMockBillingEnabled(): boolean {
  return process.env.ENABLE_MOCK_BILLING === '1';
}

export async function setUserPlanPaid(userId: string): Promise<boolean> {
  const res = await User.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $set: { plan: 'paid' } }
  );
  return res.matchedCount === 1;
}
