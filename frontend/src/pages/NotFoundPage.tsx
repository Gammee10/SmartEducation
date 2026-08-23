import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="text-center py-20">
      <p className="text-6xl font-bold text-primary-600">404</p>
      <h1 className="mt-4 text-xl font-semibold text-gray-900">Page not found</h1>
      <p className="mt-2 text-sm text-gray-500">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}