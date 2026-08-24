import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { buttonPrimary, buttonSecondary, inputStyles, LoadingState, PageHeader, Banner, EmptyState, Spinner } from '../components/ui';
import type { CourseAttendanceView, AttendanceStatus } from '../types';

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

const statusStyles: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400',
  ABSENT: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
  LATE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400',
  EXCUSED: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400',
};

function getInitials(fullName?: string): string {
  if (!fullName) return '?';
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

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
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors duration-150 hover:text-primary-700 dark:text-gray-400 dark:hover:text-primary-400"
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
            <label htmlFor="attendance-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
        <div className="mb-4">
          <Banner tone="error" message={error} />
        </div>
      )}
      {actionError && (
        <div className="mb-4">
          <Banner tone="error" message={actionError} />
        </div>
      )}
      {savedMsg && (
        <div className="mb-4">
          <Banner tone="success" message={savedMsg} />
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading attendance…" />
      ) : !data ? null : data.enrolledStudents.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03]">
          <EmptyState
            icon="users"
            title="No students enrolled"
            message={isTeacher ? 'Once students enroll in this course, you can mark their attendance here.' : 'You are not enrolled in this course.'}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03]">
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.enrolledStudents.map((student) => {
              const record = data.attendance.find((a) => a.studentId === student.id);
              return (
                <li key={student.id} className="flex items-center justify-between gap-4 px-6 py-4 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-400">
                      {getInitials(student.user?.fullName)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {student.user?.fullName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {student.studentCode}
                        {record?.markedBy ? ` · marked by ${record.markedBy.fullName}` : ''}
                      </p>
                    </div>
                  </div>

                  {isTeacher ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={drafts[student.id] ?? ''}
                        onChange={(e) =>
                          e.target.value &&
                          setDrafts({ ...drafts, [student.id]: e.target.value as AttendanceStatus })
                        }
                        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 shadow-sm transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
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
                          className={buttonSecondary + ' px-3 py-1.5 text-xs'}
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
            {saving && <Spinner />}
            {saving ? 'Saving…' : `Save Attendance (${data.enrolledStudents.filter((s) => drafts[s.id]).length})`}
          </button>
        </div>
      )}
    </div>
  );
}