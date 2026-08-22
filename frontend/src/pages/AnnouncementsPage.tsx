import { useEffect, useState, useCallback, FormEvent } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Announcement, AudienceScope } from '../types';

const emptyForm = { title: '', body: '', audience: 'ALL' as AudienceScope };

export default function AnnouncementsPage() {
  const { isAdmin, isTeacher } = useAuth();
  const canPost = isAdmin || isTeacher;
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/announcements', { params: { pageSize: 50 } })
      .then((res) => setAnnouncements(res.data.data.announcements))
      .catch(() => setError('Failed to load announcements'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.post('/announcements', form);
      setMessage('Announcement published');
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to publish announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/announcements/${id}`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete announcement');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
        {canPost && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
          >
            {showForm ? 'Cancel' : '+ New Announcement'}
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-red-600 text-sm">{error}</p>}
      {message && <p className="mb-4 text-green-700 text-sm">{message}</p>}

      {canPost && showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body *</label>
            <textarea
              required
              rows={4}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
            <select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value as AudienceScope })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="ALL">Everyone</option>
              <option value="TEACHERS">Teachers only</option>
              <option value="STUDENTS">Students only</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Publishing...' : 'Publish Announcement'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading announcements...</p>
      ) : announcements.length === 0 ? (
        <p className="text-gray-500 text-sm">No announcements yet.</p>
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <li key={a.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900">{a.title}</h2>
                  <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">{a.body}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    {a.publishedBy?.fullName || 'Unknown'} ·{' '}
                    {new Date(a.publishedAt).toLocaleString()} ·{' '}
                    <span className="uppercase tracking-wide">{a.audience}</span>
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="flex-shrink-0 text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}