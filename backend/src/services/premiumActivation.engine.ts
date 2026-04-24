import type { PlanPaymentLogInput } from './planPayment.service';

/**
 * Dados da ativação do plano pago (disparado depois de `User` atualizado com sucesso).
 * Usado para e-mail, webhooks internos, analytics, etc.
 */
export type PremiumActivatedPayload = {
  userId: string;
  approvedAt: Date;
  planExpiresAt: Date;
  /** Metadados do pagamento; `null` se `setUserPlanPaid` foi chamado sem registo no histórico */
  payment: PlanPaymentLogInput | null;
};

type Handler = (payload: PremiumActivatedPayload) => Promise<void>;

const handlers: Handler[] = [];

/**
 * Regista um callback a correr quando o plano pago é efetivado (uma vez por pagamento novo).
 * Registe no arranque da aplicação (ex. após `createApp`), nunca dentro de um handler.
 *
 * @example
 * registerPremiumActivationHandler(async (p) => {
 *   await sendEmail({ to: p.userId, template: 'premium_welcome' });
 * });
 */
export function registerPremiumActivationHandler(handler: Handler): void {
  handlers.push(handler);
}

/**
 * Executa todos os handlers em sequência. Qualquer rejeição falha a tarefa na fila (pode reprocessar ao arranque).
 * Use try/catch dentro do handler se o erro não fizer sentido reprocessar.
 */
export async function executePremiumActivationHandlers(payload: PremiumActivatedPayload): Promise<void> {
  for (const h of handlers) {
    await h(payload);
  }
}
