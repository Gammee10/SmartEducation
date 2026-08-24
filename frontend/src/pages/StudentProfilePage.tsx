import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
} from '../components/ui';
import { AnimatedNumber, ProgressRing } from '../components/motion';
import type { StudentSummary, StudentAttendanceView, AttendanceStatus } from '../types';

const STATUS_META: Record<AttendanceStatus, { bar: string; pill: string }> = {
  PRESENT: { bar: 'bg-emerald-500', pill: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' },
  LATE: { bar: 'bg-amber-400', pill: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400' },
  ABSENT: { bar: 'bg-red-500', pill: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
  EXCUSED: { bar: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
};

const ALL_STATUSES: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

type ProfileTab = 'courses' | 'attempts' | 'attendance';

export default function StudentProfilePage() {
  const { id: studentId } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [attendance, setAttendance] = useState<StudentAttendanceView | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<ProfileTab>('courses');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'ALL'>('ALL');
  const [showAllRecords, setShowAllRecords] = useState(false);
  const VISIBLE_RECORDS = 8;

  useEffect(() => {
    if (!studentId) return;
    api
      .get(`/students/${studentId}/summary`)
      .then((res) => setSummary(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load profile'));
    // Track attendance loading/errors separately so a transient failure is
    // not silently rendered as "No attendance records yet."
    setAttendanceLoading(true);
    setAttendanceError('');
    api
      .get(`/students/${studentId}/attendance`)
      .then((res) => setAttendance(res.data.data))
      .catch((err) =>
        setAttendanceError(err.response?.data?.message || 'Failed to load attendance history')
      )
      .finally(() => setAttendanceLoading(false));
  }, [studentId]);

  const statusCounts = useMemo(() => {
    const counts = new Map<AttendanceStatus, number>();
    (attendance?.attendance || []).forEach((a) => {
      counts.set(a.status, (counts.get(a.status) || 0) + 1);
    });
    return counts;
  }, [attendance]);

  const totalRecords = attendance?.attendance.length ?? 0;

  if (error) return <ErrorState message={error} />;
  if (!summary) return <LoadingState label="Loading profile…" />;

  const s = summary.student;
  const initials = getInitials(s.user.fullName);

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-brand px-6 py-8 shadow-glow sm:px-10 sm:py-10">
        {/* Decorative shapes */}
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-white/10 blur-2xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex flex-wrap items-center gap-5">
          <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold text-white ring-1 ring-inset ring-white/25 backdrop-blur">
            {initials}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
              {s.user.fullName}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/20">
                {s.studentCode}
              </span>
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/20">
                Grade {s.gradeLevel}
              </span>
              {s.section && (
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/20">
                  Section {s.section}
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/20">
                {s.user.email}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Animated stats strip — overlaps the hero */}
      <div className="-mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="animate-fade-up flex items-center gap-3.5 rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-4 sm:p-5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Icon name="book" className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-xl font-bold leading-none tracking-tight text-gray-900 dark:text-gray-100 tabular-nums">
              <AnimatedNumber value={summary.stats.enrollments} />
            </p>
            <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">Enrolled Courses</p>
          </div>
        </div>

        <div className="animate-fade-up flex items-center justify-between gap-3 rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-4 sm:p-5" style={{ animationDelay: '60ms' }}>
          <div>
            <p className="text-xl font-bold leading-none tracking-tight text-gray-900 dark:text-gray-100 tabular-nums">
              <AnimatedNumber value={summary.stats.attendanceRate} suffix="%" />
            </p>
            <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">Attendance Rate</p>
          </div>
          <ProgressRing percent={summary.stats.attendanceRate} size={52} strokeWidth={6} />
        </div>

        <div className="animate-fade-up flex items-center gap-3.5 rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-4 sm:p-5" style={{ animationDelay: '120ms' }}>
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Icon name="chart" className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-xl font-bold leading-none tracking-tight text-gray-900 dark:text-gray-100 tabular-nums">
              <AnimatedNumber value={Number(summary.stats.avgAssignmentScore) || 0} decimals={1} />
            </p>
            <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">Avg Assignment Score</p>
          </div>
        </div>

        <div className="animate-fade-up flex items-center justify-between gap-3 rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-4 sm:p-5" style={{ animationDelay: '180ms' }}>
          <div>
            <p className="text-xl font-bold leading-none tracking-tight text-gray-900 dark:text-gray-100 tabular-nums">
              <AnimatedNumber value={summary.stats.avgQuizScore} suffix="%" />
            </p>
            <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">Avg Quiz Score</p>
          </div>
          <ProgressRing percent={summary.stats.avgQuizScore} size={52} strokeWidth={6} />
        </div>
      </div>

      {/* Section tabs */}
      <div className="mt-8 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
        {(
          [
            { key: 'courses' as const, label: 'Courses', count: summary.courses.length },
            { key: 'attempts' as const, label: 'Quiz Attempts', count: summary.recentAttempts.length },
            { key: 'attendance' as const, label: 'Attendance', count: totalRecords },
          ]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            aria-pressed={activeTab === t.key}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
              activeTab === t.key
                ? 'bg-white dark:bg-gray-900 text-primary-700 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-gray-100'
            }`}
          >
            {t.label}
            <span
              className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                activeTab === t.key ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400' : 'bg-gray-200 text-gray-600 dark:text-gray-400'
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ----------------------------------------------- Courses panel --- */}
      {activeTab === 'courses' && (
        <Card className="mt-6">
          <CardHeader title="Courses" subtitle="Active enrollments this term" />
          {summary.courses.length === 0 ? (
            <EmptyState
              icon="book"
              title="No active enrollments"
              message="This student is not enrolled in any courses right now."
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {summary.courses.map((c, index) => (
                <li
                  key={c.id}
                  className="animate-fade-up flex items-start gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800 sm:px-6"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                    <Icon name="book" className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {c.subject} · {c.gradeLevel}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* --------------------------------------- Recent attempts panel --- */}
      {activeTab === 'attempts' && (
        <Card className="mt-6">
          <CardHeader title="Recent Quiz Attempts" subtitle="Most recent submissions first" />
          {summary.recentAttempts.length === 0 ? (
            <EmptyState
              icon="clipboard"
              title="No submitted attempts yet"
              message="Quiz attempts will appear here once the student submits one."
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {summary.recentAttempts.map((a, index) => {
                const pct =
                  a.score !== null && a.score !== undefined && a.maxScore
                    ? Math.round((a.score / a.maxScore) * 100)
                    : null;
                return (
                  <li
                    key={a.id}
                    className="animate-fade-up px-5 py-4 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800 sm:px-6"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {a.quiz?.title || 'Quiz'}
                      </p>
                      <span className="inline-flex h-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-50 px-2.5 text-xs font-bold text-primary-700">
                        {a.score ?? '-'} / {a.maxScore ?? '-'}
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className={`h-full rounded-full transition-[width] duration-700 ease-out ${
                            pct >= 80
                              ? 'bg-emerald-500'
                              : pct >= 60
                                ? 'bg-primary-500'
                                : pct >= 40
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {/* --------------------------------------- Attendance history panel */}
      {activeTab === 'attendance' && (
        <Card className="mt-6">
          <CardHeader title="Attendance History" subtitle="Filter by status to drill into specific records" />

          {attendanceLoading ? (
            <LoadingState label="Loading attendance…" />
          ) : attendanceError ? (
            <div className="px-5 py-6 sm:px-6">
              <ErrorState message={attendanceError} />
            </div>
          ) : totalRecords === 0 ? (
            <EmptyState
              icon="clipboard"
              title="No attendance records yet"
              message="Attendance records will appear here once teachers start taking the register."
            />
          ) : (
            <>
              {/* Distribution bar */}
              <div className="border-b border-gray-100 dark:border-gray-800 px-5 py-4 sm:px-6">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  {ALL_STATUSES.filter((st) => (statusCounts.get(st) || 0) > 0).map((st) => (
                    <div
                      key={st}
                      className={STATUS_META[st].bar}
                      style={{ width: `${((statusCounts.get(st) || 0) / totalRecords) * 100}%` }}
                      title={`${st}: ${statusCounts.get(st)}`}
                    />
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                  {ALL_STATUSES.filter((st) => (statusCounts.get(st) || 0) > 0).map((st) => (
                    <span key={st} className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className={`h-2 w-2 rounded-full ${STATUS_META[st].bar}`} />
                      {st.charAt(0) + st.slice(1).toLowerCase()}:{' '}
                      <strong className="text-gray-700 dark:text-gray-300">{statusCounts.get(st)}</strong>
                    </span>
                  ))}
                  <span className="text-xs text-gray-400 dark:text-gray-500">Total: {totalRecords}</span>
                </div>
              </div>

              {/* Status filter pills */}
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-5 py-3 sm:px-6">
                {(['ALL', ...ALL_STATUSES] as Array<AttendanceStatus | 'ALL'>).map((option) => {
                  const count = option === 'ALL' ? totalRecords : statusCounts.get(option) || 0;
                  if (count === 0 && option !== 'ALL') return null;
                  const selected = statusFilter === option;
                  return (
                    <button
                      key={option}
                      onClick={() => setStatusFilter(option)}
                      aria-pressed={selected}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                        selected
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {option === 'ALL' ? 'All' : option.charAt(0) + option.slice(1).toLowerCase()}
                      <span className={`ml-1.5 ${selected ? 'text-primary-100' : 'text-gray-400 dark:text-gray-500'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Records table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                        Date
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                        Course
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:px-6">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(attendance?.attendance || [])
                      .filter((a) => statusFilter === 'ALL' || a.status === statusFilter)
                      .slice(0, showAllRecords ? undefined : VISIBLE_RECORDS)
                      .map((a) => (
                        <tr key={a.id} className="transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-900 dark:text-gray-100 sm:px-6">
                            {new Date(a.date).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300 sm:px-6">{a.course?.title}</td>
                          <td className="px-5 py-3 sm:px-6">
                            <span
                              className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-black/[0.04] ${
                                STATUS_META[a.status].pill
                              }`}
                            >
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {(() => {
                  const filteredCount = (attendance?.attendance || []).filter(
                    (a) => statusFilter === 'ALL' || a.status === statusFilter
                  ).length;
                  if (filteredCount === 0) {
                    return (
                      <p className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400 sm:px-6">
                        No records for this status.
                      </p>
                    );
                  }
                  if (filteredCount > VISIBLE_RECORDS) {
                    return (
                      <button
                        type="button"
                        onClick={() => setShowAllRecords(!showAllRecords)}
                        className="w-full border-t border-gray-100 dark:border-gray-800 px-6 py-3 text-sm font-semibold text-primary-700 transition-colors duration-150 hover:bg-primary-50/60 dark:hover:bg-primary-500/10"
                      >
                        {showAllRecords ? 'Show fewer' : `Show all ${filteredCount} records`}
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}