import { z } from 'zod';

export const forgotPasswordBodySchema = z.object({
  email: z.string().email('E-mail inválido'),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1, 'Token em falta'),
  password: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .max(128, 'Senha muito longa'),
});
