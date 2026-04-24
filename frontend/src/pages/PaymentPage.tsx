import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PaymentHistoryPanel } from '../components/dashboard/PaymentHistoryPanel';
import { PaymentCheckoutForm } from '../components/dashboard/PaymentCheckoutForm';
import { useAuth } from '../context/AuthContext';

function formatPlanEndUtc(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

export function PaymentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [paymentHistoryKey, setPaymentHistoryKey] = useState(0);
  const legacyPaymentId = searchParams.get('payment_id');

  /** Limpa `?payment_id=` de URLs antigas (fluxo Checkout Pro). */
  useEffect(() => {
    if (!legacyPaymentId) return;
    void navigate({ pathname: '/app/pagamento', search: '' }, { replace: true });
  }, [legacyPaymentId, navigate]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="border-b border-outline-variant/10 pb-4">
        <h1 className="text-on-surface text-2xl font-bold tracking-tight">Plano e pagamento</h1>
        {user?.plan === 'paid' && user.planExpiresAt && (
          <p className="text-outline mt-2 text-sm" role="status">
            O seu plano pago termina a{' '}
            <span className="text-on-surface font-medium">
              {formatPlanEndUtc(user.planExpiresAt)} (UTC)
            </span>
            .
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-surface-container-lowest border-outline-variant/10 flex flex-col rounded-xl border p-6 shadow-sm">
          <p className="text-outline text-xs font-bold uppercase tracking-widest">Grátis</p>
          <p className="text-on-surface mt-2 text-3xl font-bold">
            R$ 0
            <span className="text-outline ml-1 text-sm font-normal">/mês</span>
          </p>
          <p className="text-outline mt-2 text-sm">Ideal para testar a API e o painel.</p>
          <ul className="text-on-surface mt-4 space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="text-tertiary material-symbols-outlined text-lg">check_circle</span>
              <span>Até 20 envios com sucesso por dia (UTC, todas as instâncias)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-tertiary material-symbols-outlined text-lg">check_circle</span>
              <span>Instâncias, webhooks e encaminhamento de mensagens</span>
            </li>
          </ul>
        </div>

        <div className="bg-surface-container-lowest border-primary/40 flex flex-col rounded-xl border-2 p-6 shadow-sm ring-1 ring-primary/15">
          <p className="text-primary text-xs font-bold uppercase tracking-widest">Pago</p>
          <p className="text-on-surface mt-2 text-3xl font-bold">
            R$ 20
            <span className="text-outline ml-1 text-sm font-normal">/mês</span>
          </p>
          <p className="text-outline mt-2 text-sm">Produção e volume sem teto diário de envios.</p>
          <ul className="text-on-surface mt-4 space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="text-primary material-symbols-outlined text-lg">all_inclusive</span>
              <span>Assinatura mensal — o mesmo preço anunciado na página inicial</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary material-symbols-outlined text-lg">send</span>
              <span>Sem o limite diário de 20 envios do plano grátis</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary material-symbols-outlined text-lg">support_agent</span>
              <span>Prioridade no acompanhamento (conforme disponibilidade)</span>
            </li>
          </ul>
        </div>
      </div>

      <PaymentCheckoutForm
        onPlanActivated={() => setPaymentHistoryKey((k) => k + 1)}
      />

      <PaymentHistoryPanel key={paymentHistoryKey} />

      <p className="text-outline text-center text-xs">
        Dúvidas?{' '}
        <a
          href="https://wa.me/74988420307"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary font-medium hover:underline"
        >
          Fale conosco no WhatsApp
        </a>
        .{' '}
      </p>
    </div>
  );
}
