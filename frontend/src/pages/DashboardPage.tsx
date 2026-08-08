import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user, isAdmin, isTeacher, isStudent } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900">
          Welcome, {user?.fullName}!
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {isAdmin && 'You have administrator access to manage the school system.'}
          {isTeacher && 'You can manage courses, assignments, quizzes, and attendance.'}
          {isStudent && 'You can access your courses, assignments, quizzes, and the library.'}
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700">Library</h3>
            <p className="mt-1 text-xs text-gray-500">
              Browse the book catalog and manage borrowing.
            </p>
          </div>
          {isStudent && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700">My Borrowing</h3>
              <p className="mt-1 text-xs text-gray-500">
                View your borrow requests and active loans.
              </p>
            </div>
          )}
          {isAdmin && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700">Library Admin</h3>
              <p className="mt-1 text-xs text-gray-500">
                Manage books, approve requests, and track returns.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}