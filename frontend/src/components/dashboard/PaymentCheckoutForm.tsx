import { type FormEvent, useState } from 'react';
import QRCode from 'react-qr-code';
import { useAuth } from '../../context/AuthContext';
import {
  formatCardNumber,
  formatExpiry,
  isValidCardExpiry,
  luhnCheck,
} from '../../lib/cardValidation';
import { generateMockPixCopiaECola } from '../../lib/mockPix';
import { postMockCheckout } from '../../lib/api';

const PRICE_LABEL = 'R$ 20,00';

export function PaymentCheckoutForm() {
  const { user, refreshUser } = useAuth();
  const [method, setMethod] = useState<'card' | 'pix'>('card');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [pixCpf, setPixCpf] = useState('');
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justActivated, setJustActivated] = useState(false);

  const isPaid = user?.plan === 'paid' || justActivated;

  async function activatePlan() {
    setLoading(true);
    setError(null);
    try {
      await postMockCheckout();
      await refreshUser();
      setJustActivated(true);
      setPixCode(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Não foi possível concluir. Verifique o servidor (mock billing).'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleCardSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const name = cardName.trim();
    const num = cardNumber.replace(/\D/g, '');
    const exp = expiry.trim();
    if (name.length < 3) {
      setError('Informe o nome como está no cartão.');
      return;
    }
    if (num.length < 15 || num.length > 19 || !luhnCheck(num)) {
      setError('Número do cartão inválido.');
      return;
    }
    if (!isValidCardExpiry(exp)) {
      setError('Data de validade inválida ou cartão expirado.');
      return;
    }
    const cvvDigits = cvv.replace(/\D/g, '');
    if (cvvDigits.length < 3 || cvvDigits.length > 4) {
      setError('CVV inválido.');
      return;
    }
    void activatePlan();
  }

  function handleGeneratePix() {
    setError(null);
    setPixCode(generateMockPixCopiaECola());
    setCopyFeedback(false);
  }

  function handleCopyPix() {
    if (!pixCode) return;
    void navigator.clipboard.writeText(pixCode).then(() => {
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 2000);
    });
  }

  function handlePixConfirm() {
    if (!pixCode) {
      setError('Gere o código PIX antes de confirmar.');
      return;
    }
    setError(null);
    void activatePlan();
  }

  if (isPaid) {
    return (
      <div className="bg-surface-container-lowest border-primary/30 rounded-xl border-2 p-6 shadow-sm">
        <h2 className="text-on-surface text-lg font-bold">Plano pago ativo</h2>
        <p className="text-outline mt-2 text-sm">
          A sua assinatura está ativa. Os dados de cartão e PIX nesta versão eram só para o fluxo de
          ecrã; a cobrança real será ligada a um gateway (cartão) ou PSP (PIX) depois.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border-outline-variant/10 rounded-xl border p-6 shadow-sm">
      <h2 className="text-on-surface text-lg font-bold">Pagamento do plano — {PRICE_LABEL} /mês</h2>
      <p className="text-outline mt-1 text-sm">
        Preencha o cartão ou use PIX. Em produção, os dados seguem cifrados para o adquirente; hoje
        a confirmação final usa o checkout simulado do servidor (quando <code>ENABLE_MOCK_BILLING=1</code>).
      </p>

      <div className="mt-4 flex border-b border-outline-variant/20">
        <button
          type="button"
          onClick={() => {
            setMethod('card');
            setError(null);
          }}
          className={`hover:text-on-surface -mb-px flex-1 border-b-2 py-2.5 text-sm font-semibold transition-colors ${
            method === 'card'
              ? 'border-primary text-primary'
              : 'text-outline border-transparent'
          }`}
        >
          Cartão de crédito
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

      {error && (
        <p className="text-error bg-error/10 mt-4 rounded-lg px-3 py-2 text-sm" role="alert">
          {error}
        </p>
      )}

      {method === 'card' && (
        <form className="mt-6 space-y-4" onSubmit={handleCardSubmit} noValidate>
          <div>
            <label className="text-outline mb-1 block text-xs font-bold uppercase tracking-wider">
              Nome no cartão
            </label>
            <input
              type="text"
              autoComplete="cc-name"
              value={cardName}
              onChange={(e) => setCardName(e.target.value.toUpperCase())}
              className="border-outline-variant/30 focus:ring-primary/30 text-on-surface w-full rounded-lg border bg-white px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
              placeholder="COMO NO CARTÃO"
            />
          </div>
          <div>
            <label className="text-outline mb-1 block text-xs font-bold uppercase tracking-wider">
              Número do cartão
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              className="border-outline-variant/30 focus:ring-primary/30 text-on-surface w-full rounded-lg border bg-white px-3 py-2.5 font-mono text-sm focus:ring-2 focus:outline-none"
              placeholder="0000 0000 0000 0000 (ou 15 díg. Amex)"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-outline mb-1 block text-xs font-bold uppercase tracking-wider">
                Validade
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                className="border-outline-variant/30 focus:ring-primary/30 text-on-surface w-full rounded-lg border bg-white px-3 py-2.5 font-mono text-sm focus:ring-2 focus:outline-none"
                placeholder="MM/AA"
              />
            </div>
            <div>
              <label className="text-outline mb-1 block text-xs font-bold uppercase tracking-wider">
                CVV
              </label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="cc-csc"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="border-outline-variant/30 focus:ring-primary/30 text-on-surface w-full rounded-lg border bg-white px-3 py-2.5 font-mono text-sm focus:ring-2 focus:outline-none"
                placeholder="•••"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-on-primary w-full rounded-xl py-3.5 text-center text-sm font-bold transition-opacity disabled:opacity-50"
          >
            {loading ? 'Processando…' : `Pagar e assinar — ${PRICE_LABEL}/mês`}
          </button>
        </form>
      )}

      {method === 'pix' && (
        <div className="mt-6 space-y-4">
          <div>
            <label className="text-outline mb-1 block text-xs font-bold uppercase tracking-wider">
              CPF (opcional, identificação)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={pixCpf}
              onChange={(e) => setPixCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
              className="border-outline-variant/30 focus:ring-primary/30 text-on-surface w-full rounded-lg border bg-white px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
              placeholder="Para exibir o fluxo (não gera cobrança real ainda)"
            />
          </div>
          <button
            type="button"
            onClick={handleGeneratePix}
            disabled={loading}
            className="border-primary text-primary hover:bg-primary/5 w-full rounded-xl border-2 py-3 text-sm font-bold transition-colors disabled:opacity-50"
          >
            Gerar código PIX
          </button>
          {pixCode && (
            <div className="space-y-3">
              <p className="text-outline text-xs">Escaneie o QR ou copie o código abaixo (demonstração).</p>
              <div className="bg-white flex flex-col items-center justify-center gap-3 rounded-lg border p-4">
                <div className="bg-white p-2">
                  <QRCode value={pixCode} size={180} level="M" />
                </div>
                <textarea
                  readOnly
                  className="border-outline-variant/20 text-on-surface w-full rounded border bg-slate-50 p-2 font-mono text-[10px] leading-relaxed"
                  rows={3}
                  value={pixCode}
                />
                <div className="flex w-full flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="bg-surface-container-high text-on-surface flex-1 rounded-lg py-2 text-xs font-bold"
                  >
                    {copyFeedback ? 'Copiado!' : 'Copiar Pix Copia e Cola'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePixConfirm}
                    disabled={loading}
                    className="bg-primary text-on-primary min-w-[140px] flex-1 rounded-lg py-2 text-xs font-bold disabled:opacity-50"
                  >
                    {loading ? '…' : 'Já paguei — ativar plano'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
