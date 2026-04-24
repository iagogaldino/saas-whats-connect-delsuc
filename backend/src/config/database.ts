import mongoose from 'mongoose';
import type { Logger } from 'pino';

export async function connectDatabase(uri: string, log: Logger): Promise<void> {
  await mongoose.connect(uri);
  log.info('MongoDB conectado');
}
