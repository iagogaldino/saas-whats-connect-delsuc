import mongoose from 'mongoose';
import { Router } from 'express';
import { AppError } from '../errors/AppError';
import { requireAuth } from '../middleware/requireAuth';
import { requireJwt } from '../middleware/requireJwt';
import { requireInstanceAccess } from '../middleware/requireInstanceAccess';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from '../services/apiKey.service';
import { listApiRequestLogsForUser } from '../services/apiRequestLog.service';
import { loginUser, registerUser } from '../services/userAuth.service';
import type { IWhatsAppSessionService } from '../whatsapp';
import { formatSendError, recordSend } from '../services/sentMessage.service';
import { createApiKeyBodySchema } from '../validation/apiKey.schema';
import { credentialsBodySchema } from '../validation/credentials.schema';
import { sendCodeBodySchema } from '../validation/sendCode.schema';
import { z } from 'zod';

const logsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export function createAuthRouter(whatsappSessions: IWhatsAppSessionService): Router {
  const router = Router();

  router.post('/register', async (req, res, next) => {
    try {
      const parsed = credentialsBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return next(parsed.error);
      }
      const { email, password } = parsed.data;
      const { user, token } = await registerUser(email, password);
      res.status(201).json({ user, token });
    } catch (e) {
      next(e);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const parsed = credentialsBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return next(parsed.error);
      }
      const { email, password } = parsed.data;
      const { user, token } = await loginUser(email, password);
      res.status(200).json({ user, token });
    } catch (e) {
      next(e);
    }
  });

  router.get('/me', requireAuth, (req, res) => {
    const u = req.user!;
    res.json({ user: { id: u.id, email: u.email } });
  });

  router.post('/api-keys', requireJwt, async (req, res, next) => {
    try {
      const parsed = createApiKeyBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return next(parsed.error);
      }
      const name = parsed.data.name?.trim() ? parsed.data.name.trim() : undefined;
      const created = await createApiKey(req.user!.id, name);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  });

  router.get('/api-keys', requireJwt, async (req, res, next) => {
    try {
      const items = await listApiKeys(req.user!.id);
      res.json({ items });
    } catch (e) {
      next(e);
    }
  });

  router.delete('/api-keys/:id', requireJwt, async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new AppError('ID inválido', 400));
      }
      const ok = await revokeApiKey(req.user!.id, id);
      if (!ok) {
        return next(new AppError('Chave não encontrada', 404));
      }
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  });

  router.get('/api-request-logs', requireJwt, async (req, res, next) => {
    try {
      const parsed = logsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return next(parsed.error);
      }
      const { page, limit } = parsed.data;
      const result = await listApiRequestLogsForUser(req.user!.id, null, { page, limit });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.post('/instances/:instanceId/send-code', requireAuth, requireInstanceAccess, async (req, res, next) => {
    try {
      const parsed = sendCodeBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return next(parsed.error);
      }

      const { phoneNumber, code } = parsed.data;
      const userId = req.user!.id;
      const instanceId = req.instance!.id;

      try {
        await whatsappSessions.sendOtp(userId, instanceId, phoneNumber, code);
        await recordSend(userId, instanceId, phoneNumber, 'success', undefined, code).catch(() => {
          /* não falha a resposta HTTP se o log em DB falhar */
        });
        res.status(200).json({ ok: true, message: 'Código enviado' });
      } catch (sendErr) {
        await recordSend(userId, instanceId, phoneNumber, 'failed', formatSendError(sendErr), code).catch(() => {
          /* idem */
        });
        next(sendErr);
      }
    } catch (e) {
      next(e);
    }
  });

  router.get(
    '/instances/:instanceId/api-request-logs',
    requireJwt,
    requireInstanceAccess,
    async (req, res, next) => {
      try {
        const parsed = logsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          return next(parsed.error);
        }
        const { page, limit } = parsed.data;
        const result = await listApiRequestLogsForUser(req.user!.id, req.instance!.id, { page, limit });
        res.json(result);
      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}
