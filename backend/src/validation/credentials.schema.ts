import { z } from 'zod';

export const credentialsBodySchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .max(128, 'Senha muito longa'),
});

export type CredentialsBody = z.infer<typeof credentialsBodySchema>;
