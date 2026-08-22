import { useEffect, useState, useCallback, FormEvent } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { SchoolEvent, AudienceScope } from '../types';

const emptyForm = {
  title: '',
  description: '',
  location: '',
  audience: 'ALL' as AudienceScope,
  startsAt: '',
  endsAt: '',
};

export default function EventsPage() {
  const { isAdmin, isTeacher } = useAuth();
  const canPost = isAdmin || isTeacher;
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/events', { params: { pageSize: 50 } })
      .then((res) => setEvents(res.data.data.events))
      .catch(() => setError('Failed to load events'))
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
      await api.post('/events', {
        title: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
        audience: form.audience,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      });
      setMessage('Event created');
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await api.delete(`/events/${id}`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete event');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        {canPost && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
          >
            {showForm ? 'Cancel' : '+ New Event'}
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-red-600 text-sm">{error}</p>}
      {message && <p className="mb-4 text-green-700 text-sm">{message}</p>}

      {canPost && showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. Main hall"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
            <select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value as AudienceScope })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="ALL">Everyone</option>
              <option value="TEACHERS">Teachers only</option>
              <option value="STUDENTS">Students only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Starts at *</label>
            <input
              type="datetime-local"
              required
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ends at</label>
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading events...</p>
      ) : events.length === 0 ? (
        <p className="text-gray-500 text-sm">No upcoming events.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => {
            const past = new Date(ev.startsAt).getTime() < Date.now();
            return (
              <li key={ev.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-gray-900">{ev.title}</h2>
                      {past && (
                        <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-gray-100 text-gray-500">
                          Past
                        </span>
                      )}
                    </div>
                    {ev.description && (
                      <p className="mt-1 text-sm text-gray-600">{ev.description}</p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">
                      📅 {new Date(ev.startsAt).toLocaleString()}
                      {ev.endsAt ? ` → ${new Date(ev.endsAt).toLocaleString()}` : ''}
                      {ev.location ? ` · 📍 ${ev.location}` : ''} ·{' '}
                      <span className="uppercase tracking-wide">{ev.audience}</span>
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="flex-shrink-0 text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}