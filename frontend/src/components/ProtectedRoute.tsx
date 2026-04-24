import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, bootstrapping } = useAuth();
  const location = useLocation();

  if (bootstrapping) {
    return (
      <div className="bg-surface text-outline flex min-h-screen items-center justify-center text-sm">
        Carregando sessão…
      </div>
    );
  }

  if (!token) {
    const next = location.pathname + location.search + location.hash;
    const to = `/login?redirect=${encodeURIComponent(next || '/app')}`;
    return <Navigate to={to} replace />;
  }

  return <>{children}</>;
}
