import mongoose from 'mongoose';
import { Router } from 'express';
import multer, { MulterError } from 'multer';
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
import { getBillingSummary, getUserPlan, setUserPlanPaid } from '../services/billing.service';
import { listPlanPaymentsForUser } from '../services/planPayment.service';
import {
  createCardPaymentTransparent,
  createPixPayment,
  isMercadoPagoConfigured,
  syncUserMercadoPagoPayment,
} from '../services/mercadopago.service';
import { requestPasswordReset, resetPasswordWithToken } from '../services/passwordReset.service';
import { loginUser, registerUser, toPublicUser } from '../services/userAuth.service';
import { User } from '../models/User';
import type { IWhatsAppSessionService } from '../whatsapp';
import { createApiKeyBodySchema } from '../validation/apiKey.schema';
import { credentialsBodySchema } from '../validation/credentials.schema';
import { forgotPasswordBodySchema, resetPasswordBodySchema } from '../validation/passwordReset.schema';
import { sendCodeBodySchema } from '../validation/sendCode.schema';
import { sendMediaBodySchema } from '../validation/sendMedia.schema';
import { z } from 'zod';
import { mercadopagoCardPaymentRequestSchema } from '../validation/mercadopagoCardPayment.schema';
import {
  mercadopagoPaymentIdBodySchema,
  mercadopagoPixPaymentRequestSchema,
} from '../validation/mercadopagoPixPayment.schema';

const logsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export function createAuthRouter(whatsappSessions: IWhatsAppSessionService): Router {
  const router = Router();
  const maxMediaBytes = 16 * 1024 * 1024;
  const uploadMedia = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMediaBytes, files: 1 },
  }).single('file');

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

  router.post('/forgot-password', async (req, res, next) => {
    try {
      const parsed = forgotPasswordBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return next(parsed.error);
      }
      await requestPasswordReset(parsed.data.email);
      res.status(200).json({
        ok: true,
        message:
          'Se existir uma conta com este e-mail, receberá instruções para redefinir a senha.',
      });
    } catch (e) {
      next(e);
    }
  });

  router.post('/reset-password', async (req, res, next) => {
    try {
      const parsed = resetPasswordBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return next(parsed.error);
      }
      const { token, password } = parsed.data;
      await resetPasswordWithToken(token, password);
      res.status(200).json({ ok: true, message: 'Senha redefinida. Já pode entrar.' });
    } catch (e) {
      next(e);
    }
  });

  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      const u = req.user!;
      await getUserPlan(u.id);
      const doc = await User.findById(u.id).select({ email: 1, plan: 1, planExpiresAt: 1 }).lean();
      if (!doc) {
        return next(new AppError('Utilizador não encontrado', 404));
      }
      res.json({ user: toPublicUser(doc) });
    } catch (e) {
      next(e);
    }
  });

  router.get('/billing', requireJwt, async (req, res, next) => {
    try {
      const summary = await getBillingSummary(req.user!.id);
      res.json(summary);
    } catch (e) {
      next(e);
    }
  });

  router.get('/billing/payments', requireJwt, async (req, res, next) => {
    try {
      const parsed = logsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return next(parsed.error);
      }
      const { page, limit } = parsed.data;
      const result = await listPlanPaymentsForUser(req.user!.id, { page, limit });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.post('/billing/mock-checkout', requireJwt, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const ok = await setUserPlanPaid(userId, new Date(), {
        source: 'mock',
        externalId: `mock-${new mongoose.Types.ObjectId().toString()}`,
        amount: 20,
        currency: 'BRL',
      });
      if (!ok) {
        return next(new AppError('Utilizador não encontrado', 404));
      }
      const summary = await getBillingSummary(userId);
      res.json({ ok: true, message: 'Plano atualizado para pago (simulação).', ...summary });
    } catch (e) {
      next(e);
    }
  });

  /** PIX: API Payments com `payment_method_id: pix` → `pending` + QR (o utilizador paga; webhook ou /sync-payment conclui). */
  router.post('/billing/mercadopago/pix-payment', requireJwt, async (req, res, next) => {
    try {
      if (!isMercadoPagoConfigured()) {
        return next(
          new AppError('Mercado Pago não configurado no servidor (MERCADOPAGO_ACCESS_TOKEN).', 503)
        );
      }
      const parsed = mercadopagoPixPaymentRequestSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return next(parsed.error);
      }
      const userId = req.user!.id;
      const result = await createPixPayment(userId, parsed.data, { payerEmail: req.user!.email });
      if (result.phase === 'activated') {
        const summary = await getBillingSummary(userId);
        res.json({ ok: true, ...result, ...summary });
        return;
      }
      res.json({ ok: true, ...result });
    } catch (e) {
      next(e);
    }
  });

  /** Após o PIX, polling ou “verificar” — consulta o MP e ativa o plano se `approved`. */
  router.post('/billing/mercadopago/sync-payment', requireJwt, async (req, res, next) => {
    try {
      if (!isMercadoPagoConfigured()) {
        return next(
          new AppError('Mercado Pago não configurado no servidor (MERCADOPAGO_ACCESS_TOKEN).', 503)
        );
      }
      const parsed = mercadopagoPaymentIdBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return next(parsed.error);
      }
      const userId = req.user!.id;
      const s = await syncUserMercadoPagoPayment(userId, parsed.data.paymentId);
      if (s.activated) {
        const summary = await getBillingSummary(userId);
        res.json({ ok: true, activated: true, status: s.status, ...summary });
        return;
      }
      res.json({ ok: true, activated: false, status: s.status, reason: s.reason });
    } catch (e) {
      next(e);
    }
  });

  /** Checkout transparente: token do Card Payment Brick → POST /v1/payments. */
  router.post('/billing/mercadopago/card-payment', requireJwt, async (req, res, next) => {
    try {
      if (!isMercadoPagoConfigured()) {
        return next(
          new AppError('Mercado Pago não configurado no servidor (MERCADOPAGO_ACCESS_TOKEN).', 503)
        );
      }
      const parsed = mercadopagoCardPaymentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(parsed.error);
      }
      const userId = req.user!.id;
      const payerEmail = req.user!.email;
      const result = await createCardPaymentTransparent(userId, parsed.data, { payerEmail });
      const summary = await getBillingSummary(userId);
      res.json({ ok: true, activated: true, ...result, ...summary });
    } catch (e) {
      next(e);
    }
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

      const { phoneNumber, chatJid, message } = parsed.data;
      const userId = req.user!.id;
      const instanceId = req.instance!.id;

      if (chatJid) {
        await whatsappSessions.sendTextToJid(userId, instanceId, chatJid, message);
      } else {
        await whatsappSessions.sendOtp(userId, instanceId, phoneNumber!, message);
      }
      res.status(200).json({ ok: true, message: 'Código enviado' });
    } catch (e) {
      next(e);
    }
  });

  router.post('/instances/:instanceId/send-media', requireAuth, requireInstanceAccess, (req, res, next) => {
    uploadMedia(req, res, async (uploadErr) => {
      if (uploadErr) {
        if (uploadErr instanceof MulterError && uploadErr.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('Arquivo muito grande. Máximo permitido: 16MB.', 400));
        }
        return next(uploadErr);
      }

      try {
        const parsed = sendMediaBodySchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return next(parsed.error);
        }
        if (!req.file?.buffer || !req.file.originalname || !req.file.mimetype) {
          return next(new AppError('Envie o arquivo no campo "file" (multipart/form-data).', 400));
        }
        if (req.file.size <= 0) {
          return next(new AppError('O arquivo enviado está vazio.', 400));
        }

        const { phoneNumber, caption } = parsed.data;
        const userId = req.user!.id;
        const instanceId = req.instance!.id;

        await whatsappSessions.sendMedia(userId, instanceId, {
          phoneNumber,
          fileBuffer: req.file.buffer,
          mimeType: req.file.mimetype,
          fileName: req.file.originalname,
          caption,
        });
        res.status(200).json({ ok: true, message: 'Arquivo enviado' });
      } catch (e) {
        next(e);
      }
    });
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
