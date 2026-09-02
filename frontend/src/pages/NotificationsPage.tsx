import { usePageTitle } from '../hooks/usePageTitle';
import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import {
  buttonPrimary,
  buttonSecondary,
  EmptyState,
  LoadingState,
  PageHeader,
  Banner,
  Spinner,
} from '../components/ui';
import type { AppNotification } from '../types';

const typeStyles: Record<string, string> = {
  ASSIGNMENT: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  GRADE: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  QUIZ_RESULT: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  ANNOUNCEMENT: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  EVENT: 'bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400',
  GENERAL: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function NotificationsPage() {
  usePageTitle('Notifications');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/notifications', { params: { unreadOnly: unreadOnly || undefined, pageSize: 50 } })
      .then((res) => setNotifications(res.data.data.notifications))
      .catch(() => setError('Failed to load notifications'))
      .finally(() => setLoading(false));
  }, [unreadOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkRead = async (id: string) => {
    setError('');
    setMarkingId(id);
    try {
      await api.put(`/notifications/${id}/read`);
      // Update locally for instant feedback; drop the item entirely when
      // the "unread only" filter is active.
      setNotifications((prev) =>
        unreadOnly ? prev.filter((n) => n.id !== id) : prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch {
      setError('Failed to mark notification as read');
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setError('');
    setMarkingAll(true);
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => (unreadOnly ? [] : prev.map((n) => ({ ...n, isRead: true }))));
    } catch {
      setError('Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Stay up to date with grades, quizzes, and school updates."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              Unread only
            </label>
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll || loading}
              className={buttonPrimary}
            >
              {markingAll && <Spinner />}
              {markingAll ? 'Marking…' : 'Mark all read'}
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Banner tone="error" message={error} />
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading notifications…" />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="bell"
          title={unreadOnly ? 'You’re all caught up' : 'No notifications yet'}
          message={
            unreadOnly
              ? 'There are no unread notifications right now.'
              : 'Grades, quiz results, and announcements will show up here.'
          }
        />
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`flex items-start justify-between gap-4 rounded-2xl border bg-white p-4 shadow-card transition-colors duration-150 dark:bg-gray-900 ${
                n.isRead
                  ? 'border-gray-200 dark:border-gray-800'
                  : 'border-l-4 border-l-primary-600 border-y-transparent border-r-transparent bg-primary-50/40 dark:border-l-primary-500 dark:bg-primary-500/10'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-black/[0.04] ${typeStyles[n.type] || typeStyles.GENERAL}`}
                  >
                    {n.type}
                  </span>
                  {!n.isRead && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-primary-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-600 dark:bg-primary-400" aria-hidden="true" />
                      New
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{n.message}</p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              {!n.isRead && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  disabled={markingId === n.id}
                  className={buttonSecondary + ' flex-shrink-0 px-3 py-1.5 text-xs'}
                >
                  {markingId === n.id && <Spinner className="h-3.5 w-3.5" />}
                  {markingId === n.id ? 'Marking…' : 'Mark read'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}