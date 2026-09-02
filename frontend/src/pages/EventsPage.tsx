import { useState, FormEvent } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useApi } from '../hooks/useApi';
import { getApiError } from '../utils/apiError';
import {
  buttonPrimary,
  buttonSecondary,
  EmptyState,
  Icon,
  inputStyles,
  labelStyles,
  LoadingState,
  PageHeader,
  Banner,
  Spinner,
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
  usePageTitle('Events');
  const { isAdmin, isTeacher } = useAuth();
  const canPost = isAdmin || isTeacher;
  const { data, loading: loadingEvents, error: loadError, reload } = useApi<SchoolEvent[]>((signal) =>
    api.get('/events', { params: { pageSize: 50 }, signal }).then((res) => res.data.data.events)
  );
  const events = data || [];
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const loading = loadingEvents;
  const error = loadError || actionError;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setActionError('');
    setMessage('');
    // Validate dates before sending - a bypassed/invalid value would
    // otherwise serialize to "Invalid Date" and fail confusingly server-side.
    const startsAt = new Date(form.startsAt);
    if (!form.startsAt || Number.isNaN(startsAt.getTime())) {
      setActionError('Please provide a valid start date and time.');
      return;
    }
    let endsAt: string | undefined;
    if (form.endsAt) {
      const end = new Date(form.endsAt);
      if (Number.isNaN(end.getTime())) {
        setActionError('Please provide a valid end date and time.');
        return;
      }
      if (end.getTime() <= startsAt.getTime()) {
        setActionError('End time must be after the start time.');
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
      reload();
    } catch (err: any) {
      setActionError(getApiError(err, 'Failed to create event'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await api.delete(`/events/${id}`);
      reload();
    } catch (err: any) {
      setActionError(getApiError(err, 'Failed to delete event'));
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
        <div className="mb-4">
          <Banner tone="error" message={error} />
        </div>
      )}
      {message && (
        <div className="mb-4">
          <Banner tone="success" message={message} />
        </div>
      )}

      {canPost && showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-5 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-6"
        >
          <div className="sm:col-span-2">
            <label className={labelStyles}>Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputStyles}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelStyles}>Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputStyles}
            />
          </div>
          <div>
            <label className={labelStyles}>Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className={inputStyles}
              placeholder="e.g. Main hall"
            />
          </div>
          <div>
            <label className={labelStyles}>Audience</label>
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
            <label className={labelStyles}>Starts at *</label>
            <input
              type="datetime-local"
              required
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              className={inputStyles}
            />
          </div>
          <div>
            <label className={labelStyles}>Ends at</label>
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
              {saving && <Spinner />}
              {saving ? 'Creating…' : 'Create Event'}
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
              <li key={ev.id} className="rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{ev.title}</h2>
                      {past && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          Past
                        </span>
                      )}
                    </div>
                    {ev.description && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{ev.description}</p>
                    )}
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="calendar" className="h-3.5 w-3.5" />
                        {new Date(ev.startsAt).toLocaleString()}
                        {ev.endsAt ? ` → ${new Date(ev.endsAt).toLocaleString()}` : ''}
                      </span>
                      {ev.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <Icon name="pin" className="h-3.5 w-3.5" />
                          {ev.location}
                        </span>
                      )}
                      <span className="uppercase tracking-wide">{ev.audience}</span>
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="flex-shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-colors duration-150 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-60 dark:border-red-500/30 dark:bg-gray-900 dark:hover:bg-red-500/10"
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