import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FiMenu,
  FiX,
  FiMoon,
  FiSun,
  FiShoppingCart,
  FiLogOut,
} from 'react-icons/fi';
import useAuth from '../../hooks/useAuth';

const ORDER_META_KEY = 'capstone-order-meta';

const readOrderMetaCount = () => {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(ORDER_META_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    const total = Number(parsed?.count);
    return Number.isFinite(total) && total > 0 ? total : 0;
  } catch (err) {
    console.warn('Failed to read order meta', err);
    return 0;
  }
};

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [orderCount, setOrderCount] = useState(() => readOrderMetaCount());
  const location = useLocation();
  const { isAuthenticated, logout, profile } = useAuth();

  const role = (profile?.role || '').toLowerCase();
  const isUserRole = isAuthenticated && role === 'user';

  useEffect(() => {
    const updateFromStorage = () => setOrderCount(readOrderMetaCount());
    const updateFromEvent = (event) => {
      if (event?.detail && typeof event.detail.count !== 'undefined') {
        const next = Number(event.detail.count);
        setOrderCount(Number.isFinite(next) && next > 0 ? next : 0);
      } else {
        updateFromStorage();
      }
    };

    updateFromStorage();
    window.addEventListener('storage', updateFromStorage);
    window.addEventListener('order-meta-updated', updateFromEvent);

    return () => {
      window.removeEventListener('storage', updateFromStorage);
      window.removeEventListener('order-meta-updated', updateFromEvent);
    };
  }, []);

  useEffect(() => {
    setOrderCount(readOrderMetaCount());
  }, [location.pathname]);

  const userNavItems = useMemo(
    () => [
      { label: 'Browse Menu', to: '/menu' },
      { label: 'My Order', to: '/orders' },
      { label: 'Profile', to: '/profile' },
    ],
    [],
  );

  const toggleMenu = () => setIsOpen((prev) => !prev);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  if (isUserRole) {
    return (
      <header className="bg-[var(--app-surface)] shadow-sm">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Link to="/menu" className="text-2xl font-semibold text-[var(--app-text)] font-serif">
                  Bella Vista
                </Link>
                <p className="mt-1 text-sm text-[var(--app-muted)]">
                  Welcome back, {profile?.first_name || 'Guest'}
                  {profile?.email ? ` • ${profile.email}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/orders"
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(15,23,42,0.12)] bg-[var(--app-surface)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:border-[var(--app-primary)]"
                >
                  <FiShoppingCart className="text-base" />
                  Order{orderCount ? ` (${orderCount})` : ''}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--app-primary)] px-4 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] shadow-sm transition hover:opacity-90"
                >
                  <FiLogOut className="text-base" />
                  Logout
                </button>
              </div>
            </div>
            <nav className="flex rounded-full bg-[rgba(15,23,42,0.05)] p-1 text-sm font-medium">
              {userNavItems.map((item) => {
                const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex-1 rounded-full px-5 py-2 text-center transition ${
                      isActive
                        ? 'bg-[var(--app-text)] text-white shadow'
                        : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-[var(--app-surface)] shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          <Link to="/" className="text-2xl font-bold text-[var(--app-accent)] font-serif">
            RestaurantManager
          </Link>

          <nav className="hidden items-center space-x-6 md:flex">
            {isAuthenticated && (
              <>
                <Link
                  to="/"
                  className={`text-[var(--app-text)] transition hover:text-[var(--app-accent)] ${
                    location.pathname === '/' ? 'font-semibold text-[var(--app-accent)]' : ''
                  }`}
                >
                  Home
                </Link>
                <Link
                  to="/menu"
                  className={`text-[var(--app-text)] transition hover:text-[var(--app-accent)] ${
                    ['/menu', '/orders', '/profile'].some((path) => location.pathname.startsWith(path))
                      ? 'font-semibold text-[var(--app-accent)]'
                      : ''
                  }`}
                >
                  Menu
                </Link>
                <Link
                  to="/schedule"
                  className={`text-[var(--app-text)] transition hover:text-[var(--app-accent)] ${
                    location.pathname.startsWith('/schedule') ? 'font-semibold text-[var(--app-accent)]' : ''
                  }`}
                >
                  Schedule
                </Link>
                <Link
                  to="/analytics"
                  className={`text-[var(--app-text)] transition hover:text-[var(--app-accent)] ${
                    location.pathname.startsWith('/analytics') ? 'font-semibold text-[var(--app-accent)]' : ''
                  }`}
                >
                  Analytics
                </Link>
              </>
            )}

            <button
              onClick={toggleDarkMode}
              className="text-[var(--app-text)] transition hover:text-[var(--app-accent)]"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
            </button>

            {isAuthenticated ? (
              <button
                onClick={logout}
                className="rounded-full bg-[var(--app-primary)] px-4 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] shadow-sm transition hover:opacity-90"
              >
                Logout
              </button>
            ) : (
              <Link to="/login" className="btn btn-primary">
                Login
              </Link>
            )}
          </nav>

          <button className="text-[var(--app-text)] md:hidden" onClick={toggleMenu} aria-label="Toggle menu">
            {isOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>

        {isOpen && (
          <div className="border-t py-4 md:hidden">
            <div className="flex flex-col space-y-4">
              {isAuthenticated ? (
                <>
                  <Link to="/" className="text-[var(--app-text)] hover:text-[var(--app-accent)]">
                    Home
                  </Link>
                  <Link to="/menu" className="text-[var(--app-text)] hover:text-[var(--app-accent)]">
                    Menu
                  </Link>
                  <Link to="/schedule" className="text-[var(--app-text)] hover:text-[var(--app-accent)]">
                    Schedule
                  </Link>
                  <Link to="/analytics" className="text-[var(--app-text)] hover:text-[var(--app-accent)]">
                    Analytics
                  </Link>
                  <button
                    onClick={logout}
                    className="text-left text-[var(--app-text)] hover:text-[var(--app-accent)]"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link to="/login" className="text-[var(--app-accent)]">
                  Login / Register
                </Link>
              )}

              <button
                onClick={toggleDarkMode}
                className="flex items-center space-x-2 text-[var(--app-text)] hover:text-[var(--app-accent)]"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
                <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;