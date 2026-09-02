import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import ThemeToggleButton from './ThemeToggleButton';
import { Icon, type IconName } from './ui';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  icon: IconName;
}

interface NavGroup {
  heading?: string;
  items: NavItem[];
}

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

function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span
      className={`relative flex ${className} flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-600 text-white shadow-glow`}
    >
      {/* Gradient sheen — light-mode flourish over the solid brand blue */}
      <span aria-hidden="true" className="absolute inset-0 bg-brand dark:hidden" />
      {/* Graduation cap */}
      <svg
        className="relative h-5 w-5"
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
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // Close the mobile drawer on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const overview: NavItem[] = [{ to: '/', label: 'Dashboard', end: true, icon: 'chart' }];

  const learning: NavItem[] = [
    { to: '/courses', label: 'Courses', icon: 'book' },
    { to: '/timetable', label: 'Timetable', icon: 'calendar' },
  ];
  if (isStudent && user?.student?.id) {
    learning.push({ to: `/students/${user.student.id}`, label: 'My Profile', icon: 'cap' });
  }

  const school: NavItem[] = [
    { to: '/announcements', label: 'Announcements', icon: 'bell' },
    { to: '/events', label: 'Events', icon: 'calendar' },
  ];

  const library: NavItem[] = [{ to: '/library', label: 'Library Catalog', icon: 'book' }];
  if (isStudent && user?.student?.id) {
    library.push({ to: '/library/my-borrowing', label: 'My Borrowing', icon: 'clipboard' });
  }
  if (isAdmin) {
    library.push({ to: '/library/admin', label: 'Library Admin', icon: 'clipboard' });
  }

  const adminGroup: NavItem[] = isAdmin
    ? [{ to: '/admin/users', label: 'Users', icon: 'users' }]
    : [];

  const groups: NavGroup[] = [
    { items: overview },
    { heading: 'Learning', items: learning },
    { heading: 'School', items: school },
    { heading: 'Library', items: library },
    ...(adminGroup.length > 0 ? [{ heading: 'Administration', items: adminGroup }] : []),
  ];

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 ${
      isActive
        ? 'bg-brand bg-primary-600 text-white shadow-glow'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100'
    }`;

  const roleBadgeClass =
    (user?.role && ROLE_BADGE_STYLES[user.role]) ||
    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

  const renderNavItems = (onNavigate?: () => void) =>
    groups.map((group, gi) => (
      <div key={group.heading ?? gi}>
        {group.heading && (
          <p className="mb-1.5 px-3 pt-4 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {group.heading}
          </p>
        )}
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={navLinkClass}
            >
              <Icon name={item.icon} className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    ));

  return (
    <div className="min-h-screen">
      {/* ------------------------------------------------ desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-gray-200/80 bg-white transition-colors duration-300 dark:border-gray-800/80 dark:bg-gray-950 lg:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <BrandMark />
          <span className="text-base font-extrabold tracking-tight text-gray-900 dark:text-white">
            Smart Education
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
          {renderNavItems()}
        </nav>

        <div className="border-t border-gray-100 p-3 dark:border-gray-800">
          <div className="flex items-center gap-3 rounded-xl p-2 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-900">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-xs font-bold text-white shadow-md">
              {getInitials(user?.fullName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
                {user?.fullName}
              </p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-px text-[10px] font-bold uppercase tracking-wide ${roleBadgeClass}`}
              >
                {user?.role}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="rounded-lg p-2 text-gray-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-red-500/10"
            >
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------ mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-dropdown dark:bg-gray-950 animate-fade-up">
            <div className="flex h-16 items-center justify-between px-4">
              <div className="flex items-center gap-2.5">
                <BrandMark />
                <span className="text-base font-extrabold tracking-tight text-gray-900 dark:text-white">
                  Smart Education
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Mobile navigation">
              {renderNavItems(() => setDrawerOpen(false))}
            </nav>
            <div className="border-t border-gray-100 p-3 dark:border-gray-800">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors duration-150 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Log out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ------------------------------------------------ main column */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/80">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
                className="rounded-xl p-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link to="/" aria-label="Smart Education home" className="flex items-center gap-2">
                <BrandMark className="h-8 w-8" />
                <span className="text-sm font-extrabold tracking-tight text-gray-900 dark:text-white sm:block">
                  Smart Education
                </span>
              </Link>
            </div>

            <div className="hidden lg:block" />

            <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
              <ThemeToggleButton />

              {/* Notification bell */}
              <button
                type="button"
                onClick={() => navigate('/notifications')}
                className="relative rounded-full p-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-950">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* User avatar + dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label="User menu"
                  className="flex items-center gap-2.5 rounded-full p-1 pr-2 transition-colors duration-150 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-gray-800"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-sm font-bold text-white shadow-md">
                    {getInitials(user?.fullName)}
                  </span>
                  <span className="hidden text-left xl:block">
                    <span className="block max-w-[160px] truncate text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
                      {user?.fullName}
                    </span>
                    <span className="block text-[11px] font-medium leading-tight text-gray-400 dark:text-gray-500">
                      {user?.role}
                    </span>
                  </span>
                  <svg
                    className={`hidden h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-150 sm:block ${
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
                    className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl bg-white p-1.5 shadow-dropdown ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10"
                  >
                    <div className="border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{user?.fullName}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                      <span
                        className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${roleBadgeClass}`}
                      >
                        {user?.role}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/settings');
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 transition-colors duration-150 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      Settings
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 dark:text-gray-300 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
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
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <Outlet />
        </main>

        <footer className="border-t border-gray-200/70 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              © {new Date().getFullYear()} Smart Education System · Ethiopian High Schools
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
