import { Fragment, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Icon } from '../components/dashboard/Icon';
import { fetchApiRequestLogs } from '../lib/api';

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

export function ApiRequestLogsPage() {
  const { instanceId = '' } = useParams<{ instanceId: string }>();
  const [page, setPage] = useState(1);
  const limit = 20;
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchApiRequestLogs>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApiRequestLogs(instanceId, page, limit);
      setData(res);
      setExpandedRows(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar logs');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [instanceId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const toggleRowHeaders = (rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="border-b border-outline-variant/10 pb-4">
        <h1 className="text-on-surface text-2xl font-bold tracking-tight">Logs por chave de API</h1>
        <p className="text-outline mt-1 text-sm">
          Mostra apenas requisições autenticadas com suas chaves de API. Chamadas com token de sessão (JWT) não
          entram nesta listagem.
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
        <p className="text-outline text-sm">
          Nenhum log ainda. Gere tráfego com uma API key (ex.: envio de mensagens, status ou histórico).
        </p>
      )}

      {!loading && data && data.items.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant/10 bg-surface-container-low">
                  <th className="text-outline px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Data</th>
                  <th className="text-outline px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Método</th>
                  <th className="text-outline px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Rota</th>
                  <th className="text-outline px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Status</th>
                  <th className="text-outline px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Duração</th>
                  <th className="text-outline px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Origem</th>
                  <th className="text-outline px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Headers</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const isExpanded = expandedRows.has(row.id);
                  const hasHeaders = Object.keys(row.requestHeaders ?? {}).length > 0;
                  return (
                    <Fragment key={row.id}>
                      <tr key={row.id} className="border-b border-outline-variant/5">
                        <td className="text-on-surface px-4 py-3 font-mono text-xs">{formatDate(row.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-surface-container-high px-2 py-1 font-mono text-[11px]">
                            {row.method}
                          </span>
                        </td>
                        <td
                          className="text-on-surface max-w-[320px] truncate px-4 py-3 font-mono text-xs"
                          title={row.path}
                        >
                          {row.path}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              row.statusCode >= 200 && row.statusCode < 400
                                ? 'bg-tertiary-container/40 text-tertiary'
                                : row.statusCode >= 400 && row.statusCode < 500
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-error-container/30 text-error'
                            }`}
                          >
                            {row.statusCode}
                          </span>
                        </td>
                        <td className="text-on-surface px-4 py-3 font-mono text-xs">
                          {row.durationMs !== null ? `${row.durationMs} ms` : '—'}
                        </td>
                        <td
                          className="text-outline max-w-[260px] truncate px-4 py-3 text-xs"
                          title={row.userAgent ?? row.ip ?? ''}
                        >
                          {row.ip ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleRowHeaders(row.id)}
                            disabled={!hasHeaders}
                            className="rounded-lg border border-outline-variant/20 bg-surface-container-high px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-on-surface transition-colors hover:bg-surface-variant disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isExpanded ? 'Ocultar' : 'Ver headers'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-outline-variant/5 last:border-0">
                          <td className="px-4 pb-4 pt-0" colSpan={7}>
                            <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low p-3">
                              <p className="text-outline mb-2 text-[10px] font-bold uppercase tracking-wide">
                                Headers da requisição
                              </p>
                              <pre className="text-on-surface overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px]">
                                {JSON.stringify(row.requestHeaders, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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
    </div>
  );
}
