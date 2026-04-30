import { z } from 'zod';

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

export const sendMediaBodySchema = z.object({
  phoneNumber: z
    .string()
    .transform((s) => digitsOnly(s))
    .pipe(
      z
        .string()
        .regex(/^\d{10,15}$/, 'phoneNumber deve conter 10 a 15 dígitos (DDI + número)')
    ),
  caption: z
    .string()
    .trim()
    .max(200, 'caption deve ter no máximo 200 caracteres')
    .optional(),
});

export type SendMediaBody = z.infer<typeof sendMediaBodySchema>;
