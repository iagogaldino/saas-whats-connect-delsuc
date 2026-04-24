import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchBillingSummary, type BillingSummary } from '../../lib/api';

export function BillingUsagePanel() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await fetchBillingSummary();
      setSummary(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar utilização');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, user?.id, user?.plan]);

  const planLabel =
    user?.plan === 'paid' || summary?.plan === 'paid' ? 'Pago' : 'Grátis';

  return (
    <div className="bg-surface-container-lowest border-outline-variant/10 rounded-xl border p-6 shadow-sm">
      <h2 className="text-on-surface text-sm font-bold uppercase tracking-wide">Plano e utilização</h2>
      <p className="text-outline mt-1 text-sm">
        Plano: <span className="text-on-surface font-medium">{planLabel}</span>
        {loading && ' — a carregar…'}
      </p>
      {error && (
        <p className="text-error mt-2 text-sm" role="alert">
          {error}
        </p>
      )}
      {summary && summary.plan === 'free' && (
        <p className="text-on-surface mt-3 text-sm">
          {summary.usedToday}/{summary.freeDailyLimit} envios com sucesso hoje (janela UTC, todas as
          instâncias).
        </p>
      )}
      {summary && summary.plan === 'paid' && (
        <p className="text-outline mt-3 text-sm">
          O plano pago não aplica teto diário. Envios com sucesso hoje (UTC): {summary.usedToday}.
        </p>
      )}
    </div>
  );
}
