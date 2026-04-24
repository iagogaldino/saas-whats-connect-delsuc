import type { NextFunction, Request, Response } from 'express';
import { recordApiKeyRequestLog } from '../services/apiRequestLog.service';
import '../types/express-augment';

function getRequestPath(req: Request): string {
  return req.originalUrl.split('?')[0] || req.path || '/';
}

function sanitizeHeaders(headers: Request['headers']): Record<string, string> {
  const maskedHeaderNames = new Set(['authorization', 'cookie', 'set-cookie']);
  const out: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(headers)) {
    const key = rawKey.toLowerCase();
    if (!rawValue) continue;
    if (maskedHeaderNames.has(key)) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = Array.isArray(rawValue) ? rawValue.join(', ') : String(rawValue);
  }

  return out;
}

export function apiKeyRequestAudit(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on('finish', () => {
    if (req.auth?.method !== 'apiKey' || !req.auth.apiKeyId || !req.user?.id) {
      return;
    }

    void recordApiKeyRequestLog({
      userId: req.user.id,
      instanceId: req.instance?.id,
      apiKeyId: req.auth.apiKeyId,
      method: req.method,
      path: getRequestPath(req),
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestHeaders: sanitizeHeaders(req.headers),
      durationMs: Date.now() - startedAt,
    }).catch(() => {
      /* não impacta resposta se auditoria falhar */
    });
  });

  next();
}
