import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiUrl } from '../lib/config';
import { clearToken, getToken, setToken as persistToken } from '../lib/authStorage';

export type AuthUser = { id: string; email: string; plan: 'free' | 'paid' };

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  bootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Recarrega o utilizador a partir de GET /auth/me (após subscrição, etc.). */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(() => !!getToken());

  useEffect(() => {
    if (!token) {
      setUser(null);
      setBootstrapping(false);
      return;
    }
    if (user) {
      setBootstrapping(false);
      return;
    }
    let cancelled = false;
    setBootstrapping(true);
    void fetch(apiUrl('/api/v1/auth/me'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('unauthorized');
        return r.json() as Promise<{ user: AuthUser }>;
      })
      .then((d) => {
        if (!cancelled) setUser(d.user);
      })
      .catch(() => {
        if (!cancelled) {
          clearToken();
          setTokenState(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setBootstrapping(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t) persistToken(t);
    else clearToken();
  }, []);

  const refreshUser = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setUser(null);
      return;
    }
    const r = await fetch(apiUrl('/api/v1/auth/me'), {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!r.ok) {
      if (r.status === 401) {
        clearToken();
        setTokenState(null);
        setUser(null);
      }
      return;
    }
    const d = (await r.json()) as { user: AuthUser };
    setUser(d.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(apiUrl('/api/v1/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; token?: string; user?: AuthUser };
      if (!res.ok) {
        throw new Error(data.error ?? 'Falha no login');
      }
      if (!data.token || !data.user) throw new Error('Resposta inválida');
      setToken(data.token);
      setUser(data.user);
    },
    [setToken]
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(apiUrl('/api/v1/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; token?: string; user?: AuthUser };
      if (!res.ok) {
        throw new Error(data.error ?? 'Falha no cadastro');
      }
      if (!data.token || !data.user) throw new Error('Resposta inválida');
      setToken(data.token);
      setUser(data.user);
    },
    [setToken]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, [setToken]);

  const value = useMemo(
    () => ({
      token,
      user,
      bootstrapping,
      login,
      register,
      logout,
      refreshUser,
    }),
    [token, user, bootstrapping, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
