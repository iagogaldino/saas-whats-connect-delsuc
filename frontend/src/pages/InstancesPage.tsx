import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createInstance,
  fetchListeningStatusForInstance,
  listInstances,
  startListeningMessagesForInstance,
  stopListeningMessagesForInstance,
  type WhatsAppInstance,
} from '../lib/api';
import { Icon } from '../components/dashboard/Icon';

export function InstancesPage() {
  const [items, setItems] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [togglingById, setTogglingById] = useState<Record<string, boolean>>({});
  const [name, setName] = useState('');
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await listInstances();
      const withListeningState = await Promise.all(
        result.map(async (item) => {
          try {
            const listening = await fetchListeningStatusForInstance(item.id);
            return {
              ...item,
              realtimeListeningEnabled: listening.enabled,
            };
          } catch {
            return item;
          }
        })
      );
      setItems(withListeningState);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar instancias');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const created = await createInstance(name.trim() || undefined);
      setName('');
      await load();
      void navigate(`/instances/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar instancia');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleInstance(item: WhatsAppInstance) {
    setError(null);
    setTogglingById((prev) => ({ ...prev, [item.id]: true }));
    try {
      if (item.realtimeListeningEnabled) {
        await stopListeningMessagesForInstance(item.id);
      } else {
        await startListeningMessagesForInstance(item.id);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao alternar estado da instancia');
    } finally {
      setTogglingById((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="border-b border-outline-variant/10 pb-4">
        <h1 className="text-on-surface text-2xl font-bold tracking-tight">Instancias</h1>
        <p className="text-outline mt-1 text-sm">
          Clique em iniciar instancia para criar um dashboard isolado com QR, envio, historico e logs.
        </p>
      </div>

      <section className="bg-surface-container-lowest border-outline-variant/10 rounded-xl border p-6">
        <label className="text-outline mb-2 block text-[10px] font-black uppercase tracking-widest">
          Nome da instancia (opcional)
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className="text-on-surface focus:ring-primary/20 flex-1 rounded-lg border-none bg-surface-container-low p-3 text-sm transition-all focus:ring-2"
            placeholder="Ex.: Operacao Matriz"
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="bg-primary text-on-primary rounded-lg px-5 py-3 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
          >
            {creating ? 'Criando...' : 'Iniciar instancia'}
          </button>
        </div>
      </section>

      {loading && (
        <div className="text-outline flex items-center gap-2 text-sm">
          <Icon name="progress_activity" className="animate-spin text-lg" />
          Carregando...
        </div>
      )}
      {error && (
        <div className="border-error flex gap-3 rounded-lg border-l-4 bg-error-container/20 p-4">
          <Icon name="error" className="text-error shrink-0" />
          <p className="text-on-error-container text-sm">{error}</p>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="text-outline text-sm">Nenhuma instancia criada ainda.</p>
      )}
      {!loading && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="bg-surface-container-low flex items-center justify-between rounded-lg px-4 py-3"
            >
              <div>
                <p className="text-on-surface text-sm font-semibold">{item.name}</p>
                <p className="text-outline font-mono text-xs">{item.code}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleToggleInstance(item)}
                  disabled={Boolean(togglingById[item.id])}
                  className={`rounded-lg px-4 py-2 text-xs font-bold uppercase transition-colors disabled:opacity-60 ${
                    item.realtimeListeningEnabled
                      ? 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                      : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                  }`}
                >
                  {togglingById[item.id]
                    ? 'Atualizando...'
                    : item.realtimeListeningEnabled
                      ? 'Desligar instancia'
                      : 'Ligar instancia'}
                </button>
                <Link
                  to={`/instances/${item.id}`}
                  className="bg-primary text-on-primary rounded-lg px-4 py-2 text-xs font-bold uppercase"
                >
                  Abrir dashboard
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}
