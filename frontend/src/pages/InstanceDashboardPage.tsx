import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DashboardHome } from '../components/dashboard/DashboardHome';
import { listInstances, type WhatsAppInstance } from '../lib/api';
import { Icon } from '../components/dashboard/Icon';

export function InstanceDashboardPage() {
  const { instanceId = '' } = useParams<{ instanceId: string }>();
  const [items, setItems] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    void listInstances()
      .then((result) => {
        if (mounted) setItems(result);
      })
      .catch((e) => {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar instancia');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [instanceId]);

  const instance = useMemo(() => items.find((i) => i.id === instanceId) ?? null, [items, instanceId]);

  if (loading) {
    return (
      <div className="text-outline flex items-center gap-2 text-sm">
        <Icon name="progress_activity" className="animate-spin text-lg" />
        Carregando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-error flex gap-3 rounded-lg border-l-4 bg-error-container/20 p-4">
        <Icon name="error" className="text-error shrink-0" />
        <p className="text-on-error-container text-sm">{error}</p>
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

  return <DashboardHome instanceId={instance.id} instanceName={instance.name} instanceCode={instance.code} />;
}
