import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icon } from './Icon';

function scrollToId(id: string) {
  window.requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

const navItemBase =
  'flex w-full items-center gap-3 rounded-r-lg px-6 py-3 text-left transition-transform duration-200 ease-in-out';
const navItemInactive = `${navItemBase} hover:bg-slate-200/30 text-slate-500`;
const navItemActive = `${navItemBase} border-l-4 border-slate-700 bg-slate-200 text-slate-900`;

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { instanceId } = useParams<{ instanceId: string }>();
  const supportPhone = '74988420307';
  const inInstance = Boolean(instanceId);
  const overviewPath = inInstance ? `/instances/${instanceId}` : '/app';
  const historyPath = inInstance ? `/instances/${instanceId}/history` : '/app/history';
  const logsPath = inInstance ? `/instances/${instanceId}/logs` : '/app/logs';
  const tokensPath = '/app/tokens';

  function goHomeAndScroll(id: string) {
    if (location.pathname === overviewPath) {
      scrollToId(id);
    } else {
      void navigate(overviewPath);
      window.setTimeout(() => scrollToId(id), 100);
    }
  }

  return (
    <>
      <header className="bg-slate-50 flex w-full max-w-full items-center justify-between px-6 py-3 fixed top-0 z-50 mx-auto border-b border-outline-variant/20">
        <div className="flex items-center gap-8">
          <span className="text-lg font-black uppercase tracking-tighter text-slate-800">
            WHATSAPP CONNECT
          </span>
          <nav className="flex items-center gap-4 md:hidden">
            <NavLink
              to={overviewPath}
              end
              className={({ isActive }) =>
                isActive
                  ? 'border-b-2 border-slate-700 pb-1 font-sans text-sm font-bold tracking-tight text-slate-900'
                  : 'font-sans text-sm tracking-tight text-slate-600 hover:text-slate-900'
              }
            >
              Instancias
            </NavLink>
            <NavLink
              to={tokensPath}
              className={({ isActive }) =>
                isActive
                  ? 'border-b-2 border-slate-700 pb-1 font-sans text-sm font-bold tracking-tight text-slate-900'
                  : 'font-sans text-sm tracking-tight text-slate-600 hover:text-slate-900'
              }
            >
              Tokens
            </NavLink>
            {inInstance && (
              <NavLink
                to={historyPath}
                className={({ isActive }) =>
                  isActive
                    ? 'border-b-2 border-slate-700 pb-1 font-sans text-sm font-bold tracking-tight text-slate-900'
                    : 'font-sans text-sm tracking-tight text-slate-600 hover:text-slate-900'
                }
              >
                Histórico
              </NavLink>
            )}
            {inInstance && (
              <NavLink
                to={logsPath}
                className={({ isActive }) =>
                  isActive
                    ? 'border-b-2 border-slate-700 pb-1 font-sans text-sm font-bold tracking-tight text-slate-900'
                    : 'font-sans text-sm tracking-tight text-slate-600 hover:text-slate-900'
                }
              >
                Logs
              </NavLink>
            )}
            <NavLink
              to="/docs"
              className={({ isActive }) =>
                isActive
                  ? 'border-b-2 border-slate-700 pb-1 font-sans text-sm font-bold tracking-tight text-slate-900'
                  : 'font-sans text-sm tracking-tight text-slate-600 hover:text-slate-900'
              }
            >
              API Docs
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-outline hidden max-w-[200px] truncate text-xs sm:inline" title={user.email}>
              {user.email}
            </span>
          )}
        </div>
      </header>

      <aside className="bg-slate-100 fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col pb-4 pt-16 lg:flex">
        <div className="flex items-center gap-3 px-6 py-4">
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded text-on-primary">
            <Icon name="hub" className="text-lg" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-none text-slate-900">Whatsapp Connect</p>
            <p className="mt-1 truncate text-[10px] text-slate-600" title={user?.email}>
              {user?.email ?? '—'}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-500">API v1</p>
          </div>
        </div>
        <nav className="mt-4 flex-1">
          <ul className="space-y-1 pr-4">
            <li>
              <NavLink to={overviewPath} end className={({ isActive }) => (isActive ? navItemActive : navItemInactive)}>
                <Icon name="dashboard" />
                <span className="font-sans text-xs font-medium uppercase tracking-widest">Instancias</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to={tokensPath}
                className={({ isActive }) => (isActive ? navItemActive : navItemInactive)}
              >
                <Icon name="key" />
                <span className="font-sans text-xs font-medium uppercase tracking-widest">Tokens</span>
              </NavLink>
            </li>
            {inInstance && (
              <li>
                <NavLink
                  to={historyPath}
                  className={({ isActive }) => (isActive ? navItemActive : navItemInactive)}
                >
                  <Icon name="history" />
                  <span className="font-sans text-xs font-medium uppercase tracking-widest">History</span>
                </NavLink>
              </li>
            )}
            {inInstance && (
              <li>
                <NavLink
                  to={logsPath}
                  className={({ isActive }) => (isActive ? navItemActive : navItemInactive)}
                >
                  <Icon name="receipt_long" />
                  <span className="font-sans text-xs font-medium uppercase tracking-widest">Logs</span>
                </NavLink>
              </li>
            )}
            <li>
              <NavLink
                to="/docs"
                className={({ isActive }) => (isActive ? navItemActive : navItemInactive)}
              >
                <Icon name="menu_book" />
                <span className="font-sans text-xs font-medium uppercase tracking-widest">API Docs</span>
              </NavLink>
            </li>
          </ul>
        </nav>
        <div className="mt-auto px-6 py-4">
          <ul className="mt-4 space-y-1">
            <li>
              <button
                type="button"
                onClick={() => window.open(`https://wa.me/${supportPhone}`, '_blank', 'noopener,noreferrer')}
                className="flex w-full items-center gap-3 py-2 text-left text-slate-600 transition-colors hover:text-slate-900"
              >
                <Icon name="help" className="text-sm" />
                <span className="text-[10px] font-medium uppercase tracking-widest">Support</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  logout();
                  void navigate('/login', { replace: true });
                }}
                className="flex w-full items-center gap-3 py-2 text-left text-slate-600 transition-colors hover:text-slate-900"
              >
                <Icon name="logout" className="text-sm" />
                <span className="text-[10px] font-medium uppercase tracking-widest">Sair</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>

      <main className="bg-surface min-h-screen p-6 pt-20 lg:ml-64 pb-24 md:pb-6">
        <Outlet />
      </main>

      <nav className="border-outline-variant/10 bg-surface-container-lowest fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 items-center border-t py-2 md:hidden">
        <NavLink
          to={overviewPath}
          end
          className={({ isActive }) =>
            isActive
              ? 'text-primary flex flex-col items-center gap-1'
              : 'text-outline flex flex-col items-center gap-1'
          }
        >
              <Icon name="dashboard" filled={location.pathname === overviewPath} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Dash</span>
        </NavLink>
        <NavLink
          to={tokensPath}
          className={({ isActive }) =>
            isActive
              ? 'text-primary flex flex-col items-center gap-0.5'
              : 'text-outline flex flex-col items-center gap-0.5'
          }
        >
          <Icon name="key" filled={location.pathname === tokensPath} />
          <span className="text-[9px] font-medium uppercase tracking-tighter">Tokens</span>
        </NavLink>
        {inInstance && (
          <NavLink
            to={historyPath}
            className={({ isActive }) =>
              isActive
                ? 'text-primary flex flex-col items-center gap-0.5'
                : 'text-outline flex flex-col items-center gap-0.5'
            }
          >
            <Icon name="history" filled={location.pathname === historyPath} />
            <span className="text-[9px] font-medium uppercase tracking-tighter">Hist</span>
          </NavLink>
        )}
        <NavLink
          to="/docs"
          className={({ isActive }) =>
            isActive
              ? 'text-primary flex flex-col items-center gap-0.5'
              : 'text-outline flex flex-col items-center gap-0.5'
          }
        >
          <Icon name="menu_book" filled={location.pathname === '/docs'} />
          <span className="text-[9px] font-medium uppercase tracking-tighter">Docs</span>
        </NavLink>
        {inInstance && (
          <NavLink
            to={logsPath}
            className={({ isActive }) =>
              isActive
                ? 'text-primary flex flex-col items-center gap-0.5'
                : 'text-outline flex flex-col items-center gap-0.5'
            }
          >
            <Icon name="receipt_long" filled={location.pathname === logsPath} />
            <span className="text-[9px] font-medium uppercase tracking-tighter">Logs</span>
          </NavLink>
        )}
      </nav>
    </>
  );
}
