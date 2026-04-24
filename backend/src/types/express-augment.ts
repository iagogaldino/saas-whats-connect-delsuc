/** Amplia `Request` para o ts-node carregar junto com os middlewares (ver import em `requireAuth.ts`). */
declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; email: string };
    instance?: {
      id: string;
      name: string;
      code: string;
      realtimeListeningEnabled: boolean;
      createdAt: string;
      updatedAt: string;
    };
    auth?: {
      method: 'jwt' | 'apiKey';
      apiKeyId?: string;
    };
  }
}

export {};
