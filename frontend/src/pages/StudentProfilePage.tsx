import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import type { StudentSummary, StudentAttendanceView, AttendanceStatus } from '../types';

const statusStyles: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-100 text-green-800',
  ABSENT: 'bg-red-100 text-red-800',
  LATE: 'bg-yellow-100 text-yellow-800',
  EXCUSED: 'bg-blue-100 text-blue-800',
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

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

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!summary) return <p className="text-gray-500 text-sm">Loading profile...</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{summary.student.user.fullName}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {summary.student.studentCode} · {summary.student.gradeLevel}
          {summary.student.section ? ` · Section ${summary.student.section}` : ''}
        </p>
        <p className="text-sm text-gray-500">{summary.student.user.email}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Enrolled Courses" value={summary.stats.enrollments} />
        <StatCard label="Attendance Rate" value={`${summary.stats.attendanceRate}%`} />
        <StatCard label="Avg Assignment Score" value={summary.stats.avgAssignmentScore} />
        <StatCard label="Avg Quiz Score" value={`${summary.stats.avgQuizScore}%`} />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Courses</h2>
          </div>
          {summary.courses.length === 0 ? (
            <p className="px-6 py-4 text-sm text-gray-500">No active enrollments.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {summary.courses.map((c) => (
                <li key={c.id} className="px-6 py-3">
                  <p className="text-sm font-medium text-gray-900">{c.title}</p>
                  <p className="text-xs text-gray-500">
                    {c.subject} · {c.gradeLevel}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Quiz Attempts</h2>
          </div>
          {summary.recentAttempts.length === 0 ? (
            <p className="px-6 py-4 text-sm text-gray-500">No submitted attempts yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {summary.recentAttempts.map((a) => (
                <li key={a.id} className="px-6 py-3 flex items-center justify-between">
                  <p className="text-sm text-gray-900">{a.quiz?.title || 'Quiz'}</p>
                  <span className="text-sm font-medium text-primary-700">
                    {a.score ?? '-'} / {a.maxScore ?? '-'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Attendance History</h2>
        </div>
        {attendanceLoading ? (
          <p className="px-6 py-4 text-sm text-gray-500">Loading attendance...</p>
        ) : attendanceError ? (
          <p className="px-6 py-4 text-sm text-red-600">{attendanceError}</p>
        ) : !attendance || attendance.attendance.length === 0 ? (
          <p className="px-6 py-4 text-sm text-gray-500">No attendance records yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Course
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {attendance.attendance.map((a) => (
                <tr key={a.id}>
                  <td className="px-6 py-3 text-sm text-gray-900">
                    {new Date(a.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">{a.course?.title}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyles[a.status]}`}
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
      </div>
    </div>
  );
}
