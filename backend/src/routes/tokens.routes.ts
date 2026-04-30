import mongoose from 'mongoose';
import { Router } from 'express';
import { AppError } from '../errors/AppError';
import { requireJwt } from '../middleware/requireJwt';
import { createApiKey, listApiKeys, revokeApiKey } from '../services/apiKey.service';
import { createApiKeyBodySchema } from '../validation/apiKey.schema';

export function createTokensRouter(): Router {
  const router = Router();

  router.post('/', requireJwt, async (req, res, next) => {
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

  router.get('/', requireJwt, async (req, res, next) => {
    try {
      const items = await listApiKeys(req.user!.id);
      res.json({ items });
    } catch (e) {
      next(e);
    }
  });

  router.delete('/:id', requireJwt, async (req, res, next) => {
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

  return router;
}
