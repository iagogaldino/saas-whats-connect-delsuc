import { Router } from 'express';
import path from 'path';
import { rm } from 'fs/promises';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { requireJwt } from '../middleware/requireJwt';
import type { IWhatsAppSessionService } from '../whatsapp';
import { loadWhatsappRuntimeConfig, resolveBaseDataPathAbsolute } from '../whatsapp/whatsapp.config';
import { createInstance, listInstancesForUser, removeInstanceCascade } from '../services/instance.service';

const createInstanceBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});

export function createInstancesRouter(whatsappSessions: IWhatsAppSessionService): Router {
  const router = Router();

  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const items = await listInstancesForUser(req.user!.id);
      res.json({ items });
    } catch (e) {
      next(e);
    }
  });

  router.post('/', requireAuth, async (req, res, next) => {
    try {
      const parsed = createInstanceBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return next(parsed.error);
      }
      const created = await createInstance(req.user!.id, parsed.data.name);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  });

  router.delete('/:instanceId', requireAuth, requireJwt, async (req, res, next) => {
    const userId = req.user!.id;
    const instanceRef = req.params.instanceId;
    try {
      const removed = await removeInstanceCascade(userId, instanceRef);
      await whatsappSessions.destroySession(userId, removed.id).catch(() => {});
      const baseDataPath = resolveBaseDataPathAbsolute(
        process.cwd(),
        loadWhatsappRuntimeConfig().baseDataPath
      );
      const sessionPath = path.join(baseDataPath, userId, removed.id);
      await rm(sessionPath, { recursive: true, force: true }).catch(() => {});
      res.status(200).json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
