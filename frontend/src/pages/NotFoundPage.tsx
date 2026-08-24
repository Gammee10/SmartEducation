import { Link } from 'react-router-dom';
import { buttonPrimary } from '../components/ui';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center sm:py-28">
      <p className="bg-gradient-to-b from-primary-600 to-primary-800 bg-clip-text text-7xl font-extrabold tracking-tight text-transparent sm:text-8xl">
        404
      </p>
      <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400 dark:text-gray-500">
        The page you are looking for does not exist or has been moved. Check the URL or head
        back to your dashboard.
      </p>
      <div className="mt-6 flex items-center gap-3">
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
      </div>
    </div>
  );
}