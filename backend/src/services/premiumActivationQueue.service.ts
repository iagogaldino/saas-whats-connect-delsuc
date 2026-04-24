import type { Logger } from 'pino';
import mongoose from 'mongoose';
import { createLogger } from '../config/logger';
import { PremiumActivationJob } from '../models/PremiumActivationJob';
import {
  type PremiumActivatedPayload,
  executePremiumActivationHandlers,
} from './premiumActivation.engine';

const log = createLogger().child({ module: 'premium-activation-queue' });

export function getPremiumActivationMaxAttempts(): number {
  const n = Number(process.env.PREMIUM_ACTIVATION_MAX_ATTEMPTS ?? 10);
  if (!Number.isFinite(n) || n < 1) return 10;
  return Math.min(100, Math.floor(n));
}

function payloadToDoc(p: PremiumActivatedPayload) {
  return {
    userId: p.userId,
    approvedAt: p.approvedAt,
    planExpiresAt: p.planExpiresAt,
    payment: p.payment
      ? {
          source: p.payment.source,
          externalId: p.payment.externalId,
          amount: p.payment.amount,
          currency: p.payment.currency,
        }
      : null,
  };
}

function docToPayload(
  doc: {
    userId: string;
    approvedAt: Date;
    planExpiresAt: Date;
    payment: {
      source: 'mercadopago' | 'mock';
      externalId: string;
      amount: number;
      currency: string;
    } | null;
  }
): PremiumActivatedPayload {
  return {
    userId: doc.userId,
    approvedAt: new Date(doc.approvedAt),
    planExpiresAt: new Date(doc.planExpiresAt),
    payment: doc.payment
      ? {
          source: doc.payment.source,
          externalId: doc.payment.externalId,
          amount: doc.payment.amount,
          currency: doc.payment.currency,
        }
      : null,
  };
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, 2000);
  return String(e).slice(0, 2000);
}

/**
 * Cria tarefa em MongoDB e processa. Estados: pending → processing → completed | failed.
 * Falhas gravam `failed` e `processingAttempts` pode ser reprocessada (até ao limite) ao arranque.
 */
export async function dispatchPremiumActivated(payload: PremiumActivatedPayload): Promise<void> {
  const job = await PremiumActivationJob.create({
    status: 'pending',
    payload: payloadToDoc(payload),
    processingAttempts: 0,
  });
  await processPremiumActivationJobById(job._id.toString());
}

export async function processPremiumActivationJobById(jobId: string): Promise<void> {
  const max = getPremiumActivationMaxAttempts();
  const j = await PremiumActivationJob.findById(new mongoose.Types.ObjectId(jobId));
  if (!j) {
    return;
  }
  if (j.status === 'completed') {
    return;
  }
  if (j.status === 'failed' && j.processingAttempts >= max) {
    return;
  }

  j.status = 'processing';
  await j.save();

  const payload = docToPayload(j.payload as Parameters<typeof docToPayload>[0]);
  try {
    await executePremiumActivationHandlers(payload);
    j.status = 'completed';
    j.processedAt = new Date();
    j.lastError = undefined;
    await j.save();
  } catch (e) {
    j.status = 'failed';
    j.processingAttempts += 1;
    j.lastError = errMessage(e);
    await j.save();
    log.error(
      { err: e, jobId, attempts: j.processingAttempts, userId: j.payload.userId },
      'fila premium: handlers falharam; pode ser reprocessada ao arranque se attempts < max'
    );
  }
}

/**
 * Reprocessa tarefas pendentes, interrompidas (processing) ou falhadas ainda com tentativas.
 */
export async function drainPremiumActivationBacklog(rootLog: Logger): Promise<void> {
  const max = getPremiumActivationMaxAttempts();
  const jobs = await PremiumActivationJob.find({
    $or: [
      { status: 'pending' },
      { status: 'processing' },
      { $and: [{ status: 'failed' }, { processingAttempts: { $lt: max } }] },
    ],
  })
    .sort({ createdAt: 1 })
    .lean()
    .exec();

  if (jobs.length > 0) {
    rootLog.info({ count: jobs.length }, 'Fila premium: a reprocessar tarefas pendentes/falhadas');
  }

  for (const row of jobs) {
    const id = row._id.toString();
    try {
      const fresh = await PremiumActivationJob.findById(row._id);
      if (!fresh || fresh.status === 'completed') {
        continue;
      }
      if (fresh.status === 'failed' && fresh.processingAttempts >= max) {
        continue;
      }
      await processPremiumActivationJobById(id);
    } catch (e) {
      rootLog.error({ err: e, jobId: id }, 'Fila premium: erro inesperado ao reprocessar');
    }
  }
}
