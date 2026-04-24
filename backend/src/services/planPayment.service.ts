import mongoose from 'mongoose';
import { PlanPayment } from '../models/PlanPayment';

function isDuplicateKeyError(e: unknown): boolean {
  return (
    e !== null &&
    typeof e === 'object' &&
    'code' in e &&
    (e as { code: number }).code === 11000
  );
}

export type PlanPaymentLogInput = {
  source: 'mercadopago' | 'mock';
  externalId: string;
  amount: number;
  currency: string;
};

/**
 * Grava um pagamento aprovado. Idempotente: mesmo (source, externalId) ignora duplicado (webhook + confirm).
 * @returns `inserted` na primeira gravação, `duplicate` se o par origem+id já existia
 */
export async function recordPlanPaymentIfNew(
  userId: string,
  log: PlanPaymentLogInput,
  approvedAt: Date,
  planExpiresAt: Date
): Promise<'inserted' | 'duplicate'> {
  try {
    await PlanPayment.create({
      userId: new mongoose.Types.ObjectId(userId),
      source: log.source,
      externalId: log.externalId,
      amount: log.amount,
      currency: log.currency,
      status: 'approved',
      approvedAt,
      planExpiresAt,
    });
    return 'inserted';
  } catch (e) {
    if (isDuplicateKeyError(e)) return 'duplicate';
    throw e;
  }
}

export type PlanPaymentStatus = 'approved';

export type PublicPlanPaymentItem = {
  id: string;
  source: 'mercadopago' | 'mock';
  status: PlanPaymentStatus;
  amount: number;
  currency: string;
  approvedAt: string;
  planExpiresAt: string;
  createdAt: string;
};

export type ListPlanPaymentsResult = {
  items: PublicPlanPaymentItem[];
  total: number;
  page: number;
  limit: number;
};

export async function listPlanPaymentsForUser(
  userId: string,
  opts: { page: number; limit: number }
): Promise<ListPlanPaymentsResult> {
  const { page, limit } = opts;
  const skip = (page - 1) * limit;
  const q = { userId: new mongoose.Types.ObjectId(userId) };
  const [rows, total] = await Promise.all([
    PlanPayment.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    PlanPayment.countDocuments(q).exec(),
  ]);
  const items: PublicPlanPaymentItem[] = rows.map((r) => {
    const created = (r as { createdAt?: Date }).createdAt;
    const status: PlanPaymentStatus = ((r as { status?: string }).status ?? 'approved') as PlanPaymentStatus;
    return {
      id: r._id.toString(),
      source: r.source,
      status,
      amount: r.amount,
      currency: r.currency,
      approvedAt: new Date(r.approvedAt).toISOString(),
      planExpiresAt: new Date(r.planExpiresAt).toISOString(),
      createdAt: created ? new Date(created).toISOString() : new Date(r.approvedAt).toISOString(),
    };
  });
  return { items, total, page, limit };
}
