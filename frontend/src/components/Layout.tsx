import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Outlet, NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import ThemeToggleButton from './ThemeToggleButton';
import { Icon, Avatar, type IconName } from './ui';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  icon: IconName;
  hint?: string;
  shortcut?: string;
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

function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span
      className={`flex ${className} flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm`}
    >
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

/* --------------------------- Command palette ------------------------------ */

interface PaletteEntry {
  to: string;
  label: string;
  hint: string;
  icon: IconName;
}

function CommandPalette({
  open,
  onClose,
  entries,
}: {
  open: boolean;
  onClose: () => void;
  entries: PaletteEntry[];
}) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      document.body.style.overflow = 'hidden';
      return () => {
        window.clearTimeout(t);
        document.body.style.overflow = '';
      };
    }
  }, [open ]);

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? entries.filter(
        (e) =>
          e.label.toLowerCase().includes(normalized) ||
          e.hint.toLowerCase().includes(normalized) ||
          e.to.toLowerCase().includes(normalized)
      )
    : entries;

  useEffect(() => setCursor(0), [query]);

  const go = useCallback(
    (to: string) => {
      onClose();
      navigate(to);
    },
    [navigate, onClose]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === 'Enter' && filtered[cursor]) {
        go(filtered[cursor].to);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, filtered, cursor, go, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Quick navigation">
      <button type="button" aria-label="Close quick navigation" onClick={onClose} className="animate-fade-in absolute inset-0 bg-gray-950/55 backdrop-blur-sm" />
      <div className="animate-scale-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-dropdown dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <Icon name="command" className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to courses, library, timetable…"
            aria-label="Search pages"
            className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none dark:text-gray-100 dark:placeholder-gray-500"
          />
          <span className="kbd flex-shrink-0">esc</span>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2" role="listbox" aria-label="Pages">
          {filtered.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No matches for “{query.trim()}”.
            </li>
          )}
          {filtered.map((entry, i) => (
            <li key={entry.to + entry.label}>
              <button
                type="button"
                role="option"
                aria-selected={i === cursor}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(entry.to)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ${
                  i === cursor
                    ? 'bg-primary-50 dark:bg-primary-500/10'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
                    i === cursor
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  <Icon name={entry.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{entry.label}</span>
                  <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{entry.hint}</span>
                </span>
                <Icon name="arrow" className={`h-4 w-4 flex-shrink-0 transition-opacity duration-150 ${i === cursor ? 'text-primary-600 opacity-100 dark:text-primary-400' : 'opacity-0'}`} />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 border-t border-gray-100 px-4 py-2.5 text-[11px] text-gray-400 dark:border-gray-800 dark:text-gray-500">
          <span className="inline-flex items-center gap-1.5"><span className="kbd">↑↓</span> navigate</span>
          <span className="inline-flex items-center gap-1.5"><span className="kbd">↵</span> open</span>
          <span className="ml-auto hidden sm:block">Quick jump across the portal</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Breadcrumbs ------------------------------ */

const CRUMB_LABELS: Record<string, string> = {
  courses: 'Courses',
  timetable: 'Timetable',
  students: 'Students',
  notifications: 'Notifications',
  announcements: 'Announcements',
  events: 'Events',
  settings: 'Settings',
  admin: 'Admin',
  users: 'Users',
  library: 'Library',
  'my-borrowing': 'My Borrowing',
  quizzes: 'Quiz',
  assignments: 'Assignment',
  attendance: 'Attendance',
};

function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  // Only these intermediate targets are real routes — anything else (e.g.
  // /admin or /students index pages, which don't exist) renders as plain text
  // so the breadcrumb never leads to a 404.
  const LINKABLE = new Set([
    '/',
    '/courses',
    '/library',
    '/timetable',
    '/announcements',
    '/events',
    '/settings',
    '/notifications',
    '/admin/users',
  ]);
  const crumbs = segments.slice(0, 3).map((seg, i) => {
    const to = `/${segments.slice(0, i + 1).join('/')}`;
    const isId = /^[0-9a-f-]{8,}$/i.test(seg) || /^\d+$/.test(seg);
    const last = i === Math.min(segments.length, 3) - 1;
    return { to, label: isId ? 'Details' : CRUMB_LABELS[seg] ?? seg, last, linkable: !last && LINKABLE.has(to) };
  });
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-[13px] md:flex">
      <Link to="/" className="link-underline shrink-0 font-semibold text-gray-500 transition-colors hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
        Home
      </Link>
      {crumbs.map((c) => (
        <span key={c.to} className="flex min-w-0 items-center gap-1">
          <span aria-hidden="true" className="text-gray-300 dark:text-gray-600">/</span>
          {c.last || !c.linkable ? (
            <span aria-current={c.last ? 'page' : undefined} className={`truncate ${c.last ? 'font-semibold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-500 dark:text-gray-400'}`}>{c.label}</span>
          ) : (
            <Link to={c.to} className="link-underline shrink-0 font-medium text-gray-500 transition-colors hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

/* ---------------------------------- Layout --------------------------------- */

export default function Layout() {
  const { user, logout, isStudent, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [showTop, setShowTop] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const failuresRef = useRef(0);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('sidebar-collapsed', c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

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

  // Global shortcuts: Cmd/Ctrl+K opens palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Back-to-top visibility.
  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 600);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  // Close the mobile drawer on Escape or route change.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    setDrawerOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const overview: NavItem[] = [{ to: '/', label: 'Dashboard', end: true, icon: 'chart', hint: 'Overview & stats' }];

  const learning: NavItem[] = [
    { to: '/courses', label: 'Courses', icon: 'book', hint: 'Catalog & content' },
    { to: '/timetable', label: 'Timetable', icon: 'calendar', hint: 'Weekly schedule' },
  ];
  if (isStudent && user?.student?.id) {
    learning.push({ to: `/students/${user.student.id}`, label: 'My Profile', icon: 'cap', hint: 'Grades & progress' });
  }

  const school: NavItem[] = [
    { to: '/announcements', label: 'Announcements', icon: 'bell', hint: 'School news' },
    { to: '/events', label: 'Events', icon: 'spark', hint: 'Upcoming happenings' },
  ];

  const library: NavItem[] = [{ to: '/library', label: 'Library Catalog', icon: 'book', hint: 'Books & borrowing' }];
  if (isStudent && user?.student?.id) {
    library.push({ to: '/library/my-borrowing', label: 'My Borrowing', icon: 'clipboard', hint: 'Loans & due dates' });
  }
  if (isAdmin) {
    library.push({ to: '/library/admin', label: 'Library Admin', icon: 'clipboard', hint: 'Manage collection' });
  }

  const adminGroup: NavItem[] = isAdmin
    ? [{ to: '/admin/users', label: 'Users', icon: 'users', hint: 'Accounts & roles' }]
    : [];

  const groups: NavGroup[] = useMemo(
    () => [
      { items: overview },
      { heading: 'Learning', items: learning },
      { heading: 'School', items: school },
      { heading: 'Library', items: library },
      ...(adminGroup.length > 0 ? [{ heading: 'Administration', items: adminGroup }] : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.student?.id, isStudent, isAdmin]
  );

  const paletteEntries: PaletteEntry[] = useMemo(
    () =>
      groups.flatMap((g) =>
        g.items.map((i) => ({ to: i.to, label: i.label, hint: i.hint ?? g.heading ?? 'Portal', icon: i.icon }))
      ),
    [groups]
  );

  const { pathname } = location;

  const isItemActive = (item: NavItem) =>
    item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);

  const navLinkClass = (active: boolean) =>
    `nav-pill group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-150 ${
      active
        ? 'text-white'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100'
    }`;

  const roleBadgeClass =
    (user?.role && ROLE_BADGE_STYLES[user.role]) ||
    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

  const renderNavItems = (onNavigate?: () => void, mini = false) =>
    groups.map((group, gi) => (
      <div key={group.heading ?? gi}>
        {group.heading && !mini && (
          <p className="mb-1.5 px-3 pt-4 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {group.heading}
          </p>
        )}
        {group.heading && mini && <div className="mx-3 mb-1 mt-4 border-t border-gray-100 dark:border-gray-800" aria-hidden="true" />}
        <div className="space-y-0.5">
          {group.items.map((item) => {
            const active = isItemActive(item);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                title={mini ? item.label : undefined}
                data-active={active ? 'true' : 'false'}
                data-tip={mini ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
                className={`${navLinkClass(active)} ${mini ? 'justify-center px-2' : ''}`}
              >
                <Icon name={item.icon} className="h-[18px] w-[18px] flex-shrink-0" />
                {!mini && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </div>
      </div>
    ));

  return (
    <div className="min-h-screen">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} entries={paletteEntries} />

      {/* ------------------------------------------------ desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-gray-200/80 bg-white/90 backdrop-blur-xl transition-all duration-300 dark:border-gray-800/80 dark:bg-gray-950/90 lg:flex ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        <div className={`flex h-16 items-center gap-2.5 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
          <BrandMark />
          {!collapsed && (
            <span className="animate-fade-in truncate text-base font-extrabold tracking-tight text-gray-900 dark:text-white">
              Smart Education
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
          {renderNavItems(undefined, collapsed)}
        </nav>

        <div className="space-y-2 border-t border-gray-100 p-3 dark:border-gray-800">
          {!collapsed && (
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="group flex w-full items-center gap-2.5 rounded-xl border border-gray-200/70 bg-gray-50 px-3 py-2 text-left text-xs text-gray-500 transition-all duration-200 hover:border-primary-300 hover:bg-white hover:shadow-card dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-primary-500/40"
            >
              <Icon name="search" className="h-3.5 w-3.5 flex-shrink-0 transition-colors group-hover:text-primary-500" />
              <span className="flex-1 truncate">Quick jump…</span>
              <span className="kbd">⌘K</span>
            </button>
          )}
          {collapsed && (
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Quick navigation"
              data-tip="Quick jump (⌘K)"
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              <Icon name="search" className="h-4 w-4" />
            </button>
          )}

          <div className={`flex items-center gap-3 rounded-xl p-2 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-900 ${collapsed ? 'justify-center' : ''}`}>
            <Avatar name={user?.fullName} size="md" />
            {!collapsed && (
              <>
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
                  data-tip="Log out"
                  className="pressable rounded-lg p-2 text-gray-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                >
                  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            data-tip={collapsed ? 'Expand' : 'Collapse'}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <svg className={`h-4 w-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------ mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="animate-fade-in absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          />
          <aside className="animate-slide-in-left absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-dropdown dark:bg-gray-950">
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
                className="pressable rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-4 pb-2">
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setPaletteOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl border border-gray-200/70 bg-gray-50 px-3 py-2.5 text-left text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
              >
                <Icon name="search" className="h-4 w-4" />
                Quick jump…
                <span className="kbd ml-auto">⌘K</span>
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Mobile navigation">
              {renderNavItems(() => setDrawerOpen(false))}
            </nav>
            <div className="border-t border-gray-100 p-3 dark:border-gray-800">
              <button
                type="button"
                onClick={handleLogout}
                className="pressable flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors duration-150 hover:bg-red-50 dark:hover:bg-red-500/10"
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
      <div className={`flex min-h-screen flex-col transition-all duration-300 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/80">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex items-center gap-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Open menu"
                  className="pressable rounded-xl p-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
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
              <Breadcrumbs />
            </div>

            <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Quick navigation (Ctrl+K)"
                data-tip="Quick jump (⌘K)"
                className="pressable hidden items-center gap-2 rounded-full border border-gray-200/70 bg-gray-50 px-3 py-1.5 text-xs text-gray-500 transition-all duration-200 hover:border-primary-300 hover:bg-white hover:shadow-card hover:text-gray-700 md:inline-flex dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-primary-500/40 dark:hover:text-gray-200"
              >
                <Icon name="search" className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Jump to…</span>
                <span className="kbd">⌘K</span>
              </button>

              <ThemeToggleButton />

              {/* Notification bell */}
              <button
                type="button"
                onClick={() => navigate('/notifications')}
                data-tip="Notifications"
                className="pressable relative rounded-full p-2 text-gray-500 transition-all duration-300 hover:scale-105 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
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
                  className="pressable flex items-center gap-2.5 rounded-full p-1 pr-2 transition-all duration-200 hover:bg-gray-100 hover:shadow-card focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-gray-800"
                >
                  <Avatar name={user?.fullName} size="md" />
                  <span className="hidden text-left xl:block">
                    <span className="block max-w-[160px] truncate text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
                      {user?.fullName}
                    </span>
                    <span className="block text-[11px] font-medium leading-tight text-gray-400 dark:text-gray-500">
                      {user?.role}
                    </span>
                  </span>
                  <svg
                    className={`hidden h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200 sm:block ${
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
                    className="animate-scale-in absolute right-0 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl border border-gray-200/50 bg-white p-1.5 shadow-dropdown ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900 dark:ring-white/10"
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
                      <svg className="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
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
                      <svg className="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
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

        <main key={location.pathname} className="page-enter mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <Outlet />
        </main>

        <footer className="border-t border-gray-200/70 bg-white/60 backdrop-blur dark:border-gray-800 dark:bg-gray-950/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-6 lg:px-8">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              © {new Date().getFullYear()} Smart Education System · Ethiopian High Schools
            </p>
            <div className="flex items-center gap-3 text-xs font-medium text-gray-400 dark:text-gray-500">
              <Link to="/announcements" className="link-underline transition-colors hover:text-primary-600 dark:hover:text-primary-400">News</Link>
              <Link to="/events" className="link-underline transition-colors hover:text-primary-600 dark:hover:text-primary-400">Events</Link>
              <Link to="/library" className="link-underline transition-colors hover:text-primary-600 dark:hover:text-primary-400">Library</Link>
            </div>
          </div>
        </footer>
      </div>

      {/* Back to top */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
        data-tip="Back to top"
        className={`pressable fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-xl ${
          showTop ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}
