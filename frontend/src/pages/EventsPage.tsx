import { useEffect, useState, useCallback, FormEvent } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  buttonPrimary,
  buttonSecondary,
  EmptyState,
  inputStyles,
  labelStyles,
  LoadingState,
  PageHeader,
} from '../components/ui';
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
    setError('');
    setMessage('');
    // Validate dates before sending - a bypassed/invalid value would
    // otherwise serialize to "Invalid Date" and fail confusingly server-side.
    const startsAt = new Date(form.startsAt);
    if (!form.startsAt || Number.isNaN(startsAt.getTime())) {
      setError('Please provide a valid start date and time.');
      return;
    }
    let endsAt: string | undefined;
    if (form.endsAt) {
      const end = new Date(form.endsAt);
      if (Number.isNaN(end.getTime())) {
        setError('Please provide a valid end date and time.');
        return;
      }
      if (end.getTime() <= startsAt.getTime()) {
        setError('End time must be after the start time.');
        return;
      }
      endsAt = end.toISOString();
    }
    setSaving(true);
    try {
      await api.post('/events', {
        title: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
        audience: form.audience,
        startsAt: startsAt.toISOString(),
        endsAt,
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
      <PageHeader
        title="Events"
        description="Upcoming school events and activities."
        actions={
          canPost ? (
            <button
              onClick={() => setShowForm(!showForm)}
              className={showForm ? buttonSecondary : buttonPrimary}
            >
              {showForm ? 'Cancel' : '+ New Event'}
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-xl border border-green-200 dark:border-green-500/30 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}

      {canPost && showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 p-5 shadow-card grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-6"
        >
          <div className="sm:col-span-2">
            <label className={`${labelStyles} mb-1`}>Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputStyles}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={`${labelStyles} mb-1`}>Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputStyles}
            />
          </div>
          <div>
            <label className={`${labelStyles} mb-1`}>Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className={inputStyles}
              placeholder="e.g. Main hall"
            />
          </div>
          <div>
            <label className={`${labelStyles} mb-1`}>Audience</label>
            <select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value as AudienceScope })}
              className={inputStyles}
            >
              <option value="ALL">Everyone</option>
              <option value="TEACHERS">Teachers only</option>
              <option value="STUDENTS">Students only</option>
            </select>
          </div>
          <div>
            <label className={`${labelStyles} mb-1`}>Starts at *</label>
            <input
              type="datetime-local"
              required
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              className={inputStyles}
            />
          </div>
          <div>
            <label className={`${labelStyles} mb-1`}>Ends at</label>
            <input
              type="datetime-local"
              min={form.startsAt || undefined}
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              className={inputStyles}
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className={buttonPrimary}
            >
              {saving ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingState label="Loading events…" />
      ) : events.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No upcoming events"
          message={
            canPost
              ? 'Create the first event so students and teachers can plan ahead.'
              : 'School events will appear here as they are scheduled.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => {
            const past = new Date(ev.startsAt).getTime() < Date.now();
            return (
              <li key={ev.id} className="rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 p-5 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{ev.title}</h2>
                      {past && (
                        <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 dark:text-gray-500">
                          Past
                        </span>
                      )}
                    </div>
                    {ev.description && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">{ev.description}</p>
                    )}
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                      📅 {new Date(ev.startsAt).toLocaleString()}
                      {ev.endsAt ? ` → ${new Date(ev.endsAt).toLocaleString()}` : ''}
                      {ev.location ? ` · 📍 ${ev.location}` : ''} ·{' '}
                      <span className="uppercase tracking-wide">{ev.audience}</span>
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="flex-shrink-0 rounded-lg border border-red-200 dark:border-red-500/30 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-colors duration-150 hover:bg-red-50"
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