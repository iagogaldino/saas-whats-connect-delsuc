import { z } from 'zod';
import { normalizeOutboundChatJid } from '../whatsapp/whatsappMessageMeta';
import { outboundReplyQuoteSchema } from './outboundReply.schema';

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

export const sendCodeBodySchema = z
  .object({
    phoneNumber: z.string().optional(),
    chatJid: z.string().trim().min(3).max(128).optional(),
    message: z
      .string()
      .trim()
      .min(1, 'message não pode ser vazio')
      .max(200, 'message deve ter no máximo 200 caracteres'),
    replyTo: outboundReplyQuoteSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const phone = data.phoneNumber ? digitsOnly(data.phoneNumber) : '';
    const hasPhone = /^\d{10,15}$/.test(phone);
    const hasJid = Boolean(data.chatJid && normalizeOutboundChatJid(data.chatJid));
    if (!hasPhone && !hasJid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe phoneNumber (10–15 dígitos) ou chatJid (@s.whatsapp.net, @lid, @g.us)',
      });
    }
    if (hasPhone && hasJid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Use apenas phoneNumber ou chatJid, não ambos',
      });
    }
  })
  .transform((data) => {
    const phone = data.phoneNumber ? digitsOnly(data.phoneNumber) : '';
    const hasPhone = /^\d{10,15}$/.test(phone);
    return {
      phoneNumber: hasPhone ? phone : undefined,
      chatJid: hasPhone ? undefined : normalizeOutboundChatJid(data.chatJid!.trim())!,
      message: data.message,
      replyTo: data.replyTo,
    };
  });

export type SendCodeBody = z.infer<typeof sendCodeBodySchema>;
