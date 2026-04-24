import { useCallback, useEffect, useState } from 'react';
import { createApiKey, listApiKeys, revokeApiKey, type ApiKeyListItem } from '../../lib/api';
import { Icon } from './Icon';

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function ApiKeysPanel() {
  const [items, setItems] = useState<ApiKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listApiKeys();
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar chaves');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await createApiKey(name.trim() || undefined);
      setName('');
      setRevealedKey(res.key);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar chave');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm('Revogar esta chave? Integrações que a usam deixarão de funcionar.')) {
      return;
    }
    setRevokingId(id);
    setError(null);
    try {
      await revokeApiKey(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao revogar');
    } finally {
      setRevokingId(null);
    }
  }

  function copyRevealed() {
    if (revealedKey) void navigator.clipboard.writeText(revealedKey);
  }

  return (
    <>
      <section
        id="api-keys-section"
        className="bg-surface-container-lowest border-outline-variant/10 rounded-xl border p-8 shadow-sm"
      >
        <h2 className="text-primary-dim mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
          <Icon name="key" className="text-sm" />
          Chaves de API
        </h2>
        <p className="text-outline mb-6 text-xs leading-relaxed">
          Use no cabeçalho <code className="font-mono text-[10px]">Authorization: Bearer &lt;chave&gt;</code> como o
          token de login. A chave é global para sua conta (não presa a uma instância); na integração, informe também
          a instância alvo por <code className="font-mono text-[10px]">instanceId</code> (ID ou código com dash).
          A chave completa só é exibida uma vez ao criar. Gerenciar chaves exige sessão (este painel).
        </p>

        {loading && (
          <p className="text-outline text-sm">
            <Icon name="progress_activity" className="mr-1 inline-block animate-spin align-middle text-base" />
            Carregando…
          </p>
        )}
        {error && (
          <div className="border-error mb-4 flex gap-2 rounded-lg border-l-4 bg-error-container/20 px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="text-outline mb-1 block text-[10px] font-black uppercase tracking-widest">
              Nome (opcional)
            </label>
            <input
              className="text-on-surface focus:ring-primary/20 w-full rounded-lg border-none bg-surface-container-low p-3 text-sm transition-all focus:ring-2"
              placeholder="Ex.: produção, CI"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating || loading}
            className="bg-primary text-on-primary shrink-0 rounded-lg px-5 py-3 text-xs font-bold uppercase tracking-wide transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {creating ? 'Gerando…' : 'Gerar chave'}
          </button>
        </div>

        {!loading && items.length === 0 && (
          <p className="text-outline text-sm">Nenhuma chave ainda. Gere uma para usar em scripts e integrações.</p>
        )}

        {!loading && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((k) => (
              <li
                key={k.id}
                className="bg-surface-container-low flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-on-surface font-mono text-xs">{k.maskedPreview}</p>
                  {k.name && <p className="text-outline mt-0.5 text-[10px]">{k.name}</p>}
                  <p className="text-outline mt-1 text-[10px]">
                    Criada {formatShortDate(k.createdAt)}
                    {k.lastUsedAt ? ` · Último uso ${formatShortDate(k.lastUsedAt)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRevoke(k.id)}
                  disabled={revokingId === k.id}
                  className="text-error shrink-0 rounded border border-error/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors hover:bg-error/10 disabled:opacity-50"
                >
                  {revokingId === k.id ? '…' : 'Revogar'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {revealedKey && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-key-title"
        >
          <div className="bg-surface-container-lowest max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-outline-variant/20 p-6 shadow-xl">
            <h3 id="new-key-title" className="text-on-surface text-lg font-bold">
              Chave criada — copie agora
            </h3>
            <p className="text-outline mt-2 text-sm">
              Esta é a única vez que a chave completa é exibida. Armazene em um cofre ou variável de ambiente segura.
            </p>
            <pre className="border-white/5 mt-4 overflow-x-auto rounded-lg border bg-[#1a1c1e] p-4 font-mono text-[11px] text-emerald-200/90 break-all">
              {revealedKey}
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyRevealed()}
                className="bg-primary text-on-primary rounded-lg px-4 py-2 text-xs font-bold"
              >
                Copiar
              </button>
              <button
                type="button"
                onClick={() => setRevealedKey(null)}
                className="border-outline-variant text-outline rounded-lg border px-4 py-2 text-xs font-bold uppercase"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
