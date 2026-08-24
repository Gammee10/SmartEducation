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
} from '../components/ui';
import { AnimatedNumber, ProgressRing } from '../components/motion';
import type {
  AdminDashboardData,
  TeacherDashboardData,
  StudentDashboardData,
} from '../types';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ------------------------------------------------- Interactive cards --- */

const STAT_GRADIENTS = [
  'from-blue-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-violet-500 to-purple-500',
  'from-amber-500 to-orange-500',
] as const;

function CountStatCard({
  label,
  value,
  suffix = '',
  decimals = 0,
  icon,
  tone = 0,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  icon: 'book' | 'users' | 'cap' | 'clipboard' | 'chart';
  tone?: number;
}) {
  const gradient = STAT_GRADIENTS[Math.abs(tone) % STAT_GRADIENTS.length];
  return (
    <div className="group animate-fade-up relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-gray-800 dark:bg-gray-900">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${gradient} opacity-[0.07] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.16]`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <span
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md`}
        >
          <Icon name={icon} />
        </span>
      </div>
      <p className="relative mt-3 text-4xl font-extrabold tracking-tight text-gray-900 tabular-nums dark:text-white">
        <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
      </p>
    </div>
  );
}

function RingStatCard({
  label,
  percent,
  caption,
}: {
  label: string;
  percent: number;
  caption: string;
}) {
  return (
    <div className="animate-fade-up relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-4xl font-extrabold tracking-tight text-gray-900 tabular-nums dark:text-white">
            <AnimatedNumber value={percent} suffix="%" />
          </p>
          <p className="mt-2 text-xs font-medium text-gray-400 dark:text-gray-500">{caption}</p>
        </div>
        <ProgressRing percent={percent} size={68} />
      </div>
    </div>
  );
}

/* -------------------------------------------- Interactive course list --- */

function InteractiveCourseList<
  T extends { id: string; title: string; subject: string; gradeLevel?: string }
>({
  title,
  courses,
  renderMeta,
  emptyTitle,
  emptyMessage,
}: {
  title: string;
  courses: T[];
  renderMeta?: (course: T) => string | undefined;
  emptyTitle: string;
  emptyMessage: string;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const COLLAPSED_COUNT = 4;

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? courses.filter(
        (c) =>
          c.title.toLowerCase().includes(normalized) ||
          c.subject.toLowerCase().includes(normalized) ||
          c.gradeLevel?.toLowerCase().includes(normalized)
      )
    : courses;
  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED_COUNT);
  const hiddenCount = filtered.length - visible.length;

  if (courses.length === 0) {
    return (
      <Card className="animate-fade-up mt-8">
        <CardHeader title={title} />
        <EmptyState icon="book" title={emptyTitle} message={emptyMessage} />
      </Card>
    );
  }

  return (
    <Card className="animate-fade-up mt-8">
      <CardHeader
        title={title}
        subtitle={`${courses.length} course${courses.length === 1 ? '' : 's'}`}
        actions={
          courses.length > 3 ? (
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter…"
                aria-label={`Filter ${title.toLowerCase()}`}
                className="block w-40 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 py-1.5 pl-9 pr-3 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 sm:w-52"
              />
            </div>
          ) : undefined
        }
      />

      {filtered.length === 0 ? (
        <EmptyState icon="search" title="No matching courses" message="Try a different search term." />
      ) : (
        <>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {visible.map((c, index) => (
              <li key={c.id} className="animate-fade-up" style={{ animationDelay: `${index * 50}ms` }}>
                <Link
                  to={`/courses/${c.id}`}
                  className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100 transition-colors duration-150 group-hover:text-primary-700">
                      {c.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {c.subject} · {c.gradeLevel}
                    </p>
                  </div>
                  {renderMeta && (
                    <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">{renderMeta(c)}</span>
                  )}
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-gray-300 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-primary-600"
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

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full border-t border-gray-100 dark:border-gray-800 px-6 py-3 text-sm font-semibold text-primary-700 transition-colors duration-150 hover:bg-primary-50/60 dark:hover:bg-primary-500/10"
            >
              Show all {filtered.length} courses
            </button>
          )}
          {expanded && filtered.length > COLLAPSED_COUNT && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="w-full border-t border-gray-100 dark:border-gray-800 px-6 py-3 text-sm font-semibold text-gray-500 dark:text-gray-400 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Show fewer
            </button>
          )}
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------- Admin dashboard --- */

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        <CountStatCard label="Active Courses" value={s.courses} icon="book" />
        <CountStatCard label="Students" value={s.students} icon="users" />
        <CountStatCard label="Teachers" value={s.teachers} icon="cap" />
        <RingStatCard label="Attendance Rate" percent={s.attendanceRate} caption="school-wide today" />
        <CountStatCard
          label="Avg Assignment Score"
          value={Number(s.avgAssignmentScore) || 0}
          decimals={1}
          icon="chart"
        />
        <RingStatCard label="Avg Quiz Score" percent={s.avgQuizScore} caption="across all quizzes" />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-gray-900 dark:text-gray-100">Quick Links</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        {quickLinks.map((l, index) => (
          <Link
            key={l.to}
            to={l.to}
            className="group animate-fade-up flex items-start gap-4 rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors duration-200 group-hover:bg-primary-100 dark:group-hover:bg-primary-500/20">
              <Icon name={l.icon} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{l.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{l.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

/* ----------------------------------------------- Teacher dashboard --- */

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
        <CountStatCard label="My Courses" value={s.courses} icon="book" />
        <CountStatCard label="Enrolled Students" value={s.students} icon="users" />
        <CountStatCard label="Quizzes" value={s.quizzes} icon="clipboard" />
      </div>

      <InteractiveCourseList
        title="My Courses"
        courses={data.courses}
        renderMeta={(c) =>
          `${c.enrollments} students · ${c.assignments} assignments · ${c.quizzes} quizzes`
        }
        emptyTitle="No courses yet"
        emptyMessage="Courses you teach will appear here once they are created."
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <Card className="animate-fade-up">
          <CardHeader title="Recent Submissions" />
          {data.recentSubmissions.length === 0 ? (
            <EmptyState
              icon="clipboard"
              title="No submissions yet"
              message="Student submissions will appear here as they come in."
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.recentSubmissions.map((sub, index) => (
                <li
                  key={sub.id}
                  className="flex animate-fade-up items-center justify-between gap-3 px-5 py-3 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800 sm:px-6"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{sub.student?.user?.fullName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Assignment #{sub.assignmentId.slice(0, 8)}</p>
                  </div>
                  <StatusBadge status={sub.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="animate-fade-up">
          <CardHeader title="Recent Grades" />
          {data.recentGrades.length === 0 ? (
            <EmptyState
              icon="chart"
              title="No graded work yet"
              message="Grades you return to students will show up here."
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.recentGrades.map((sub, index) => (
                <li
                  key={sub.id}
                  className="flex animate-fade-up items-center justify-between gap-3 px-5 py-3 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800 sm:px-6"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <p className="min-w-0 truncate text-sm text-gray-900 dark:text-gray-100">{sub.student?.user?.fullName}</p>
                  <span className="inline-flex h-7 min-w-[2.25rem] flex-shrink-0 items-center justify-center rounded-full bg-primary-50 px-2 text-xs font-bold text-primary-700">
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

/* ----------------------------------------------- Student dashboard --- */

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        <CountStatCard label="My Courses" value={s.enrollments} icon="book" />
        <RingStatCard label="Attendance Rate" percent={s.attendanceRate} caption="across all classes" />
        <CountStatCard
          label="Avg Assignment Score"
          value={Number(s.avgAssignmentScore) || 0}
          decimals={1}
          icon="chart"
        />
        <RingStatCard label="Avg Quiz Score" percent={s.avgQuizScore} caption="keep it up!" />
      </div>

      <InteractiveCourseList
        title="My Courses"
        courses={data.courses}
        emptyTitle="Not enrolled in any courses yet"
        emptyMessage="Browse the course catalog to see what's available this term."
      />
    </>
  );
}

export default function DashboardPage() {
  const { user, isAdmin, isTeacher, isStudent } = useAuth();

  const hour = new Date().getHours();
  const greeting = greetingForHour(hour);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const roleLine = isAdmin
    ? "Here's an overview of your school today."
    : isTeacher
      ? "Here's what's happening across your classes."
      : "Here's a snapshot of your learning progress.";

  return (
    <div>
      {/* Gradient hero banner */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-brand px-6 py-8 shadow-glow sm:px-10 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-indigo-300/20 blur-3xl"
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">{today}</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
            {greeting}, {user?.fullName?.split(' ')[0]}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-blue-100">{roleLine}</p>
        </div>
      </div>

      {isAdmin && <AdminDashboard />}
      {isTeacher && <TeacherDashboard />}
      {isStudent && <StudentDashboard />}
    </div>
  );
}