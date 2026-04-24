import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { requireInstanceAccess } from '../middleware/requireInstanceAccess';
import { listForUser } from '../services/sentMessage.service';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export function createMessagesRouter(): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth, requireInstanceAccess);

  router.get('/', async (req, res, next) => {
    try {
      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        return next(parsed.error);
      }
      const { page, limit } = parsed.data;
      const result = await listForUser(req.user!.id, req.instance!.id, { page, limit });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
