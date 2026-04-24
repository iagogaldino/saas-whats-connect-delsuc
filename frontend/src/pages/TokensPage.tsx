import { Link } from 'react-router-dom';
import { ApiKeysPanel } from '../components/dashboard/ApiKeysPanel';

export function TokensPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="border-b border-outline-variant/10 pb-4">
        <h1 className="text-on-surface text-2xl font-bold tracking-tight">Tokens</h1>
        <p className="text-outline mt-1 text-sm">
          Gerencie as chaves de API para integrações externas.{' '}
          <Link to="/app/pagamento" className="text-primary font-medium hover:underline">
            Plano, utilização e assinatura
          </Link>
        </p>
      </div>
      <ApiKeysPanel />
    </div>
  );
}
