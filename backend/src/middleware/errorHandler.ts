import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';

export function errorHandler(log: Logger) {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof ZodError) {
      log.warn({ issues: err.flatten() }, 'Validação falhou');
      res.status(400).json({
        error: 'Payload inválido',
        details: err.flatten(),
      });
      return;
    }

    if (err instanceof AppError) {
      if (err.statusCode === 500) {
        log.error({ err: err.message, details: err.details }, 'Erro da aplicação');
      } else {
        log.warn(
          { err: err.message, statusCode: err.statusCode, details: err.details },
          'Erro da aplicação'
        );
      }
      res.status(err.statusCode).json({
        error: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      });
      return;
    }

    log.error({ err }, 'Erro não tratado');
    res.status(500).json({ error: 'Erro interno do servidor' });
  };
}
