import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { CourseAttendanceView, AttendanceStatus } from '../types';

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

const statusStyles: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-100 text-green-800',
  ABSENT: 'bg-red-100 text-red-800',
  LATE: 'bg-yellow-100 text-yellow-800',
  EXCUSED: 'bg-blue-100 text-blue-800',
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { id: courseId } = useParams<{ id: string }>();
  const { isTeacher } = useAuth();
  const [data, setData] = useState<CourseAttendanceView | null>(null);
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  // Local draft of statuses keyed by studentId
  const [drafts, setDrafts] = useState<Record<string, AttendanceStatus>>({});

  const load = useCallback(() => {
    if (!courseId) return;
    setLoading(true);
    setError('');
    api
      .get(`/courses/${courseId}/attendance`, { params: { date } })
      .then((res) => {
        const view: CourseAttendanceView = res.data.data;
        setData(view);
        // Pre-fill drafts from existing records
        const next: Record<string, AttendanceStatus> = {};
        view.enrolledStudents.forEach((s) => {
          const rec = view.attendance.find((a) => a.studentId === s.id);
          next[s.id] = rec ? rec.status : 'PRESENT';
        });
        setDrafts(next);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load attendance'))
      .finally(() => setLoading(false));
  }, [courseId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveAll = async () => {
    if (!courseId || !data) return;
    setActionError('');
    setSavedMsg('');
    setSaving(true);
    try {
      const records = data.enrolledStudents.map((s) => ({
        studentId: s.id,
        courseId,
        date,
        status: drafts[s.id] || 'PRESENT',
      }));
      await api.post('/attendance/upsert', { records });
      setSavedMsg('Attendance saved');
      load();
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleCorrect = async (attendanceId: string, status: AttendanceStatus) => {
    setActionError('');
    setSavedMsg('');
    try {
      await api.put(`/attendance/${attendanceId}`, { status });
      setSavedMsg('Attendance corrected');
      load();
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to correct attendance');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <Link to={`/courses/${courseId}`} className="text-sm text-primary-700 hover:underline">
            ← Back to course
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {data ? `Attendance · ${data.course.title}` : 'Attendance'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="mb-4 text-red-600 text-sm">{error}</p>}
      {actionError && <p className="mb-4 text-red-600 text-sm">{actionError}</p>}
      {savedMsg && <p className="mb-4 text-green-700 text-sm">{savedMsg}</p>}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading attendance...</p>
      ) : !data ? null : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <ul className="divide-y divide-gray-100">
            {data.enrolledStudents.map((student) => {
              const record = data.attendance.find((a) => a.studentId === student.id);
              return (
                <li key={student.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {student.user?.fullName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {student.studentCode}
                      {record?.markedBy ? ` · marked by ${record.markedBy.fullName}` : ''}
                    </p>
                  </div>

                  {isTeacher ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={drafts[student.id] || 'PRESENT'}
                        onChange={(e) =>
                          setDrafts({ ...drafts, [student.id]: e.target.value as AttendanceStatus })
                        }
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      {record && (
                        <button
                          onClick={() => handleCorrect(record.id, drafts[student.id] || 'PRESENT')}
                          className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Correct
                        </button>
                      )}
                    </div>
                  ) : (
                    record && (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyles[record.status]}`}
                      >
                        {record.status}
                      </span>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {isTeacher && data && data.enrolledStudents.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>
      )}
    </div>
  );
}