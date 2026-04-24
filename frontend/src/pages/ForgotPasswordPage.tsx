import { type FormEvent, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestPasswordReset } from '../lib/api';

export function ForgotPasswordPage() {
  const { token, bootstrapping } = useAuth();
  const [searchParams] = useSearchParams();
  const loginHref = useMemo(() => {
    const r = searchParams.get('redirect');
    if (!r) return '/login';
    return `/login?redirect=${encodeURIComponent(r)}`;
  }, [searchParams]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { message: msg } = await requestPasswordReset(email.trim());
      setMessage(msg);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar pedido');
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
  if (token) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="bg-surface flex min-h-screen items-center justify-center p-6">
      <div className="border-outline-variant/20 w-full max-w-md rounded-2xl border bg-white p-8 shadow-lg">
        <h1 className="text-on-surface text-xl font-bold tracking-tight">Recuperar senha</h1>
        <p className="text-outline mt-1 text-sm">
          Enviaremos um link para redefinir a senha.
        </p>

        {done ? (
          <div className="mt-8">
            <p
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900"
              role="status"
            >
              {message}
            </p>
            <p className="text-outline mt-6 text-center text-sm">
              <Link to={loginHref} className="text-primary font-semibold hover:underline">
                Voltar ao início de sessão
              </Link>
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-outline mb-1 block text-xs font-bold uppercase tracking-wider">
                E-mail
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              {loading ? 'A enviar…' : 'Enviar ligação'}
            </button>
          </form>
        )}

        {!done && (
          <p className="text-outline mt-6 text-center text-sm">
            <Link to={loginHref} className="text-primary font-semibold hover:underline">
              Voltar ao início de sessão
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
