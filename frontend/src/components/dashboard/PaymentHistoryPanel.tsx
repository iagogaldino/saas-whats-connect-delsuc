import { useCallback, useEffect, useState } from 'react';
import { fetchPlanPayments, type PlanPaymentItem } from '../../lib/api';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function sourceLabel(s: PlanPaymentItem['source']): string {
  return s === 'mercadopago' ? 'Mercado Pago' : 'Simulação';
}

function statusLabel(s: PlanPaymentItem['status']): string {
  return s === 'approved' ? 'Aprovado' : s;
}

function formatDateUtc(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' });
  } catch {
    return iso;
  }
}

export function PaymentHistoryPanel() {
  const [items, setItems] = useState<PlanPaymentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetchPlanPayments(p, limit);
        setItems(r.items);
        setTotal(r.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao carregar histórico');
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    void load(page);
  }, [load, page]);

  if (error) {
    return (
      <div className="bg-surface-container-lowest border-outline-variant/10 rounded-xl border p-6 shadow-sm">
        <h2 className="text-on-surface text-sm font-bold uppercase tracking-wide">Histórico de pagamentos</h2>
        <p className="text-error mt-2 text-sm" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!loading && total === 0) {
    return (
      <div className="bg-surface-container-lowest border-outline-variant/10 rounded-xl border p-6 shadow-sm">
        <h2 className="text-on-surface text-sm font-bold uppercase tracking-wide">Histórico de pagamentos</h2>
        <p className="text-outline mt-2 text-sm">
          Ainda não há pagamentos registados. Após o primeiro plano pago, os detalhes aparecem aqui
          (Mercado Pago ou simulação no servidor).
        </p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="bg-surface-container-lowest border-outline-variant/10 rounded-xl border p-6 shadow-sm">
      <h2 className="text-on-surface text-sm font-bold uppercase tracking-wide">Histórico de pagamentos</h2>
      <p className="text-outline mt-1 text-xs">Valores e datas de aprovação; período coberto (UTC) até a data indicada.</p>

      {loading && (
        <p className="text-outline mt-3 text-sm" aria-live="polite">
          A carregar…
        </p>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="text-on-surface w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="text-outline border-outline-variant/20 border-b text-xs font-semibold uppercase">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Origem</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2">Válido até</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-outline-variant/10 border-b last:border-0">
                    <td className="py-2.5 pr-3 align-top">{formatDateUtc(row.approvedAt)}</td>
                    <td className="py-2.5 pr-3 align-top">
                      <span className="text-tertiary inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold">
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 align-top">{sourceLabel(row.source)}</td>
                    <td className="py-2.5 pr-3 align-top font-medium">
                      {row.currency === 'BRL'
                        ? money.format(row.amount)
                        : `${row.amount} ${row.currency}`}
                    </td>
                    <td className="text-outline py-2.5 align-top">{formatDateUtc(row.planExpiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="text-outline mt-4 flex items-center justify-between text-xs">
              <span>
                Página {page} de {totalPages} ({total} {total === 1 ? 'registo' : 'registos'})
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                  }}
                  className="text-primary font-medium enabled:hover:underline disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => {
                    setPage((p) => p + 1);
                  }}
                  className="text-primary font-medium enabled:hover:underline disabled:opacity-40"
                >
                  Seguinte
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
