import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { getOwnedInstanceOrThrow } from '../services/instance.service';
import '../types/express-augment';

export async function requireInstanceAccess(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      next(new AppError('Token de autenticacao ausente', 401));
      return;
    }
    const instanceId = req.params.instanceId;
    if (!instanceId) {
      next(new AppError('instanceId obrigatorio', 400));
      return;
    }
    const instance = await getOwnedInstanceOrThrow(userId, instanceId);
    req.instance = instance;
    next();
  } catch (e) {
    next(e);
  }
}
