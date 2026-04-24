import nodemailer from 'nodemailer';
import { createLogger } from '../config/logger';

const log = createLogger();

let transporter: nodemailer.Transporter | null = null;

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.MAIL_FROM?.trim());
}

function getTransporter(): nodemailer.Transporter {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP não configurado');
  }
  if (!transporter) {
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!.trim(),
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true',
      auth: user && pass ? { user, pass } : undefined,
    });
  }
  return transporter;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const from = process.env.MAIL_FROM!.trim();
  const t = getTransporter();
  await t.sendMail({
    from,
    to,
    subject: 'Redefinição de senha — WhatsApp Connect',
    text: `Recebeu este e-mail porque foi pedida a redefinição da senha da sua conta.

Abra a ligação abaixo (válida por um tempo limitado). Se não foi você, ignore este e-mail.

${resetUrl}
`,
    html: `<p>Recebeu este e-mail porque foi pedida a redefinição da senha da sua conta.</p>
<p><a href="${resetUrl}">Redefinir senha</a></p>
<p>Se não foi você, ignore este e-mail.</p>`,
  });
  log.info({ to }, 'E-mail de recuperação de senha enviado');
}
