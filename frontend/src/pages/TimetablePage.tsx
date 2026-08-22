import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
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
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewSlotForm>({
    courseId: '',
    dayOfWeek: 'MONDAY',
    startTime: '08:00',
    endTime: '09:30',
    room: '',
  });

  const loadSlots = () => {
    setLoading(true);
    api
      .get('/timetable')
      .then((res) => setSlots(res.data.data.slots))
      .catch(() => setError('Failed to load timetable'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSlots();
    if (isAdmin) {
      api
        .get('/courses')
        .then((res) => setCourses(res.data.data.courses || res.data.data))
        .catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    try {
      await api.delete(`/timetable/${id}`);
      loadSlots();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete slot');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Timetable</h1>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
          >
            {showForm ? 'Cancel' : 'Add Slot'}
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-red-600 text-sm">{error}</p>}

      {isAdmin && showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          {formError && (
            <p className="sm:col-span-2 lg:col-span-5 text-red-600 text-sm">{formError}</p>
          )}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Course</label>
            <select
              required
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Day</label>
            <select
              value={form.dayOfWeek}
              onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value as DayOfWeek })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
            <input
              type="time"
              required
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
            <input
              type="time"
              required
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Room (optional)</label>
            <input
              type="text"
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
              placeholder="e.g. Room 12"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Create Slot'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading timetable...</p>
      ) : slots.length === 0 ? (
        <p className="text-gray-500 text-sm">No timetable slots scheduled yet.</p>
      ) : (
        <div className="space-y-6">
          {DAYS.map((day) => {
            const daySlots = slots.filter((s) => s.dayOfWeek === day);
            if (daySlots.length === 0) return null;
            return (
              <div key={day} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-3 border-b border-gray-200">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                    {day}
                  </h2>
                </div>
                <ul className="divide-y divide-gray-100">
                  {daySlots.map((slot) => (
                    <li key={slot.id} className="px-6 py-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {slot.startTime} – {slot.endTime}
                          {slot.room ? ` · ${slot.room}` : ''}
                        </p>
                        <p className="text-xs text-gray-500">
                          {slot.course?.title} ({slot.course?.subject})
                          {slot.teacher?.user?.fullName ? ` · ${slot.teacher.user.fullName}` : ''}
                        </p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(slot.id)}
                          className="text-sm text-red-600 hover:text-red-800"
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