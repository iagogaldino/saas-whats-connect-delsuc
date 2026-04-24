import mongoose from 'mongoose';
import { createLogger } from '../config/logger';
import { AppError } from '../errors/AppError';
import type { MercadopagoCardPaymentRequest } from '../validation/mercadopagoCardPayment.schema';
import type { MercadopagoPixPaymentRequest } from '../validation/mercadopagoPixPayment.schema';
import { setUserPlanPaid } from './billing.service';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import type { PaymentCreateRequest } from 'mercadopago/dist/clients/payment/create/types';

const log = createLogger().child({ module: 'mercadopago' });

const PLAN_TITLE = 'Plano pago — WhatsApp Connect';
export const PLAN_AMOUNT = 20;

function isChargedAmountPlanPrice(amount: number | undefined | null): boolean {
  if (amount === undefined || amount === null || !Number.isFinite(amount)) {
    return false;
  }
  return Math.abs(amount - PLAN_AMOUNT) <= 0.001;
}

function getAccessToken(): string {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!t) {
    throw new AppError('Mercado Pago não configurado (MERCADOPAGO_ACCESS_TOKEN).', 503);
  }
  return t;
}

function client(): MercadoPagoConfig {
  return new MercadoPagoConfig({ accessToken: getAccessToken() });
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim());
}

/** URL pública do webhook (PIX/cartão) para o Mercado Pago notificar aprovações. */
export function getMercadopagoNotificationUrl(): string | undefined {
  const base = process.env.API_PUBLIC_URL?.trim();
  if (!base) return undefined;
  return `${base.replace(/\/$/, '')}/api/v1/payments/mercadopago/webhook`;
}

function parsePaymentId(raw: string | number | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function mercadoPagoFailureMessage(e: unknown): string {
  if (e instanceof Error) return e.message.slice(0, 500);
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message.slice(0, 500);
    const cause = o.cause as Record<string, unknown> | undefined;
    if (cause && typeof cause === 'object') {
      const m = (cause as { message?: string }).message;
      if (typeof m === 'string') return m.slice(0, 500);
    }
  }
  return 'Falha ao comunicar com o Mercado Pago.';
}

/**
 * Checkout transparente: cria pagamento com token do Card Payment Brick e, se aprovado, ativa o plano.
 */
export async function createCardPaymentTransparent(
  userId: string,
  body: MercadopagoCardPaymentRequest,
  opts: { payerEmail: string }
): Promise<{ paymentId: string; status: string }> {
  if (Math.abs(body.transaction_amount - PLAN_AMOUNT) > 0.001) {
    throw new AppError('Valor do pagamento inválido.', 400);
  }

  const email = (body.payer.email?.trim() || opts.payerEmail.trim());
  if (!email) {
    throw new AppError('Email do pagador em falta.', 400);
  }

  const paymentApi = new Payment(client());

  const issuerIdNum =
    body.issuer_id && String(body.issuer_id).trim().length > 0
      ? Number(body.issuer_id)
      : undefined;

  const mpBody: PaymentCreateRequest = {
    transaction_amount: PLAN_AMOUNT,
    token: body.token,
    description: PLAN_TITLE,
    installments: body.installments,
    payment_method_id: body.payment_method_id,
    payer: {
      email,
      ...(body.payer.identification
        ? {
            identification: {
              type: body.payer.identification.type,
              number: body.payer.identification.number.replace(/\D/g, ''),
            },
          }
        : {}),
    },
    external_reference: userId,
    statement_descriptor: 'WHATSAPP',
    binary_mode: true,
    three_d_secure_mode: 'optional',
    ...(issuerIdNum !== undefined && Number.isFinite(issuerIdNum) ? { issuer_id: issuerIdNum } : {}),
  };

  let pay: unknown;
  try {
    pay = await paymentApi.create({ body: mpBody as PaymentCreateRequest });
  } catch (e) {
    log.error({ err: e }, 'Mercado Pago: falha ao criar pagamento (transparente)');
    throw new AppError(mercadoPagoFailureMessage(e), 502);
  }

  const p = pay as {
    id?: number | string;
    status?: string;
    status_detail?: string;
    date_approved?: string | null;
    transaction_amount?: number;
    currency_id?: string;
  };

  const idStr = p.id != null ? String(p.id) : '';
  if (!idStr) {
    throw new AppError('Resposta inválida do Mercado Pago.', 502);
  }

  if (p.status === 'approved') {
    const payAny = p as {
      date_approved?: string;
      date_last_updated?: string;
      date_created?: string;
      transaction_amount?: number;
      currency_id?: string;
    };
    if (!isChargedAmountPlanPrice(payAny.transaction_amount)) {
      log.error(
        { idStr, got: payAny.transaction_amount, expected: PLAN_AMOUNT },
        'Mercado Pago: valor cobrado na resposta não coincide com o plano'
      );
      throw new AppError(
        `Resposta de pagamento inválida: valor cobrado diferente de R$ ${PLAN_AMOUNT},00.`,
        502
      );
    }
    const approvedAt = payAny.date_approved
      ? new Date(payAny.date_approved)
      : payAny.date_last_updated
        ? new Date(payAny.date_last_updated)
        : payAny.date_created
          ? new Date(payAny.date_created)
          : new Date();
    const amount = payAny.transaction_amount as number;
    const currency = payAny.currency_id?.trim() || 'BRL';
    const ok = await setUserPlanPaid(userId, approvedAt, {
      source: 'mercadopago',
      externalId: idStr,
      amount,
      currency,
    });
    if (!ok) {
      throw new AppError('Utilizador não encontrado', 404);
    }
    return { paymentId: idStr, status: 'approved' };
  }

  const detail = p.status_detail ? ` (${p.status_detail})` : '';
  throw new AppError(
    `Pagamento não aprovado: ${p.status ?? 'desconhecido'}${detail}. Tente outro cartão ou meio.`,
    402
  );
}

export type CreatePixPaymentResult = {
  paymentId: string;
  status: string;
} & (
  | { phase: 'activated'; planActivated: true }
  | {
      phase: 'pending';
      planActivated: false;
      qrCode: string;
      qrCodeBase64: string | null;
      ticketUrl: string | null;
      dateOfExpiration: string | null;
    }
);

/**
 * PIX (QR estático / Copia e Cola): cria pagamento `payment_method_id: pix` — normalmente fica `pending` até o utilizador pagar.
 */
export async function createPixPayment(
  userId: string,
  body: MercadopagoPixPaymentRequest,
  opts: { payerEmail: string }
): Promise<CreatePixPaymentResult> {
  const email = (opts.payerEmail || '').trim();
  if (!email) {
    throw new AppError('Email do pagador em falta.', 400);
  }

  const idDoc = body.payer?.identification;
  const paymentApi = new Payment(client());
  const notificationUrl = getMercadopagoNotificationUrl();

  const dateOfExp = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const mpBody: PaymentCreateRequest = {
    transaction_amount: PLAN_AMOUNT,
    description: PLAN_TITLE,
    payment_method_id: 'pix',
    date_of_expiration: dateOfExp,
    external_reference: userId,
    payer: {
      email,
      ...(idDoc
        ? {
            identification: {
              type: idDoc.type,
              number: idDoc.number.replace(/\D/g, ''),
            },
          }
        : {}),
    },
    ...(notificationUrl ? { notification_url: notificationUrl } : {}),
  };

  let pay: unknown;
  try {
    pay = await paymentApi.create({ body: mpBody as PaymentCreateRequest });
  } catch (e) {
    log.error({ err: e }, 'Mercado Pago: falha ao criar pagamento PIX');
    throw new AppError(mercadoPagoFailureMessage(e), 502);
  }

  const p = pay as {
    id?: number | string;
    status?: string;
    status_detail?: string;
    transaction_amount?: number;
    point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
    date_of_expiration?: string;
  };

  const idStr = p.id != null ? String(p.id) : '';
  if (!idStr) {
    throw new AppError('Resposta inválida do Mercado Pago.', 502);
  }

  if (p.status === 'approved') {
    if (!isChargedAmountPlanPrice(p.transaction_amount)) {
      log.error(
        { idStr, got: p.transaction_amount, expected: PLAN_AMOUNT },
        'Mercado Pago PIX: valor na resposta não confere com o plano'
      );
      throw new AppError(
        `Resposta de pagamento inválida: valor cobrado diferente de R$ ${PLAN_AMOUNT},00.`,
        502
      );
    }
    const payAny = pay as {
      date_approved?: string;
      date_last_updated?: string;
      date_created?: string;
      transaction_amount?: number;
      currency_id?: string;
    };
    const approvedAt = payAny.date_approved
      ? new Date(payAny.date_approved)
      : payAny.date_last_updated
        ? new Date(payAny.date_last_updated)
        : payAny.date_created
          ? new Date(payAny.date_created)
          : new Date();
    const amount = payAny.transaction_amount as number;
    const currency = payAny.currency_id?.trim() || 'BRL';
    const ok = await setUserPlanPaid(userId, approvedAt, {
      source: 'mercadopago',
      externalId: idStr,
      amount,
      currency,
    });
    if (!ok) {
      throw new AppError('Utilizador não encontrado', 404);
    }
    return { paymentId: idStr, status: 'approved', phase: 'activated', planActivated: true };
  }

  if (p.status === 'pending') {
    const td = p.point_of_interaction?.transaction_data;
    const qrCode = typeof td?.qr_code === 'string' ? td.qr_code : '';
    if (!qrCode) {
      log.error({ idStr, pay: p }, 'Mercado Pago PIX: resposta pending sem QR');
      throw new AppError('PIX gerado, mas o QR não veio na resposta. Tente de novo em instantes.', 502);
    }
    const b64 = typeof td?.qr_code_base64 === 'string' && td.qr_code_base64.length > 0 ? td.qr_code_base64 : null;
    const ticket = typeof td?.ticket_url === 'string' && td.ticket_url.length > 0 ? td.ticket_url : null;
    return {
      paymentId: idStr,
      status: 'pending',
      phase: 'pending',
      planActivated: false,
      qrCode,
      qrCodeBase64: b64,
      ticketUrl: ticket,
      dateOfExpiration: p.date_of_expiration ?? null,
    };
  }

  const detail = p.status_detail ? ` (${p.status_detail})` : '';
  throw new AppError(
    `Não foi possível gerar o PIX: ${p.status ?? 'desconhecido'}${detail}.`,
    400
  );
}

/**
 * Busca o pagamento e, se aprovado, ativa o plano (webhook / confirmação auxiliar).
 */
export async function activatePlanIfPaymentApproved(
  paymentId: string,
  expectedUserId?: string
): Promise<{ activated: boolean; reason?: string }> {
  const id = parsePaymentId(paymentId);
  if (!id) {
    return { activated: false, reason: 'missing_id' };
  }

  const paymentApi = new Payment(client());
  const pay = await paymentApi.get({ id });

  if (pay.status !== 'approved') {
    return { activated: false, reason: `status_${pay.status ?? 'unknown'}` };
  }

  const ext = pay.external_reference?.trim();
  if (!ext || !mongoose.Types.ObjectId.isValid(ext)) {
    return { activated: false, reason: 'invalid_external_reference' };
  }

  if (expectedUserId !== undefined && ext !== expectedUserId) {
    return { activated: false, reason: 'user_mismatch' };
  }

  if (!isChargedAmountPlanPrice(pay.transaction_amount)) {
    log.warn(
      { id, got: pay.transaction_amount, expected: PLAN_AMOUNT },
      'Mercado Pago: webhook/get — valor não confere com o plano, plano não ativado'
    );
    return { activated: false, reason: 'amount_mismatch' };
  }

  const payAny = pay as {
    date_approved?: string;
    date_last_updated?: string;
    date_created?: string;
    transaction_amount?: number;
    currency_id?: string;
  };
  const approvedAt = payAny.date_approved
    ? new Date(payAny.date_approved)
    : payAny.date_last_updated
      ? new Date(payAny.date_last_updated)
      : payAny.date_created
        ? new Date(payAny.date_created)
        : new Date();
  const amount = payAny.transaction_amount as number;
  const currency = payAny.currency_id?.trim() || 'BRL';
  const ok = await setUserPlanPaid(ext, approvedAt, {
    source: 'mercadopago',
    externalId: id,
    amount,
    currency,
  });
  if (!ok) {
    return { activated: false, reason: 'user_not_found' };
  }
  return { activated: true };
}

/**
 * Consulta o pagamento e tenta ativar o plano se já estiver aprovado (polling após gerar o QR PIX).
 */
export async function syncUserMercadoPagoPayment(
  userId: string,
  paymentId: string
): Promise<{ activated: boolean; status: string; reason?: string }> {
  const r = await activatePlanIfPaymentApproved(paymentId, userId);
  if (r.activated) {
    return { activated: true, status: 'approved' };
  }
  if (r.reason === 'user_mismatch' || r.reason === 'invalid_external_reference') {
    throw new AppError('Este pagamento não pertence à sua conta ou é inválido.', 403);
  }

  const id = parsePaymentId(paymentId);
  if (!id) {
    return { activated: false, status: 'unknown', reason: r.reason };
  }
  const paymentApi = new Payment(client());
  const pay = await paymentApi.get({ id });
  return { activated: false, status: pay.status ?? 'unknown', reason: r.reason };
}

export function extractPaymentIdFromWebhook(req: {
  body?: unknown;
  query: Record<string, unknown>;
}): string | null {
  const q = req.query;
  const topic = typeof q.topic === 'string' ? q.topic : '';
  const typeQ = typeof q.type === 'string' ? q.type : '';
  const idQuery = q.id ?? q['data.id'];
  if (
    (topic === 'payment' || typeQ === 'payment') &&
    (typeof idQuery === 'string' || typeof idQuery === 'number')
  ) {
    return parsePaymentId(idQuery);
  }

  const b = req.body as Record<string, unknown> | undefined;
  if (!b || typeof b !== 'object') return null;

  const data = b.data as Record<string, unknown> | undefined;
  if (data && 'id' in data) {
    const pid = parsePaymentId(data.id as string | number);
    if (pid) return pid;
  }

  if (typeof b.id === 'string' || typeof b.id === 'number') {
    return parsePaymentId(b.id);
  }

  return null;
}
