import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchMessages } from '../lib/api';
import { Icon } from '../components/dashboard/Icon';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  } catch {
    return iso;
  }
}

export function HistoryPage() {
  const { instanceId = '' } = useParams<{ instanceId: string }>();
  const [page, setPage] = useState(1);
  const limit = 20;
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchMessages>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMessages(instanceId, page, limit);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar histórico');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [instanceId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="border-b border-outline-variant/10 pb-4">
        <h1 className="text-on-surface text-2xl font-bold tracking-tight">Histórico de envios</h1>
        <p className="text-outline mt-1 text-sm">
          Tentativas de envio de mensagens via{' '}
          <code className="text-xs">POST /api/v1/auth/instances/:instanceId/send-code</code> (sucesso ou falha).
        </p>
      </div>

      {loading && (
        <div className="text-outline flex items-center gap-2 text-sm">
          <Icon name="progress_activity" className="animate-spin text-lg" />
          Carregando…
        </div>
      )}

      {error && (
        <div className="border-error flex gap-3 rounded-lg border-l-4 bg-error-container/20 p-4">
          <Icon name="error" className="text-error shrink-0" />
          <p className="text-on-error-container text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && data && data.items.length === 0 && (
        <p className="text-outline text-sm">Nenhum envio registrado ainda. Use o Message Sender no Dashboard.</p>
      )}

      {!loading && data && data.items.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant/10 bg-surface-container-low">
                  <th className="text-outline px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Data</th>
                  <th className="text-outline px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Telefone</th>
                  <th className="text-outline px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Status</th>
                  <th className="text-outline px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Mensagem</th>
                  <th className="text-outline px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Erro</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id} className="border-b border-outline-variant/5 last:border-0">
                    <td className="text-on-surface px-4 py-3 font-mono text-xs">{formatDate(row.createdAt)}</td>
                    <td className="text-on-surface px-4 py-3 font-mono text-xs">+{row.phoneNumber}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          row.status === 'success'
                            ? 'bg-tertiary-container/40 text-tertiary'
                            : 'bg-error-container/30 text-error'
                        }`}
                      >
                        {row.status === 'success' ? 'Sucesso' : 'Falha'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          const message = row.message?.trim();
                          setSelectedMessage(message && message.length > 0 ? message : 'Sem mensagem registrada.');
                        }}
                        className="rounded-lg border border-outline-variant/20 bg-surface-container-high px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-on-surface transition-colors hover:bg-surface-variant"
                      >
                        Ver mensagem
                      </button>
                    </td>
                    <td className="text-outline max-w-md truncate px-4 py-3 text-xs" title={row.errorMessage ?? ''}>
                      {row.errorMessage ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/10 bg-surface-container-low px-4 py-3">
            <p className="text-outline text-xs">
              Página {data.page} de {totalPages} · {data.total} registro(s)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-outline-variant/20 bg-surface-container-high px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-on-surface transition-colors hover:bg-surface-variant disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-outline-variant/20 bg-surface-container-high px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-on-surface transition-colors hover:bg-surface-variant disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedMessage !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal>
          <div className="w-full max-w-xl rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-0 shadow-xl">
            <div className="border-b border-outline-variant/10 px-5 py-4">
              <h2 className="text-on-surface text-base font-semibold">Mensagem enviada</h2>
            </div>
            <div className="px-5 py-4">
              <pre className="text-on-surface max-h-[60vh] overflow-auto whitespace-pre-wrap break-words font-mono text-sm">
                {selectedMessage}
              </pre>
            </div>
            <div className="flex justify-end border-t border-outline-variant/10 px-5 py-4">
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                className="rounded-lg border border-outline-variant/20 bg-surface-container-high px-4 py-2 text-xs font-bold uppercase tracking-wide text-on-surface transition-colors hover:bg-surface-variant"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
