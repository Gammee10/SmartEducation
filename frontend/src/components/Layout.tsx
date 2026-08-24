import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/courses', label: 'Courses' },
  { to: '/timetable', label: 'Timetable' },
  { to: '/announcements', label: 'Announcements' },
  { to: '/events', label: 'Events' },
  { to: '/library', label: 'Library Catalog' },
];

const ROLE_BADGE_STYLES: Record<string, string> = {
  ADMIN: 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400',
  TEACHER: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  STUDENT: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
};

function getInitials(fullName?: string): string {
  if (!fullName) return '?';
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function BrandMark() {
  return (
    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-card">
      {/* Graduation cap */}
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3L2 8l10 5 10-5-10-5zM4.5 10.5V15c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-4.5M20 9v6"
        />
      </svg>
    </span>
  );
}

export default function Layout() {
  const { user, logout, isStudent, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const failuresRef = useRef(0);

  const refreshUnread = useCallback(() => {
    api
      .get('/notifications/unread-count')
      .then((res) => {
        failuresRef.current = 0;
        setUnreadCount(res.data.data.count);
      })
      .catch(() => {
        failuresRef.current += 1;
      });
  }, []);

  useEffect(() => {
    // Poll every 30s while the tab is visible, backing off progressively
    // when requests fail so a broken backend is not hammered forever.
    let timer: number;
    const schedule = () => {
      const delay = Math.min(30000 * 2 ** failuresRef.current, 300000);
      timer = window.setTimeout(() => {
        if (!document.hidden) refreshUnread();
        schedule();
      }, delay);
    };
    refreshUnread();
    schedule();
    const onVisibilityChange = () => {
      if (!document.hidden) refreshUnread();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshUnread]);

  // Close the avatar menu on outside click or Escape.
  useEffect(() => {
    if (!userMenuOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [userMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const items = [...navItems];
  if (isStudent && user?.student?.id) {
    items.push({ to: `/students/${user.student.id}`, label: 'My Profile' });
    items.push({ to: '/library/my-borrowing', label: 'My Borrowing' });
  }
  if (isAdmin) {
    items.push({ to: '/admin/users', label: 'Users' });
    items.push({ to: '/library/admin', label: 'Library Admin' });
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
      isActive
        ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
    }`;

  const roleBadgeClass =
    (user?.role && ROLE_BADGE_STYLES[user.role]) ||
    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-800/50">
      <nav className="sticky top-0 z-40 border-b border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3 lg:gap-8">
              <Link
                to="/"
                className="flex flex-shrink-0 items-center gap-2.5"
                aria-label="Smart Education home"
              >
                <BrandMark />
                <span className="hidden text-base font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:block">
                  Smart Education
                </span>
              </Link>
              {/* Desktop navigation */}
              <div className="hidden items-center gap-1 lg:flex">
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
              {/* Theme toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="rounded-full p-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              >
                {theme === 'dark' ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                )}
              </button>

              {/* Notification bell */}
              <Link
                to="/notifications"
                onClick={refreshUnread}
                className="relative rounded-full p-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>

              {/* User avatar + dropdown */}
              <div className="relative hidden md:block" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label="User menu"
                  className="flex items-center gap-2.5 rounded-full p-1 pr-2 transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white shadow-card">
                    {getInitials(user?.fullName)}
                  </span>
                  <span className="hidden text-left xl:block">
                    <span className="block max-w-[160px] truncate text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
                      {user?.fullName}
                    </span>
                    <span
                      className={`mt-0.5 inline-block rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${roleBadgeClass}`}
                    >
                      {user?.role}
                    </span>
                  </span>
                  <svg
                    className={`h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-150 ${
                      userMenuOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl bg-white dark:bg-gray-900 p-1.5 shadow-dropdown ring-1 ring-black/5"
                  >
                    <div className="border-b border-gray-100 dark:border-gray-800 px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{user?.fullName}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{user?.email}</p>
                      <span
                        className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleBadgeClass}`}
                      >
                        {user?.role}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Log out
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
                className="rounded-lg p-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 lg:hidden"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  {menuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="border-t border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 px-4 pb-4 pt-3 lg:hidden">
            <div className="space-y-1">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={linkClass}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3 border-t border-gray-100 dark:border-gray-800 pt-3 md:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
                {getInitials(user?.fullName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{user?.fullName}</p>
                <span
                  className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleBadgeClass}`}
                >
                  {user?.role}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
              >
                Log out
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            © {new Date().getFullYear()} Smart Education System · Ethiopian High Schools
          </p>
        </div>
      </footer>
    </div>
  );
}