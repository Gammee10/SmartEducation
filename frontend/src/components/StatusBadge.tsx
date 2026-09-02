// Shared status pill badge used across course, assignment, quiz, attempt,
// and library screens so colors stay consistent everywhere.
const STATUS_STYLES: Record<string, string> = {
  // Positive / success
  ACTIVE: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  PUBLISHED: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  APPROVED: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  RETURNED: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  AVAILABLE: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  GRADED: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  // In progress / informational
  SUBMITTED: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  BORROWED: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  // Pending / draft
  DRAFT: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  PENDING: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  // Negative
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  OVERDUE: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  LOST: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  // Warning
  DAMAGED: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  TIME_EXPIRED: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  // Neutral
  CLOSED: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  CANCELLED: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  ARCHIVED: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-black/[0.04] dark:ring-white/10 ${
        STATUS_STYLES[status] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}