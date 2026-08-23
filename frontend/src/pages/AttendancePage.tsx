import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { buttonPrimary, inputStyles, LoadingState, PageHeader } from '../components/ui';
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
  // Local draft of statuses keyed by studentId. A missing entry means the
  // teacher has not marked that student yet - it must NOT be submitted,
  // otherwise saving would fabricate PRESENT records for unmarked students.
  const [drafts, setDrafts] = useState<Record<string, AttendanceStatus | undefined>>({});

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
        const next: Record<string, AttendanceStatus | undefined> = {};
        view.enrolledStudents.forEach((s) => {
          const rec = view.attendance.find((a) => a.studentId === s.id);
          next[s.id] = rec ? rec.status : undefined;
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
      // Only submit students the teacher has explicitly marked.
      const records = data.enrolledStudents
        .filter((s) => drafts[s.id])
        .map((s) => ({
          studentId: s.id,
          courseId,
          date,
          status: drafts[s.id] as AttendanceStatus,
        }));
      if (records.length === 0) {
        setActionError('Mark at least one student before saving.');
        return;
      }
      await api.post('/attendance/upsert', { records });
      setSavedMsg(`Attendance saved for ${records.length} student(s)`);
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
      <div className="mb-6">
        <Link
          to={`/courses/${courseId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors duration-150 hover:text-primary-700"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to course
        </Link>
      </div>
      <PageHeader
        title={data ? `Attendance · ${data.course.title}` : 'Attendance'}
        description={
          isTeacher
            ? 'Mark today’s register or review and correct existing records.'
            : 'Your attendance record for the selected date.'
        }
        actions={
          <div className="flex items-center gap-3">
            <label htmlFor="attendance-date" className="text-sm font-medium text-gray-700">
              Date
            </label>
            <input
              id="attendance-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputStyles}
            />
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}
      {savedMsg && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {savedMsg}
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading attendance…" />
      ) : !data ? null : (
        <div className="rounded-xl border border-gray-200/80 bg-white shadow-card">
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
                        value={drafts[student.id] ?? ''}
                        onChange={(e) =>
                          e.target.value &&
                          setDrafts({ ...drafts, [student.id]: e.target.value as AttendanceStatus })
                        }
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                      >
                        <option value="">Not marked</option>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      {record && (
                        <button
                          onClick={() =>
                            handleCorrect(record.id, drafts[student.id] ?? record.status)
                          }
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50"
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
            className={buttonPrimary}
          >
            {saving ? 'Saving...' : `Save Attendance (${data.enrolledStudents.filter((s) => drafts[s.id]).length})`}
          </button>
        </div>
      )}
    </div>
  );
}