import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, bootstrapping } = useAuth();

  if (bootstrapping) {
    return (
      <div className="bg-surface text-outline flex min-h-screen items-center justify-center text-sm">
        Carregando sessão…
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
