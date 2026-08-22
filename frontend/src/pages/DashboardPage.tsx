import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import type {
  AdminDashboardData,
  TeacherDashboardData,
  StudentDashboardData,
} from '../types';

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/dashboard/admin')
      .then((res) => setData(res.data.data))
      .catch(() => setError('Failed to load dashboard'));
  }, []);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!data) return <p className="text-gray-500 text-sm">Loading dashboard...</p>;

  const s = data.stats;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Active Courses" value={s.courses} />
        <StatCard label="Students" value={s.students} />
        <StatCard label="Teachers" value={s.teachers} />
        <StatCard label="Attendance Rate" value={`${s.attendanceRate}%`} />
        <StatCard label="Avg Assignment Score" value={s.avgAssignmentScore} />
        <StatCard label="Avg Quiz Score" value={`${s.avgQuizScore}%`} />
      </div>
    </>
  );
}

function TeacherDashboard() {
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/dashboard/teacher')
      .then((res) => setData(res.data.data))
      .catch(() => setError('Failed to load dashboard'));
  }, []);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!data) return <p className="text-gray-500 text-sm">Loading dashboard...</p>;

  const s = data.stats;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="My Courses" value={s.courses} />
        <StatCard label="Enrolled Students" value={s.students} />
        <StatCard label="Quizzes" value={s.quizzes} />
      </div>

      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">My Courses</h2>
        </div>
        {data.courses.length === 0 ? (
          <p className="px-6 py-4 text-sm text-gray-500">No courses yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.courses.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/courses/${c.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.title}</p>
                    <p className="text-xs text-gray-500">
                      {c.subject} · {c.gradeLevel}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 space-x-4">
                    <span>{c.enrollments} students</span>
                    <span>{c.assignments} assignments</span>
                    <span>{c.quizzes} quizzes</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Submissions</h2>
          </div>
          {data.recentSubmissions.length === 0 ? (
            <p className="px-6 py-4 text-sm text-gray-500">No submissions yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.recentSubmissions.map((sub) => (
                <li key={sub.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-900">{sub.student?.user?.fullName}</p>
                    <p className="text-xs text-gray-500">Assignment #{sub.assignmentId.slice(0, 8)}</p>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-gray-400">{sub.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Grades</h2>
          </div>
          {data.recentGrades.length === 0 ? (
            <p className="px-6 py-4 text-sm text-gray-500">No graded work yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.recentGrades.map((sub) => (
                <li key={sub.id} className="px-6 py-3 flex items-center justify-between">
                  <p className="text-sm text-gray-900">{sub.student?.user?.fullName}</p>
                  <span className="text-sm font-medium text-primary-700">{sub.score ?? '-'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function StudentDashboard() {
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/dashboard/student')
      .then((res) => setData(res.data.data))
      .catch(() => setError('Failed to load dashboard'));
  }, []);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!data) return <p className="text-gray-500 text-sm">Loading dashboard...</p>;

  const s = data.stats;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Courses" value={s.enrollments} />
        <StatCard label="Attendance Rate" value={`${s.attendanceRate}%`} />
        <StatCard label="Avg Assignment Score" value={s.avgAssignmentScore} />
        <StatCard label="Avg Quiz Score" value={`${s.avgQuizScore}%`} />
      </div>

      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">My Courses</h2>
        </div>
        {data.courses.length === 0 ? (
          <p className="px-6 py-4 text-sm text-gray-500">You are not enrolled in any courses yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.courses.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/courses/${c.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.title}</p>
                    <p className="text-xs text-gray-500">
                      {c.subject} · {c.gradeLevel}
                    </p>
                  </div>
                  <span className="text-sm text-primary-700">View →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { user, isAdmin, isTeacher, isStudent } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Welcome back, {user?.fullName}
      </h1>

      {isAdmin && <AdminDashboard />}
      {isTeacher && <TeacherDashboard />}
      {isStudent && <StudentDashboard />}
    </div>
  );
}