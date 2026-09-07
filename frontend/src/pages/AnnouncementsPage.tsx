import { useState, FormEvent } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useApi } from '../hooks/useApi';
import {
  buttonPrimary,
  buttonSecondary,
  EmptyState,
  inputStyles,
  labelStyles,
  LoadingState,
  PageHeader,
  Banner,
  Spinner,
} from '../components/ui';
import type { Announcement, AudienceScope } from '../types';
import { getApiError } from '../utils/apiError';

const emptyForm = { title: '', body: '', audience: 'ALL' as AudienceScope };

export default function AnnouncementsPage() {
  usePageTitle('Announcements');
  const { isAdmin, isTeacher, user } = useAuth();
  const canPost = isAdmin || isTeacher;
  // M17: list loading goes through useApi (abort-safe, server messages,
  // in-place reload for mutations).
  const {
    data: loaded,
    loading,
    error: loadError,
    reload,
  } = useApi<Announcement[]>((signal) =>
    api.get('/announcements', { params: { pageSize: 50 }, signal }).then((res) => res.data.data.announcements)
  );
  const announcements = loaded ?? [];
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  // Load errors surface next to mutation errors (server message preserved).
  const displayError = error || loadError;

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
      reload();
    } catch (err: any) {
      setError(getApiError(err, 'Failed to publish announcement'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/announcements/${id}`);
      reload();
    } catch (err: any) {
      setError(getApiError(err, 'Failed to delete announcement'));
    }
  };

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="School-wide news and updates."
        actions={
          canPost ? (
            <button
              onClick={() => setShowForm(!showForm)}
              className={showForm ? buttonSecondary : buttonPrimary}
            >
              {showForm ? 'Cancel' : '+ New Announcement'}
            </button>
          ) : undefined
        }
      />

      {displayError && (
        <div className="mb-4">
          <Banner tone="error" message={displayError} />
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
          className="mb-6 rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] space-y-4 p-5 sm:p-6"
        >
          <div>
            <label className={labelStyles}>Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputStyles}
            />
          </div>
          <div>
            <label className={labelStyles}>Body *</label>
            <textarea
              required
              rows={4}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className={inputStyles}
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
          <button
            type="submit"
            disabled={saving}
            className={buttonPrimary}
          >
            {saving && <Spinner />}
            {saving ? 'Publishing…' : 'Publish Announcement'}
          </button>
        </form>
      )}

      {loading ? (
        <LoadingState label="Loading announcements…" />
      ) : announcements.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No announcements yet"
          message={
            canPost
              ? 'Publish your first announcement to keep everyone informed.'
              : 'School announcements will appear here.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <li key={a.id} className="rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{a.title}</h2>
                  <p className="mt-1 whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">{a.body}</p>
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    {a.publishedBy?.fullName || 'Unknown'} ·{' '}
                    {new Date(a.publishedAt).toLocaleString()} ·{' '}
                    <span className="uppercase tracking-wide">{a.audience}</span>
                  </p>
                </div>
                {/* M8: owners can delete their own announcements, admins any. */}
                {(isAdmin || a.publishedBy?.id === user?.id) && (
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="flex-shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-colors duration-150 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-60 dark:border-red-500/30 dark:bg-gray-900 dark:hover:bg-red-500/10"
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