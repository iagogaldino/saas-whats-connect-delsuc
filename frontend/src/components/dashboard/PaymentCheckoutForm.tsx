import { type ComponentProps, useCallback, useEffect, useState } from 'react';
import { CardPayment } from '@mercadopago/sdk-react';
import QRCode from 'react-qr-code';
import { useAuth } from '../../context/AuthContext';
import { formatCpf, isValidCpf } from '../../lib/cardValidation';
import {
  postMercadopagoCardPayment,
  postMercadopagoPix,
  postMercadopagoSyncPayment,
} from '../../lib/api';

const PLAN_AMOUNT = 20;
const PRICE_LABEL = 'R$ 20,00';

const MP_PUBLIC =
  typeof import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY === 'string' &&
  import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY.trim().length > 0;

const MP_PIX_POLL_MS = 4000;
const MP_PIX_MAX_POLLS = 200;

type PaymentCheckoutFormProps = {
  onPlanActivated?: () => void;
};

export function PaymentCheckoutForm({ onPlanActivated }: PaymentCheckoutFormProps) {
  const { user, refreshUser } = useAuth();
  const [mpSubmitting, setMpSubmitting] = useState(false);
  const [mpPixLoading, setMpPixLoading] = useState(false);
  const [mpPixCpf, setMpPixCpf] = useState('');
  const [mpPixPending, setMpPixPending] = useState<{
    paymentId: string;
    qrCode: string;
    qrCodeBase64: string | null;
  } | null>(null);
  const [mpPixCopyFeedback, setMpPixCopyFeedback] = useState(false);
  const [mpPixInfo, setMpPixInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justActivated, setJustActivated] = useState(false);
  const [method, setMethod] = useState<'card' | 'pix'>('card');

  const isPaid = user?.plan === 'paid' || justActivated;

  const finishMpPixSuccess = useCallback(async () => {
    await refreshUser();
    onPlanActivated?.();
    setJustActivated(true);
    setMpPixPending(null);
  }, [refreshUser, onPlanActivated]);

  useEffect(() => {
    if (!mpPixPending || isPaid) return;
    const pid = mpPixPending.paymentId;
    let cancelled = false;
    let ticks = 0;
    const id = window.setInterval(() => {
      if (cancelled) return;
      ticks += 1;
      if (ticks > MP_PIX_MAX_POLLS) {
        window.clearInterval(id);
        return;
      }
      void (async () => {
        try {
          const r = await postMercadopagoSyncPayment(pid);
          if (r.activated) {
            window.clearInterval(id);
            if (!cancelled) void finishMpPixSuccess();
          }
        } catch (e) {
          const st = e && typeof e === 'object' && 'status' in e ? (e as { status: number }).status : 0;
          if (st === 403) {
            window.clearInterval(id);
            if (!cancelled) {
              setError('Não é possível validar este pagamento nesta sessão.');
              setMpPixPending(null);
            }
          }
        }
      })();
    }, MP_PIX_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [mpPixPending, isPaid, finishMpPixSuccess]);

  async function handleMercadoPagoPix() {
    setMpPixLoading(true);
    setError(null);
    setMpPixInfo(null);
    try {
      const idDigits = mpPixCpf.replace(/\D/g, '');
      const res = await postMercadopagoPix(
        idDigits.length === 11 && isValidCpf(idDigits)
          ? { payer: { identification: { type: 'CPF', number: idDigits } } }
          : {}
      );
      if (res.phase === 'activated') {
        await refreshUser();
        onPlanActivated?.();
        setJustActivated(true);
        setMpPixPending(null);
        return;
      }
      if (res.phase === 'pending') {
        setMpPixPending({
          paymentId: res.paymentId,
          qrCode: res.qrCode,
          qrCodeBase64: res.qrCodeBase64,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar o PIX com o Mercado Pago.');
    } finally {
      setMpPixLoading(false);
    }
  }

  async function handleMpPixCheckNow() {
    if (!mpPixPending) return;
    setError(null);
    setMpPixInfo(null);
    try {
      const r = await postMercadopagoSyncPayment(mpPixPending.paymentId);
      if (r.activated) {
        await finishMpPixSuccess();
        return;
      }
      if (r.status === 'pending') {
        setMpPixInfo(
          'Pagamento ainda em análise. Quando o banco aprovar, o plano ativa automaticamente; pode voltar a tocar em «Verificar».'
        );
        return;
      }
      setError('O pagamento ainda não consta como aprovado. Tente de novo em instantes ou contacte o suporte se persistir.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível verificar o pagamento.');
    }
  }

  function handleCopyMpPix() {
    if (!mpPixPending) return;
    void navigator.clipboard.writeText(mpPixPending.qrCode).then(() => {
      setMpPixCopyFeedback(true);
      window.setTimeout(() => setMpPixCopyFeedback(false), 2000);
    });
  }

  function pixImageSrc(b64: string | null): string | null {
    if (!b64) return null;
    return b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
  }

  async function handleCardBrickSubmit(
    formData: Parameters<NonNullable<ComponentProps<typeof CardPayment>['onSubmit']>>[0]
  ) {
    setMpSubmitting(true);
    setError(null);
    try {
      await postMercadopagoCardPayment({
        token: formData.token,
        payment_method_id: formData.payment_method_id,
        issuer_id: formData.issuer_id,
        transaction_amount: formData.transaction_amount,
        installments: formData.installments,
        payer: {
          email: formData.payer?.email,
          identification: formData.payer?.identification
            ? {
                type: String(formData.payer.identification.type),
                number: String(formData.payer.identification.number),
              }
            : undefined,
        },
      });
      await refreshUser();
      onPlanActivated?.();
      setJustActivated(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Não foi possível processar o pagamento. Verifique o cartão e tente de novo.'
      );
      throw e;
    } finally {
      setMpSubmitting(false);
    }
  }

  if (isPaid) {
    return (
      <div className="bg-surface-container-lowest border-primary/30 rounded-xl border-2 p-6 shadow-sm">
        <h2 className="text-on-surface text-lg font-bold">Plano pago ativo</h2>
        <p className="text-outline mt-2 text-sm">
          Obrigado — a sua conta já está no plano pago. Pode usar o serviço com calma; não precisa de
          fazer mais nada nesta página.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border-outline-variant/10 rounded-xl border p-6 shadow-sm">
      <h2 className="text-on-surface text-lg font-bold">Pagamento do plano — {PRICE_LABEL} /mês</h2>
      <p className="text-outline mt-1 text-sm">
        Escolha o meio (Mercado Pago). Necessita da chave pública no front e do token de acesso no
        servidor.
      </p>

      {error && (
        <p className="text-error bg-error/10 mt-4 rounded-lg px-3 py-2 text-sm" role="alert">
          {error}
        </p>
      )}

      {!MP_PUBLIC && (
        <p className="text-outline mt-4 text-sm">
          Defina <code className="text-on-surface">VITE_MERCADOPAGO_PUBLIC_KEY</code> no ambiente do
          front, <code className="text-on-surface">MERCADOPAGO_ACCESS_TOKEN</code> e{' '}
          <code className="text-on-surface">API_PUBLIC_URL</code> (opcional, para webhook) no back, e
          reinicie o servidor.
        </p>
      )}

      {MP_PUBLIC && (
        <div className="text-on-surface mt-6">
          <p className="text-on-surface text-sm font-semibold">Como deseja pagar?</p>
          <div className="mt-2 flex border-b border-outline-variant/20">
            <button
              type="button"
              onClick={() => {
                setMethod('card');
                setError(null);
              }}
              className={`hover:text-on-surface -mb-px flex-1 border-b-2 py-2.5 text-sm font-semibold transition-colors ${
                method === 'card' ? 'border-primary text-primary' : 'text-outline border-transparent'
              }`}
            >
              Cartão
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('pix');
                setError(null);
              }}
              className={`hover:text-on-surface -mb-px flex-1 border-b-2 py-2.5 text-sm font-semibold transition-colors ${
                method === 'pix' ? 'border-primary text-primary' : 'text-outline border-transparent'
              }`}
            >
              PIX
            </button>
          </div>

          {method === 'card' && (
            <div
              className={
                'border-outline-variant/20 mt-4 rounded-xl border bg-white p-3 ' +
                (mpSubmitting ? 'pointer-events-none opacity-70' : '')
              }
            >
              {user?.email && (
                <CardPayment
                  locale="pt-BR"
                  initialization={{ amount: PLAN_AMOUNT, payer: { email: user.email } }}
                  onSubmit={handleCardBrickSubmit}
                />
              )}
              {!user?.email && (
                <p className="text-outline text-sm">Sessão sem email; não é possível carregar o brick.</p>
              )}
            </div>
          )}

          {method === 'pix' && (
            <div
              className={
                'border-outline-variant/20 mt-4 rounded-xl border bg-white p-4 ' +
                (mpPixLoading ? 'pointer-events-none opacity-70' : '')
              }
            >
              <p className="text-outline text-xs">
                Gere o QR, pague com a aplicação do banco. O plano ativa sozinho (ou toque em
                verificar) quando o MP confirmar. Configure <code>API_PUBLIC_URL</code> no back
                para notificações (webhook).
              </p>
              <div className="mt-3">
                <label className="text-outline mb-1 block text-xs">CPF (opcional, recomendado no Brasil)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={mpPixCpf}
                  onChange={(e) => setMpPixCpf(formatCpf(e.target.value))}
                  className="border-outline-variant/30 focus:ring-primary/30 text-on-surface w-full max-w-sm rounded-lg border bg-white px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
                  placeholder="000.000.000-00"
                  disabled={Boolean(mpPixPending) || isPaid}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleMercadoPagoPix()}
                disabled={mpPixLoading || isPaid || Boolean(mpPixPending)}
                className="bg-primary text-on-primary mt-3 w-full max-w-sm rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {mpPixLoading ? 'A gerar PIX…' : 'Gerar cobrança PIX — ' + PRICE_LABEL + '/mês'}
              </button>
              {mpPixInfo && (
                <p
                  className="text-on-surface bg-primary/10 border-primary/20 mt-3 rounded-lg border px-3 py-2 text-sm"
                  role="status"
                >
                  {mpPixInfo}
                </p>
              )}
              {mpPixPending && (
                <div className="mt-4 space-y-3">
                  <p className="text-outline text-xs">Escaneie o QR ou copie o «Pix copia e cola» abaixo.</p>
                  <div className="bg-slate-50 flex flex-col items-center gap-3 rounded-lg border p-3">
                    {pixImageSrc(mpPixPending.qrCodeBase64) ? (
                      <img
                        src={pixImageSrc(mpPixPending.qrCodeBase64) ?? undefined}
                        alt="QR code PIX"
                        className="max-h-56 w-auto"
                      />
                    ) : (
                      <div className="bg-white p-2">
                        <QRCode value={mpPixPending.qrCode} size={200} level="M" />
                      </div>
                    )}
                    <textarea
                      readOnly
                      className="border-outline-variant/20 text-on-surface w-full rounded border bg-white p-2 font-mono text-[10px] leading-relaxed"
                      rows={3}
                      value={mpPixPending.qrCode}
                    />
                    <div className="flex w-full max-w-md flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleCopyMpPix}
                        className="bg-surface-container-high text-on-surface min-w-0 flex-1 rounded-lg py-2 text-xs font-bold"
                      >
                        {mpPixCopyFeedback ? 'Copiado!' : 'Copiar «Pix copia e cola»'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleMpPixCheckNow()}
                        className="border-primary text-primary min-w-0 flex-1 rounded-lg border-2 py-2 text-xs font-bold"
                      >
                        Verificar pagamento
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
