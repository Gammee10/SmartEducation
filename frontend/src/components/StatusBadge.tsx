// Shared status pill badge used across course, assignment, quiz, attempt,
// and library screens so colors stay consistent everywhere.
const STATUS_STYLES: Record<string, string> = {
  // Positive / success
  ACTIVE: 'bg-green-50 text-green-700',
  PUBLISHED: 'bg-green-50 text-green-700',
  APPROVED: 'bg-green-50 text-green-700',
  RETURNED: 'bg-green-50 text-green-700',
  AVAILABLE: 'bg-green-50 text-green-700',
  GRADED: 'bg-green-50 text-green-700',
  // In progress / informational
  SUBMITTED: 'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  BORROWED: 'bg-blue-50 text-blue-700',
  // Pending / draft
  DRAFT: 'bg-yellow-50 text-yellow-700',
  PENDING: 'bg-yellow-50 text-yellow-700',
  // Negative
  REJECTED: 'bg-red-50 text-red-700',
  OVERDUE: 'bg-red-50 text-red-700',
  LOST: 'bg-red-50 text-red-700',
  // Warning
  DAMAGED: 'bg-orange-50 text-orange-700',
  TIME_EXPIRED: 'bg-orange-50 text-orange-700',
  // Neutral
  CLOSED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-gray-100 text-gray-600',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-black/[0.04] ${
        STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}