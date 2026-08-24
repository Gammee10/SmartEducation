import { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  buttonPrimary,
  buttonSecondary,
  EmptyState,
  inputStyles,
  LoadingState,
  PageHeader,
  Banner,
  Spinner,
} from '../components/ui';
import type { TimetableSlot, DayOfWeek, Course } from '../types';

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

interface NewSlotForm {
  courseId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room: string;
}

export default function TimetablePage() {
  const { isAdmin } = useAuth();
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewSlotForm>({
    courseId: '',
    dayOfWeek: 'MONDAY',
    startTime: '08:00',
    endTime: '09:30',
    room: '',
  });

  const loadSlots = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .get('/timetable')
      .then((res) => setSlots(res.data.data.slots))
      .catch(() => setError('Failed to load timetable'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSlots();
    // Surface course-list failures instead of silently rendering an empty
    // course dropdown for admins.
    if (isAdmin) {
      api
        .get('/courses')
        .then((res) => setCourses(res.data.data.courses || res.data.data))
        .catch(() =>
          setError('Failed to load courses. You may not be able to add slots until this is fixed.')
        );
    }
  }, [loadSlots, isAdmin]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.post('/timetable', {
        courseId: form.courseId,
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room || undefined,
      });
      setMessage('Timetable slot created');
      setShowForm(false);
      loadSlots();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create slot');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this timetable slot?')) return;
    setError('');
    setMessage('');
    try {
      await api.delete(`/timetable/${id}`);
      setMessage('Timetable slot deleted');
      loadSlots();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete slot');
    }
  };

  return (
    <div>
      <PageHeader
        title="Timetable"
        description="The weekly schedule of classes."
        actions={
          isAdmin ? (
            <button
              onClick={() => setShowForm(!showForm)}
              className={showForm ? buttonSecondary : buttonPrimary}
            >
              {showForm ? 'Cancel' : 'Add Slot'}
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

      {isAdmin && showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-5 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-5"
        >
          {formError && (
            <div className="sm:col-span-2 lg:col-span-5">
              <Banner tone="error" message={formError} />
            </div>
          )}
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Course</label>
            <select
              required
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              className={inputStyles}
            >
              <option value="">Select a course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.gradeLevel})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Day</label>
            <select
              value={form.dayOfWeek}
              onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value as DayOfWeek })}
              className={inputStyles}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Start Time</label>
            <input
              type="time"
              required
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className={inputStyles}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">End Time</label>
            <input
              type="time"
              required
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className={inputStyles}
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Room (optional)</label>
            <input
              type="text"
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
              placeholder="e.g. Room 12"
              className={inputStyles}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className={buttonPrimary}
            >
              {saving && <Spinner />}
              {saving ? 'Saving…' : 'Create Slot'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingState label="Loading timetable…" />
      ) : slots.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No timetable slots yet"
          message={
            isAdmin
              ? 'Add the first slot to start building the weekly schedule.'
              : 'The weekly schedule will appear here once it is published.'
          }
        />
      ) : (
        <div className="space-y-6">
          {DAYS.map((day) => {
            const daySlots = slots.filter((s) => s.dayOfWeek === day);
            if (daySlots.length === 0) return null;
            return (
              <div key={day} className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03]">
                <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800 sm:px-6">
                  <span className="flex h-8 items-center rounded-lg bg-primary-700 bg-brand px-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
                    {day.slice(0, 3)}
                  </span>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                    {day}
                  </h2>
                  <span className="ml-auto text-xs font-medium text-gray-400 dark:text-gray-500">
                    {daySlots.length} class{daySlots.length === 1 ? '' : 'es'}
                  </span>
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {daySlots.map((slot) => (
                    <li
                      key={slot.id}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/40 sm:px-6"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {slot.startTime} – {slot.endTime}
                          {slot.room ? ` · ${slot.room}` : ''}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {slot.course?.title} ({slot.course?.subject})
                          {slot.teacher?.user?.fullName ? ` · ${slot.teacher.user.fullName}` : ''}
                        </p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(slot.id)}
                          className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors duration-150 hover:border-red-200 hover:bg-red-50 dark:hover:border-red-500/30 dark:hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}