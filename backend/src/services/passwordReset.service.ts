import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { createLogger } from '../config/logger';
import { AppError } from '../errors/AppError';
import { User } from '../models/User';
import { isSmtpConfigured, sendPasswordResetEmail } from './mail.service';

const log = createLogger();
const SALT_ROUNDS = 10;

const isProd = process.env.NODE_ENV === 'production';

function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function resetTtlMs(): number {
  const raw = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES);
  const min = Number.isFinite(raw) && raw > 0 ? raw : 60;
  return min * 60 * 1000;
}

function frontendBaseUrl(): string {
  const u = (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  return u.replace(/\/$/, '');
}

/**
 * Não indica se o e-mail existe. Em dev sem SMTP, regista a URL no log.
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.toLowerCase().trim();
  const user = await User.findOne({ email })
    .select('+passwordResetTokenHash +passwordResetExpiresAt')
    .exec();
  if (!user) {
    return;
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashResetToken(token);
  user.set({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: new Date(Date.now() + resetTtlMs()),
  });
  await user.save();

  const resetUrl = `${frontendBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  if (isSmtpConfigured()) {
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (e) {
      log.error({ err: e, to: user.email }, 'Falha ao enviar e-mail de recuperação');
      user.set({ passwordResetTokenHash: null, passwordResetExpiresAt: null });
      await user.save();
      const msg = isProd
        ? 'Não foi possível enviar o e-mail. Tente mais tarde.'
        : 'Falha ao enviar o e-mail. Verifique o SMTP e o log do servidor.';
      throw new AppError(msg, 503);
    }
  } else if (isProd) {
    user.set({ passwordResetTokenHash: null, passwordResetExpiresAt: null });
    await user.save();
    throw new AppError('Envio de e-mail não está configurado no servidor.', 503);
  } else {
    log.info(
      { to: user.email, resetUrl },
      'Recuperação de senha (dev: SMTP em falta; ligação registada no log)'
    );
  }
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const t = token.trim();
  if (!t) {
    throw new AppError('Token inválido', 400);
  }
  const tokenHash = hashResetToken(t);
  const user = await User.findOne({ passwordResetTokenHash: tokenHash })
    .select('+passwordResetTokenHash +passwordResetExpiresAt +passwordHash')
    .exec();

  if (!user) {
    throw new AppError('Ligação inválida ou expirada. Peça um novo redefinir de senha.', 400);
  }

  const exp = user.passwordResetExpiresAt;
  if (!exp || exp.getTime() < Date.now()) {
    user.set({ passwordResetTokenHash: null, passwordResetExpiresAt: null });
    await user.save();
    throw new AppError('Ligação expirada. Peça um novo redefinir de senha.', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.set({
    passwordHash,
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
  });
  await user.save();
}
