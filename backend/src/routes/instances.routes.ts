import { Router } from 'express';
import { z } from 'zod';
import { requireJwt } from '../middleware/requireJwt';
import { createInstance, listInstancesForUser } from '../services/instance.service';

const createInstanceBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});

export function createInstancesRouter(): Router {
  const router = Router();

  router.get('/', requireJwt, async (req, res, next) => {
    try {
      const items = await listInstancesForUser(req.user!.id);
      res.json({ items });
    } catch (e) {
      next(e);
    }
  });

  router.post('/', requireJwt, async (req, res, next) => {
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

  return router;
}
