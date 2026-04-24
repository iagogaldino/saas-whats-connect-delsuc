import { Router } from 'express';
import type { Logger } from 'pino';
import { activatePlanIfPaymentApproved, extractPaymentIdFromWebhook } from '../services/mercadopago.service';

export function createMercadoPagoWebhookRouter(log: Logger): Router {
  const router = Router();

  /** Mercado Pago notifica pagamentos; responder 200 rapidamente. */
  router.post('/webhook', async (req, res) => {
    try {
      const paymentId = extractPaymentIdFromWebhook(req);
      if (!paymentId) {
        log.warn({ body: req.body, query: req.query }, 'Mercado Pago webhook: id de pagamento não identificado');
        return res.status(200).json({ ok: true });
      }
      const result = await activatePlanIfPaymentApproved(paymentId);
      log.info({ paymentId, result }, 'Mercado Pago webhook processado');
    } catch (e) {
      log.error({ err: e }, 'Mercado Pago webhook falhou');
    }
    return res.status(200).json({ ok: true });
  });

  router.get('/webhook', (_req, res) => {
    res.status(200).send('ok');
  });

  return router;
}
