import type { Logger } from 'pino';
import { sweepExpiredPaidPlans } from '../services/billing.service';

/** `null` = desativado */
export function getPlanExpirationSweepIntervalMs(): number | null {
  const raw = process.env.PLAN_EXPIRATION_SWEEP_INTERVAL_MS?.trim();
  if (raw === '0' || raw === 'false' || raw === 'off') {
    return null;
  }
  if (raw === undefined || raw === '') {
    return 60 * 60 * 1000;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 60 * 60 * 1000;
  }
  if (n === 0) {
    return null;
  }
  return Math.min(7 * 24 * 60 * 60 * 1000, Math.max(10_000, n));
}

/**
 * Corre `sweepExpiredPaidPlans` ao arranque e depois em intervalo fixo.
 * Desative com `PLAN_EXPIRATION_SWEEP_INTERVAL_MS=0` (só expiração lazy em `getUserPlan`).
 */
export function startPlanExpirationSweep(log: Logger): { stop: () => void } {
  const ms = getPlanExpirationSweepIntervalMs();
  if (ms === null) {
    log.info('Varredura de expiração do plano: desativada (PLAN_EXPIRATION_SWEEP_INTERVAL_MS=0)');
    return { stop: () => {} };
  }

  const run = async () => {
    try {
      const { modifiedCount } = await sweepExpiredPaidPlans();
      if (modifiedCount > 0) {
        log.info({ modifiedCount }, 'Varredura: contas com plano pago expirado passaram a grátis');
      }
    } catch (e) {
      log.error({ err: e }, 'Varredura de expiração do plano falhou');
    }
  };

  void run();
  const id = setInterval(() => void run(), ms);
  log.info({ intervalMs: ms }, 'Varredura de expiração do plano agendada');
  return {
    stop: () => clearInterval(id),
  };
}
