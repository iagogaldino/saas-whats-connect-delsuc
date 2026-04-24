import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError';
import '../types/express-augment';

function getBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice(7).trim();
}

/** Apenas JWT de sessão (login). Chaves de API (`otp_…`) são rejeitadas — p.ex. gestão de chaves, escuta em tempo real (listening). Listar/criar instâncias e WhatsApp usam `requireAuth` (JWT ou API key). */
export function requireJwt(req: Request, _res: Response, next: NextFunction): void {
  void (() => {
    try {
      const token = getBearer(req);
      if (!token) {
        next(new AppError('Token de autenticação ausente', 401));
        return;
      }
      if (token.startsWith('otp_')) {
        next(
          new AppError(
            'Esta rota exige o token de sessão (login). Chaves de API não podem ser usadas aqui.',
            401
          )
        );
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
      } catch {
        next(new AppError('Token de sessão inválido ou expirado', 401));
      }
    } catch (e) {
      next(e);
    }
  })();
}
