import { Link } from 'react-router-dom';
import { buttonPrimary, buttonSecondary, Icon } from '../components/ui';

const SHORTCUTS = [
  { to: '/courses', label: 'Courses', icon: 'book' as const },
  { to: '/timetable', label: 'Timetable', icon: 'calendar' as const },
  { to: '/library', label: 'Library', icon: 'cap' as const },
];

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center sm:py-28">
      <p className="text-7xl font-extrabold tracking-tight text-primary-600 dark:text-primary-400 sm:text-8xl">
        404
      </p>
      <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">
        The page you are looking for does not exist or has been moved. Pick a shortcut
        below or head back to your dashboard.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link to="/" className={buttonPrimary}>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>
        <Link to="/courses" className={buttonSecondary}>
          Browse courses
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {SHORTCUTS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-600 shadow-sm transition-all duration-300 hover:-translate-y-px hover:border-primary-300 hover:text-primary-700 hover:shadow-card dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-primary-500/40 dark:hover:text-primary-300"
          >
            <Icon name={s.icon} className="h-3.5 w-3.5" />
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
