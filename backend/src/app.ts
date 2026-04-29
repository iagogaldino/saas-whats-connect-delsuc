import cors from 'cors';
import express from 'express';
import type { Logger } from 'pino';
import { apiKeyRequestAudit } from './middleware/apiKeyRequestAudit';
import { errorHandler } from './middleware/errorHandler';
import { createAuthRouter } from './routes/auth.routes';
import { createMercadoPagoWebhookRouter } from './routes/mercadopago.webhook.routes';
import { createInstancesRouter } from './routes/instances.routes';
import { createMessagesRouter } from './routes/messages.routes';
import { createWhatsAppRouter } from './routes/whatsapp.routes';
import type { WebhookDispatcher } from './realtime/webhookDispatcher';
import type { IWhatsAppSessionService } from './whatsapp';

export function createApp(
  log: Logger,
  whatsappSessions: IWhatsAppSessionService,
  webhookDispatcher: WebhookDispatcher
) {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  app.use(express.json());
  app.use('/api/v1', apiKeyRequestAudit);

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/api/v1/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/v1/instances', createInstancesRouter(whatsappSessions));
  app.use(
    '/api/v1/instances/:instanceId/whatsapp',
    createWhatsAppRouter(whatsappSessions, webhookDispatcher)
  );
  app.use('/api/v1/instances/:instanceId/messages', createMessagesRouter());
  app.use('/api/v1/auth', createAuthRouter(whatsappSessions));
  app.use('/api/v1/payments/mercadopago', createMercadoPagoWebhookRouter(log));

  app.use(errorHandler(log));
  return app;
}
