import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import {
  buttonPrimary,
  EmptyState,
  LoadingState,
  PageHeader,
} from '../components/ui';
import type { AppNotification } from '../types';

const typeStyles: Record<string, string> = {
  ASSIGNMENT: 'bg-blue-50 text-blue-700',
  GRADE: 'bg-green-50 text-green-700',
  QUIZ_RESULT: 'bg-purple-50 text-purple-700',
  ANNOUNCEMENT: 'bg-yellow-50 text-yellow-700',
  EVENT: 'bg-pink-50 text-pink-700',
  GENERAL: 'bg-gray-100 text-gray-600',
};

export default function NotificationsPage() {
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
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Unread only
            </label>
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll || loading}
              className={buttonPrimary}
            >
              {markingAll ? 'Marking…' : 'Mark all read'}
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
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
              className={`flex items-start justify-between gap-4 rounded-xl border bg-white p-4 shadow-card ${
                n.isRead ? 'border-gray-200' : 'border-l-4 border-l-primary-600'
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
                    <span className="text-xs font-semibold text-primary-700">New</span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-gray-900">{n.title}</p>
                <p className="text-sm text-gray-600">{n.message}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              {!n.isRead && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  disabled={markingId === n.id}
                  className="flex-shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-60"
                >
                  {markingId === n.id ? 'Marking...' : 'Mark read'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}