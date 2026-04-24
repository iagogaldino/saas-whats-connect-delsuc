import { z } from 'zod';

export const mercadopagoPixPaymentRequestSchema = z.object({
  payer: z
    .object({
      identification: z
        .object({
          type: z.string().min(1),
          number: z.string().min(1),
        })
        .optional(),
    })
    .optional(),
});

export type MercadopagoPixPaymentRequest = z.infer<typeof mercadopagoPixPaymentRequestSchema>;

export const mercadopagoPaymentIdBodySchema = z.object({
  paymentId: z.string().min(1),
});

export type MercadopagoPaymentIdBody = z.infer<typeof mercadopagoPaymentIdBodySchema>;
