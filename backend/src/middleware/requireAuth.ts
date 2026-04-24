import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError';
import { validateApiKey } from '../services/apiKey.service';
import '../types/express-augment';

function getBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice(7).trim();
}

/** JWT de sessão ou chave de API (`otp_…`) no Bearer. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const token = getBearer(req);
      if (!token) {
        next(new AppError('Token de autenticação ausente', 401));
        return;
      }
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        next(new AppError('Servidor mal configurado', 500));
        return;
      }
      try {
        const payload = jwt.verify(token, secret) as { sub: string; email: string };
        req.user = { id: payload.sub, email: payload.email };
        req.auth = { method: 'jwt' };
        next();
        return;
      } catch {
        /* tentar API key */
      }
      const apiUser = await validateApiKey(token);
      if (apiUser) {
        req.user = { id: apiUser.id, email: apiUser.email };
        req.auth = { method: 'apiKey', apiKeyId: apiUser.apiKeyId };
        next();
        return;
      }
      next(new AppError('Token inválido ou expirado', 401));
    } catch (e) {
      next(e);
    }
  })();
}
