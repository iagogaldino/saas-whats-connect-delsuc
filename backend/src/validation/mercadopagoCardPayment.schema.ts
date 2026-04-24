import { z } from 'zod';

/** Payload do Card Payment Brick (@mercadopago/sdk-react) → API de pagamentos. */
export const mercadopagoCardPaymentRequestSchema = z.object({
  token: z.string().min(1),
  payment_method_id: z.string().min(1),
  issuer_id: z.string().optional(),
  transaction_amount: z.coerce.number().positive(),
  installments: z.coerce.number().int().min(1).max(24),
  payer: z.object({
    email: z.string().email().optional(),
    identification: z
      .object({
        type: z.string(),
        number: z.string(),
      })
      .optional(),
  }),
});

export type MercadopagoCardPaymentRequest = z.infer<typeof mercadopagoCardPaymentRequestSchema>;
