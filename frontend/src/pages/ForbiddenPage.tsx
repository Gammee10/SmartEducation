// O2: explicit 403 page so role-denied navigation is explainable instead
// of a silent bounce to the dashboard.
import { Link, useLocation } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

export default function ForbiddenPage() {
  usePageTitle('Not allowed');
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-gray-200/70 bg-white p-8 text-center shadow-card dark:border-gray-800 dark:bg-gray-900">
      <p className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">403</p>
      <h1 className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">You don&apos;t have access here</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {from ? (
          <>
            <span className="font-mono">{from}</span> is restricted to a different role.{' '}
          </>
        ) : null}
        If you believe this is a mistake, ask an administrator to check your account role.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
