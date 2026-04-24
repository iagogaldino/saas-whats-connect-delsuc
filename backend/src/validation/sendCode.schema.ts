import { z } from 'zod';

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

export const sendCodeBodySchema = z.object({
  phoneNumber: z
    .string()
    .transform((s) => digitsOnly(s))
    .pipe(
      z
        .string()
        .regex(/^\d{10,15}$/, 'phoneNumber deve conter 10 a 15 dígitos (DDI + número)')
    ),
  message: z
    .string()
    .trim()
    .min(1, 'message não pode ser vazio')
    .max(200, 'message deve ter no máximo 200 caracteres'),
});

export type SendCodeBody = z.infer<typeof sendCodeBodySchema>;
