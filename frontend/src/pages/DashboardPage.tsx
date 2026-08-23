import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
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
import type {
  AdminDashboardData,
  TeacherDashboardData,
  StudentDashboardData,
} from '../types';

function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/dashboard/admin')
      .then((res) => setData(res.data.data))
      .catch(() => setError('Failed to load dashboard'));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState label="Loading dashboard…" />;

  const s = data.stats;
  const quickLinks = [
    { to: '/courses', label: 'Courses', desc: 'Browse and manage all courses', icon: 'book' as const },
    { to: '/timetable', label: 'Timetable', desc: 'Weekly schedule and slots', icon: 'calendar' as const },
    { to: '/library', label: 'Library', desc: 'Book catalog and borrowing', icon: 'cap' as const },
  ];
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5">
        <StatCard label="Active Courses" value={s.courses} icon="book" />
        <StatCard label="Students" value={s.students} icon="users" />
        <StatCard label="Teachers" value={s.teachers} icon="cap" />
        <StatCard label="Attendance Rate" value={`${s.attendanceRate}%`} icon="clipboard" />
        <StatCard label="Avg Assignment Score" value={s.avgAssignmentScore} icon="chart" />
        <StatCard label="Avg Quiz Score" value={`${s.avgQuizScore}%`} icon="chart" />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-gray-900">Quick Links</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        {quickLinks.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="group flex items-start gap-4 rounded-xl border border-gray-200/80 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors duration-200 group-hover:bg-primary-100">
              <Icon name={l.icon} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-900">{l.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500">{l.desc}</span>
            </span>
          </Link>
        ))}
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

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState label="Loading dashboard…" />;

  const s = data.stats;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        <StatCard label="My Courses" value={s.courses} icon="book" />
        <StatCard label="Enrolled Students" value={s.students} icon="users" />
        <StatCard label="Quizzes" value={s.quizzes} icon="clipboard" />
      </div>

      <Card className="mt-8">
        <CardHeader title="My Courses" />
        {data.courses.length === 0 ? (
          <EmptyState
            icon="book"
            title="No courses yet"
            message="Courses you teach will appear here once they are created."
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.courses.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/courses/${c.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-150 hover:bg-gray-50 sm:px-6"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                    <p className="text-xs text-gray-500">
                      {c.subject} · {c.gradeLevel}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-4 text-xs text-gray-500">
                    <span>{c.enrollments} students</span>
                    <span className="hidden sm:inline">{c.assignments} assignments</span>
                    <span className="hidden sm:inline">{c.quizzes} quizzes</span>
                    <svg
                      className="h-4 w-4 text-gray-300 transition-colors duration-150 hover:text-primary-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5 sm:gap-5">
        <Card>
          <CardHeader title="Recent Submissions" />
          {data.recentSubmissions.length === 0 ? (
            <EmptyState
              icon="clipboard"
              title="No submissions yet"
              message="Student submissions will appear here as they come in."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.recentSubmissions.map((sub) => (
                <li key={sub.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{sub.student?.user?.fullName}</p>
                    <p className="text-xs text-gray-500">Assignment #{sub.assignmentId.slice(0, 8)}</p>
                  </div>
                  <StatusBadge status={sub.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent Grades" />
          {data.recentGrades.length === 0 ? (
            <EmptyState
              icon="chart"
              title="No graded work yet"
              message="Grades you return to students will show up here."
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.recentGrades.map((sub) => (
                <li key={sub.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                  <p className="text-sm text-gray-900">{sub.student?.user?.fullName}</p>
                  <span className="inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-full bg-primary-50 px-2 text-xs font-bold text-primary-700">
                    {sub.score ?? '-'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
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

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState label="Loading dashboard…" />;

  const s = data.stats;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
        <StatCard label="My Courses" value={s.enrollments} icon="book" />
        <StatCard label="Attendance Rate" value={`${s.attendanceRate}%`} icon="clipboard" />
        <StatCard label="Avg Assignment Score" value={s.avgAssignmentScore} icon="chart" />
        <StatCard label="Avg Quiz Score" value={`${s.avgQuizScore}%`} icon="chart" />
      </div>

      <Card className="mt-8">
        <CardHeader title="My Courses" />
        {data.courses.length === 0 ? (
          <EmptyState
            icon="book"
            title="Not enrolled in any courses yet"
            message="Browse the course catalog to see what's available this term."
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.courses.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/courses/${c.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-150 hover:bg-gray-50 sm:px-6"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                    <p className="text-xs text-gray-500">
                      {c.subject} · {c.gradeLevel}
                    </p>
                  </div>
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-gray-300 transition-colors duration-150 hover:text-primary-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function DashboardPage() {
  const { user, isAdmin, isTeacher, isStudent } = useAuth();

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.fullName}`}
        description={
          isAdmin
            ? "Here's an overview of your school today."
            : isTeacher
              ? "Here's what's happening across your classes."
              : "Here's a snapshot of your learning progress."
        }
      />

      {isAdmin && <AdminDashboard />}
      {isTeacher && <TeacherDashboard />}
      {isStudent && <StudentDashboard />}
    </div>
  );
}