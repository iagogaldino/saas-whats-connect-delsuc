import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login, token, bootstrapping } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar');
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
        <h1 className="text-on-surface text-xl font-bold tracking-tight">Entrar</h1>
        <p className="text-outline mt-1 text-sm">Whatsapp Connect — use e-mail e senha</p>

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
          <div>
            <label className="text-outline mb-1 block text-xs font-bold uppercase tracking-wider">
              Senha
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-outline mt-6 text-center text-sm">
          Não tem conta?{' '}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  );
}
