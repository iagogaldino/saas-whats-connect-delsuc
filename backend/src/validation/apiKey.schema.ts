import { z } from 'zod';

export const createApiKeyBodySchema = z.object({
  name: z
    .string()
    .max(80, 'nome deve ter no máximo 80 caracteres')
    .trim()
    .optional(),
});

export type CreateApiKeyBody = z.infer<typeof createApiKeyBodySchema>;
