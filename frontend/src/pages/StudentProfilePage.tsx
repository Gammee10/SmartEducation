import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  PageHeader,
  StatCard,
} from '../components/ui';
import type { StudentSummary, StudentAttendanceView, AttendanceStatus } from '../types';

const statusStyles: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-50 text-green-700',
  ABSENT: 'bg-red-50 text-red-700',
  LATE: 'bg-yellow-50 text-yellow-700',
  EXCUSED: 'bg-blue-50 text-blue-700',
};

export default function StudentProfilePage() {
  const { id: studentId } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [attendance, setAttendance] = useState<StudentAttendanceView | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');
  const [error, setError] = useState('');

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

  if (error) return <ErrorState message={error} />;
  if (!summary) return <LoadingState label="Loading profile…" />;

  const s = summary.student;

  return (
    <div>
      <PageHeader
        title={s.user.fullName}
        description={`${s.studentCode} · Grade ${s.gradeLevel}${
          s.section ? ` · Section ${s.section}` : ''
        } · ${s.user.email}`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        <StatCard label="Enrolled Courses" value={summary.stats.enrollments} icon="book" />
        <StatCard label="Attendance Rate" value={`${summary.stats.attendanceRate}%`} icon="clipboard" />
        <StatCard label="Avg Assignment Score" value={summary.stats.avgAssignmentScore} icon="chart" />
        <StatCard label="Avg Quiz Score" value={`${summary.stats.avgQuizScore}%`} icon="cap" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <Card>
          <CardHeader title="Courses" subtitle="Active enrollments this term" />
          {summary.courses.length === 0 ? (
            <EmptyState
              icon="book"
              title="No active enrollments"
              message="This student is not enrolled in any courses right now."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {summary.courses.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                  <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                    <Icon name="book" className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.title}</p>
                    <p className="text-xs text-gray-500">
                      {c.subject} · {c.gradeLevel}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent Quiz Attempts" subtitle="Most recent submissions first" />
          {summary.recentAttempts.length === 0 ? (
            <EmptyState
              icon="clipboard"
              title="No submitted attempts yet"
              message="Quiz attempts will appear here once the student submits one."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {summary.recentAttempts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
                  <p className="min-w-0 truncate text-sm text-gray-900">{a.quiz?.title || 'Quiz'}</p>
                  <span className="inline-flex h-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-50 px-2.5 text-xs font-bold text-primary-700">
                    {a.score ?? '-'} / {a.maxScore ?? '-'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader title="Attendance History" />
        {attendanceLoading ? (
          <LoadingState label="Loading attendance…" />
        ) : attendanceError ? (
          <div className="px-5 py-6 sm:px-6">
            <ErrorState message={attendanceError} />
          </div>
        ) : !attendance || attendance.attendance.length === 0 ? (
          <EmptyState
            icon="clipboard"
            title="No attendance records yet"
            message="Attendance records will appear here once teachers start taking the register."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-6">
                    Date
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-6">
                    Course
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-6">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {attendance.attendance.map((a) => (
                  <tr key={a.id} className="transition-colors duration-150 hover:bg-gray-50">
                    <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-900 sm:px-6">
                      {new Date(a.date).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700 sm:px-6">{a.course?.title}</td>
                    <td className="px-5 py-3 sm:px-6">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-black/[0.04] ${
                          statusStyles[a.status]
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}