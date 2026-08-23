import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            Unread only
          </label>
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll || loading}
            className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {markingAll ? 'Marking...' : 'Mark all read'}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-red-600 text-sm">{error}</p>}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <p className="text-gray-500 text-sm">No notifications yet.</p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`bg-white rounded-lg shadow-sm border p-4 flex items-start justify-between gap-4 ${
                n.isRead ? 'border-gray-200' : 'border-l-4 border-l-primary-600'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block text-xs font-medium rounded-full px-2 py-0.5 ${typeStyles[n.type] || typeStyles.GENERAL}`}
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
                  className="flex-shrink-0 text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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