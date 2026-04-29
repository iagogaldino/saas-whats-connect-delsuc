import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchWhatsAppContactsForInstance,
  listInstances,
  type WhatsAppContact,
  type WhatsAppInstance,
} from '../lib/api';
import { Icon } from '../components/dashboard/Icon';

export function InstanceContactsPage() {
  const { instanceId = '' } = useParams<{ instanceId: string }>();
  const [items, setItems] = useState<WhatsAppInstance[]>([]);
  const [instanceLoading, setInstanceLoading] = useState(true);
  const [instanceError, setInstanceError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const instance = useMemo(() => items.find((i) => i.id === instanceId) ?? null, [items, instanceId]);

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q.replace(/\D/g, ''))
    );
  }, [contacts, query]);

  useEffect(() => {
    let mounted = true;
    setInstanceLoading(true);
    setInstanceError(null);
    void listInstances()
      .then((result) => {
        if (mounted) setItems(result);
      })
      .catch((e) => {
        if (mounted) setInstanceError(e instanceof Error ? e.message : 'Falha ao carregar instancia');
      })
      .finally(() => {
        if (mounted) setInstanceLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [instanceId]);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    setContactsError(null);
    try {
      const result = await fetchWhatsAppContactsForInstance(instanceId);
      setContacts(result);
    } catch (e) {
      setContacts([]);
      setContactsError(e instanceof Error ? e.message : 'Falha ao carregar contatos');
    } finally {
      setContactsLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    if (!instanceId) return;
    void loadContacts();
  }, [instanceId, loadContacts]);

  if (instanceLoading) {
    return (
      <div className="text-outline flex items-center gap-2 text-sm">
        <Icon name="progress_activity" className="animate-spin text-lg" />
        Carregando...
      </div>
    );
  }

  if (instanceError) {
    return (
      <div className="border-error flex gap-3 rounded-lg border-l-4 bg-error-container/20 p-4">
        <Icon name="error" className="text-error shrink-0" />
        <p className="text-on-error-container text-sm">{instanceError}</p>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="border-error flex gap-3 rounded-lg border-l-4 bg-error-container/20 p-4">
        <Icon name="error" className="text-error shrink-0" />
        <p className="text-on-error-container text-sm">Instancia nao encontrada para este usuario.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between border-b border-outline-variant/10 pb-4">
        <div>
          <h1 className="text-on-surface text-2xl font-bold tracking-tight">Contatos da instancia</h1>
          <p className="text-outline mt-1 text-sm">
            {instance.name} - <code className="text-xs">{instance.code}</code>
          </p>
        </div>
        <Link
          to={`/instances/${instance.id}`}
          className="border-outline-variant text-outline hover:bg-surface-container-high rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors"
        >
          Voltar
        </Link>
      </div>

      <section className="surface-container rounded-2xl border border-outline-variant p-4 md:p-5">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-on-surface text-base font-semibold">Contatos</h2>
            <p className="text-on-surface-variant text-sm">
              Contatos com nome salvo sincronizados da sua sessao WhatsApp.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              className="border-outline-variant bg-surface text-on-surface placeholder:text-outline focus:border-primary focus:ring-primary/30 rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2"
              aria-label="Buscar contato"
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void loadContacts()}>
              Recarregar
            </button>
          </div>
        </header>

        {contactsLoading ? (
          <div className="text-outline flex items-center gap-2 text-sm">
            <Icon name="progress_activity" className="animate-spin text-lg" />
            Carregando contatos...
          </div>
        ) : contactsError ? (
          <div className="border-error flex gap-3 rounded-lg border-l-4 bg-error-container/20 p-4">
            <Icon name="error" className="text-error shrink-0" />
            <p className="text-on-error-container text-sm">{contactsError}</p>
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-on-surface-variant text-sm">Nenhum contato com nome salvo encontrado.</p>
        ) : filteredContacts.length === 0 ? (
          <p className="text-on-surface-variant text-sm">
            Nenhum contato corresponde a busca "{query}".
          </p>
        ) : (
          <>
            <p className="text-outline mb-2 text-xs">
              {filteredContacts.length} de {contacts.length} contato(s)
            </p>
            <ul className="divide-outline-variant divide-y">
              {filteredContacts.map((contact) => (
                <li key={contact.jid} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-on-surface text-sm font-medium">{contact.name}</span>
                  <span className="text-on-surface-variant text-xs">{contact.phone}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
