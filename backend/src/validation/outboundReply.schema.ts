import { z } from 'zod';
import { normalizeOutboundChatJid } from '../whatsapp/whatsappMessageMeta';

export const outboundReplyQuoteSchema = z
  .object({
    messageId: z.string().trim().min(1).max(128),
    chatJid: z.string().trim().min(3).max(128),
    participant: z.union([z.string().trim().max(128), z.null()]).optional(),
    text: z.string().trim().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (!normalizeOutboundChatJid(data.chatJid)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'replyTo.chatJid inválido (@s.whatsapp.net, @lid ou @g.us)',
        path: ['chatJid'],
      });
    }
  })
  .transform((data) => ({
    messageId: data.messageId,
    chatJid: normalizeOutboundChatJid(data.chatJid)!,
    ...(data.participant !== undefined ? { participant: data.participant } : {}),
    ...(data.text ? { text: data.text } : {}),
  }));

export function parseOutboundReplyQuote(
  value: unknown
): { ok: true; replyTo: z.infer<typeof outboundReplyQuoteSchema> } | { ok: false; error: string } {
  if (value === undefined || value === null) {
    return { ok: false, error: 'missing' };
  }
  const parsed = outboundReplyQuoteSchema.safeParse(value);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'replyTo inválido';
    return { ok: false, error: msg };
  }
  return { ok: true, replyTo: parsed.data };
}
