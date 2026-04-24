import { z } from 'zod';

const isProd = process.env.NODE_ENV === 'production';

function webhookUrlRefine(s: string): boolean {
  const t = s.trim();
  if (t.length === 0) return true;
  try {
    const u = new URL(t);
    if (u.protocol === 'https:') return true;
    if (u.protocol === 'http:') {
      if (isProd) {
        return process.env.WEBHOOK_INSECURE_HTTP === '1';
      }
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export const setWebhookBodySchema = z.object({
  url: z
    .string()
    .max(2048)
    .refine(webhookUrlRefine, 'URL inválida ou, em produção, use HTTPS (ou WEBHOOK_INSECURE_HTTP=1 para testes)'),
  enabled: z.boolean(),
  regenerateSecret: z.boolean().optional(),
});

export type SetWebhookBody = z.infer<typeof setWebhookBodySchema>;
