// Shared status pill badge with a live dot pulse so states feel alive.
// Colors stay consistent everywhere (courses, assignments, quizzes, library).
const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  PUBLISHED: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  APPROVED: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  RETURNED: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  AVAILABLE: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  GRADED: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  SUBMITTED: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  BORROWED: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  DRAFT: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  PENDING: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  OVERDUE: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  LOST: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  DAMAGED: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  TIME_EXPIRED: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  CLOSED: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  CANCELLED: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  ARCHIVED: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

// Statuses that get a small solid dot for extra scannability.
const DOT_STATUSES = new Set(['ACTIVE', 'AVAILABLE', 'IN_PROGRESS', 'BORROWED', 'PENDING', 'OVERDUE']);

const FALLBACK = 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-black/[0.04] dark:ring-white/10 ${
        STATUS_STYLES[status] ?? FALLBACK
      }`}
    >
      {DOT_STATUSES.has(status) && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      )}
      {status.replace(/_/g, ' ')}
    </span>
  );
}
