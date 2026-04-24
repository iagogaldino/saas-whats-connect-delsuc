import { type FormEvent, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { resetPasswordWithToken } from '../lib/api';

export function ResetPasswordPage() {
  const { token: sessionToken, bootstrapping } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token');
  const loginHref = useMemo(() => {
    const r = searchParams.get('redirect');
    if (!r) return '/login';
    return `/login?redirect=${encodeURIComponent(r)}`;
  }, [searchParams]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('As senhas não coincidem');
      return;
    }
    if (!urlToken) {
      return;
    }
    setLoading(true);
    try {
      await resetPasswordWithToken(urlToken, password);
      navigate(`${loginHref}${loginHref.includes('?') ? '&' : '?'}passwordReset=ok`, {
        replace: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao redefinir a senha');
    } finally {
      setLoading(false);
    }
  }

  if (bootstrapping) {
    return (
      <div className="bg-surface text-outline flex min-h-screen items-center justify-center text-sm">
        Carregando…
      </div>
    );
  }
  if (sessionToken) {
    return <Navigate to="/app" replace />;
  }

  if (!urlToken?.trim()) {
    return (
      <div className="bg-surface flex min-h-screen items-center justify-center p-6">
        <div className="border-outline-variant/20 w-full max-w-md rounded-2xl border bg-white p-8 shadow-lg">
          <h1 className="text-on-surface text-xl font-bold tracking-tight">Ligação inválida</h1>
          <p className="text-outline mt-2 text-sm">
            Falta o token de redefinição no endereço. Abra o link do e-mail ou peça um novo
            redefinir de senha.
          </p>
          <p className="text-outline mt-6 text-center text-sm">
            <Link to="/forgot-password" className="text-primary font-semibold hover:underline">
              Pedir nova ligação
            </Link>
            {' · '}
            <Link to={loginHref} className="text-primary font-semibold hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface flex min-h-screen items-center justify-center p-6">
      <div className="border-outline-variant/20 w-full max-w-md rounded-2xl border bg-white p-8 shadow-lg">
        <h1 className="text-on-surface text-xl font-bold tracking-tight">Nova senha</h1>
        <p className="text-outline mt-1 text-sm">Mínimo de 8 caracteres</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-outline mb-1 block text-xs font-bold uppercase tracking-wider">
              Nova senha
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-outline-variant/30 focus:ring-primary/30 text-on-surface w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-outline mb-1 block text-xs font-bold uppercase tracking-wider">
              Confirmar senha
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="border-outline-variant/30 focus:ring-primary/30 text-on-surface w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-error bg-error/10 rounded-lg px-3 py-2 text-sm" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-on-primary w-full rounded-lg py-2.5 text-sm font-bold transition-opacity disabled:opacity-50"
          >
            {loading ? 'A guardar…' : 'Redefinir senha'}
          </button>
        </form>

        <p className="text-outline mt-6 text-center text-sm">
          <Link to={loginHref} className="text-primary font-semibold hover:underline">
            Voltar ao início de sessão
          </Link>
        </p>
      </div>
    </div>
  );
}
