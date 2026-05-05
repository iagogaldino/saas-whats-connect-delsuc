import { Router } from 'express';
import multer, { MulterError } from 'multer';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { requireJwt } from '../middleware/requireJwt';
import { requireInstanceAccess } from '../middleware/requireInstanceAccess';
import { AppError } from '../errors/AppError';
import type { WebhookDispatcher } from '../realtime/webhookDispatcher';
import {
  getMessagePersistenceEnabled,
  getWebhookConfigForUser,
  getWebhookDispatchConfig,
  getWebhookNotReadyReasons,
  setMessagePersistenceEnabled,
  setWebhookConfig,
} from '../services/instance.service';
import { deleteConversationMessagesForUser, getMessageMediaForUser } from '../services/sentMessage.service';
import { setWebhookBodySchema } from '../validation/webhook.schema';
import type { IWhatsAppSessionService, WhatsAppIncomingMessageEvent } from '../whatsapp';

const contactsQuerySchema = z.object({
  filter: z.enum(['named', 'all']).optional().default('named'),
});

const conversationMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  beforeMessageId: z.string().trim().min(1).max(300).optional(),
});

const messagePersistenceBodySchema = z.object({
  enabled: z.coerce.boolean(),
});

function toConversationJid(rawValue: string): string {
  const raw = decodeURIComponent(rawValue || '').trim();
  if (!raw) {
    throw new AppError('Número da conversa é obrigatório.', 400);
  }
  if (raw.includes('@')) {
    return raw;
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 20) {
    throw new AppError('Número da conversa inválido.', 400);
  }
  return `${digits}@s.whatsapp.net`;
}

export function createWhatsAppRouter(
  manager: IWhatsAppSessionService,
  webhookDispatcher: WebhookDispatcher
): Router {
  const router = Router({ mergeParams: true });
  const maxPhotoBytes = 2 * 1024 * 1024;
  const allowedPhotoMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const uploadProfilePhoto = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxPhotoBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!allowedPhotoMimeTypes.has(file.mimetype)) {
        cb(new AppError('Formato inválido. Use JPG, PNG ou WEBP.', 400));
        return;
      }
      cb(null, true);
    },
  }).single('photo');
  router.use(requireAuth, requireInstanceAccess);

  router.post('/pairing/start', (req, res) => {
    const userId = req.user!.id;
    const instanceId = req.instance!.id;
    if (manager.isReady(userId, instanceId)) {
      res.status(200).json({ ok: true, alreadyConnected: true });
      return;
    }
    manager.startPairing(userId, instanceId);
    res.status(202).json({ ok: true, alreadyConnected: false });
  });

  router.get('/status', (req, res) => {
    const userId = req.user!.id;
    const instanceId = req.instance!.id;
    // Após restart do servidor, reidrata a sessão do usuário em background
    // usando as credenciais persistidas em disco (quando válidas).
    manager.startPairing(userId, instanceId);
    res.json({
      whatsappReady: manager.isReady(userId, instanceId),
      pairingPending: manager.isPairingPending(userId, instanceId),
    });
  });

  router.get('/qr', (req, res) => {
    const userId = req.user!.id;
    const instanceId = req.instance!.id;
    res.json({ qr: manager.getQr(userId, instanceId) });
  });

  router.get('/contacts', async (req, res, next) => {
    try {
      const parsed = contactsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return next(parsed.error);
      }
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      const items = await manager.getSavedContacts(userId, instanceId, {
        filter: parsed.data.filter,
      });
      res.json({ items });
    } catch (e) {
      next(e);
    }
  });

  router.get('/conversations/:jid/messages', async (req, res, next) => {
    try {
      const parsed = conversationMessagesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return next(parsed.error);
      }
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      const jid = toConversationJid(req.params.jid || '');
      const result = await manager.listConversationMessages(userId, instanceId, jid, {
        limit: parsed.data.limit,
        beforeMessageId: parsed.data.beforeMessageId,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.delete('/conversations/:jid/messages', requireJwt, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      const jid = toConversationJid(req.params.jid || '');
      const result = await deleteConversationMessagesForUser(userId, instanceId, jid);
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.get('/messages/:messageId/media', async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      const media = await getMessageMediaForUser(userId, instanceId, req.params.messageId);
      res.setHeader('Content-Type', media.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${media.fileName}"`);
      res.status(200).send(media.fileBuffer);
    } catch (e) {
      next(e);
    }
  });

  router.get('/message-persistence', requireJwt, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      const enabled = await getMessagePersistenceEnabled(userId, instanceId);
      res.json({ enabled });
    } catch (e) {
      next(e);
    }
  });

  router.put('/message-persistence', requireJwt, async (req, res, next) => {
    try {
      const parsed = messagePersistenceBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return next(parsed.error);
      }
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      const ok = await setMessagePersistenceEnabled(userId, instanceId, parsed.data.enabled);
      if (!ok) {
        return next(new AppError('Instância não encontrada.', 404));
      }
      res.json({ enabled: parsed.data.enabled });
    } catch (e) {
      next(e);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      await manager.destroySession(userId, instanceId);
      res.status(200).json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.put('/profile-photo', requireJwt, (req, res, next) => {
    uploadProfilePhoto(req, res, async (uploadErr) => {
      if (uploadErr) {
        if (uploadErr instanceof MulterError && uploadErr.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('Arquivo muito grande. Máximo permitido: 2MB.', 400));
        }
        return next(uploadErr);
      }
      if (!req.file?.buffer || !req.file.mimetype) {
        return next(new AppError('Envie a imagem no campo "photo" (multipart/form-data).', 400));
      }
      if (req.file.size <= 0) {
        return next(new AppError('O arquivo enviado está vazio.', 400));
      }
      try {
        const userId = req.user!.id;
        const instanceId = req.instance!.id;
        await manager.updateProfilePhoto(userId, instanceId, req.file.buffer, req.file.mimetype);
        res.status(200).json({ ok: true });
      } catch (e) {
        next(e);
      }
    });
  });

  router.get('/profile-photo', requireJwt, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      const url = await manager.getProfilePhotoUrl(userId, instanceId);
      res.status(200).json({ url });
    } catch (e) {
      next(e);
    }
  });

  router.get('/listening/status', requireJwt, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      res.json(await manager.getListeningStatus(userId, instanceId));
    } catch (e) {
      next(e);
    }
  });

  router.post('/listening/start', requireJwt, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      res.status(200).json(await manager.setListeningEnabled(userId, instanceId, true));
    } catch (e) {
      next(e);
    }
  });

  router.post('/listening/stop', requireJwt, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      res.status(200).json(await manager.setListeningEnabled(userId, instanceId, false));
    } catch (e) {
      next(e);
    }
  });

  router.get('/webhook', requireJwt, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      const config = await getWebhookConfigForUser(userId, instanceId);
      res.json(config);
    } catch (e) {
      next(e);
    }
  });

  router.put('/webhook', requireJwt, async (req, res, next) => {
    try {
      const parsed = setWebhookBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return next(parsed.error);
      }
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      const result = await setWebhookConfig(userId, instanceId, parsed.data);
      if (result.config.enabled) {
        await manager.setListeningEnabled(userId, instanceId, false);
      }
      res.json({ ok: true, config: result.config, secret: result.secret });
    } catch (e) {
      next(e);
    }
  });

  router.post('/webhook/test', requireJwt, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const instanceId = req.instance!.id;
      const config = await getWebhookDispatchConfig(userId, instanceId);
      if (!config) {
        const pub = await getWebhookConfigForUser(userId, instanceId);
        const reasons = getWebhookNotReadyReasons(pub);
        res.status(400).json({
          error:
            'O teste só corre depois de guardar o webhook com URL, ativo e segredo. Ajuste no painel (secção Webhook) e tente de novo.',
          reasons: reasons.length > 0 ? reasons : ['Verifique a configuração no painel desta instância.'],
        });
        return;
      }
      const payload: WhatsAppIncomingMessageEvent = {
        messageId: 'webhook_test',
        from: '5511999999999@s.whatsapp.net',
        to: 'Teste',
        timestamp: new Date().toISOString(),
        text: 'Mensagem de teste do webhook (WhatsAppConnect)',
        userId,
        instanceId,
      };
      const response = await webhookDispatcher.deliverTest(config.url, config.secret, payload);
      res.json({ ok: response.ok, status: response.status });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
