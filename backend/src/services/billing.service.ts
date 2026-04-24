import mongoose from 'mongoose';
import { AppError } from '../errors/AppError';
import { User } from '../models/User';
import { countSuccessfulSendsToday } from './sentMessage.service';
import { dispatchPremiumActivated } from './premiumActivationQueue.service';
import { recordPlanPaymentIfNew, type PlanPaymentLogInput } from './planPayment.service';
import type { PublicUserPlan } from './userAuth.service';

export function getFreeDailySendLimit(): number {
  const n = Number(process.env.FREE_DAILY_SEND_LIMIT ?? 20);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 20;
}

/** Duração do plano pago (dias) a partir de cada pagamento aprovado. */
export function getPaidPlanDurationDays(): number {
  const n = Number(process.env.PAID_PLAN_DURATION_DAYS ?? 30);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(3650, Math.floor(n));
}

/** `approvedAt` + N dias (duração N em UTC, por milissegundos de dia). */
export function computePaidUntil(approvedAt: Date): Date {
  const days = getPaidPlanDurationDays();
  return new Date(approvedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Aplica expiração e backfill; devolve o plano efetivo.
 */
export async function getUserPlan(userId: string): Promise<PublicUserPlan> {
  const doc = await User.findById(userId)
    .select({ plan: 1, planExpiresAt: 1 })
    .lean();
  if (!doc) {
    throw new AppError('Utilizador não encontrado', 404);
  }

  if (doc.plan !== 'paid') {
    return 'free';
  }

  const now = new Date();
  if (doc.planExpiresAt) {
    const exp = new Date(doc.planExpiresAt);
    if (now.getTime() > exp.getTime()) {
      await User.updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $set: { plan: 'free' }, $unset: { planExpiresAt: 1 } }
      );
      return 'free';
    }
    return 'paid';
  }

  // Legado: paid sem `planExpiresAt` — atribui janela a partir de agora
  const until = computePaidUntil(now);
  await User.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $set: { planExpiresAt: until } }
  );
  return 'paid';
}

/**
 * Job em lote: `plan === 'paid'` com `planExpiresAt` no passado → `free` e remove `planExpiresAt`.
 * Contas legadas `paid` sem data não são alteradas aqui (continuam a ser resolvidas em `getUserPlan`).
 */
export async function sweepExpiredPaidPlans(): Promise<{ modifiedCount: number }> {
  const now = new Date();
  const res = await User.updateMany(
    { plan: 'paid', planExpiresAt: { $lt: now } },
    { $set: { plan: 'free' }, $unset: { planExpiresAt: 1 } }
  );
  const modifiedCount = res.modifiedCount ?? 0;
  return { modifiedCount };
}

export type BillingSummary = {
  plan: PublicUserPlan;
  freeDailyLimit: number;
  usedToday: number;
  remaining: number | null;
  dayTimezoneNote: 'UTC';
  planExpiresAt: string | null;
};

export async function getBillingSummary(userId: string): Promise<BillingSummary> {
  const plan = await getUserPlan(userId);
  const freeDailyLimit = getFreeDailySendLimit();
  const usedToday = await countSuccessfulSendsToday(userId);
  let planExpiresAt: string | null = null;
  if (plan === 'paid') {
    const u = await User.findById(userId).select({ planExpiresAt: 1 }).lean();
    if (u?.planExpiresAt) {
      planExpiresAt = new Date(u.planExpiresAt).toISOString();
    }
  }
  if (plan === 'paid') {
    return {
      plan,
      freeDailyLimit,
      usedToday,
      remaining: null,
      dayTimezoneNote: 'UTC',
      planExpiresAt,
    };
  }
  const remaining = Math.max(0, freeDailyLimit - usedToday);
  return {
    plan,
    freeDailyLimit,
    usedToday,
    remaining,
    dayTimezoneNote: 'UTC',
    planExpiresAt: null,
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

/**
 * Ativa o plano pago. `approvedAt` é o instante a considerar (ex. data de aprovação do MP).
 * `log` regista a linha no histórico (idempotente por origem + externalId do MP ou id único em mock).
 */
export async function setUserPlanPaid(
  userId: string,
  approvedAt: Date = new Date(),
  log?: PlanPaymentLogInput
): Promise<boolean> {
  const until = computePaidUntil(approvedAt);
  const res = await User.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { $set: { plan: 'paid', planExpiresAt: until } }
  );
  if (res.matchedCount !== 1) {
    return false;
  }

  let shouldDispatch = false;
  if (log) {
    const r = await recordPlanPaymentIfNew(userId, log, approvedAt, until);
    shouldDispatch = r === 'inserted';
  } else {
    shouldDispatch = true;
  }

  if (shouldDispatch) {
    await dispatchPremiumActivated({
      userId,
      approvedAt,
      planExpiresAt: until,
      payment: log ?? null,
    });
  }
  return true;
}
