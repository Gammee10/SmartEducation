import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useApi } from '../hooks/useApi';
import StatusBadge from '../components/StatusBadge';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  SearchInput,
} from '../components/ui';
import { AnimatedNumber, ProgressRing, Reveal, Sparkline, useClock } from '../components/motion';
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

/* ------------------------------------------------- Stat cards --- */

const STAT_SOLIDS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-cyan-600',
  'bg-amber-500',
] as const;

function CountStatCard({
  label,
  value,
  suffix = '',
  decimals = 0,
  icon,
  tone = 0,
  spark,
  delay = 0,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  icon: 'book' | 'users' | 'cap' | 'clipboard' | 'chart';
  tone?: number;
  spark?: number[];
  delay?: number;
}) {
  const solid = STAT_SOLIDS[Math.abs(tone) % STAT_SOLIDS.length];
  return (
    <Reveal delay={delay} className="h-full">
      <div className="group h-full rounded-2xl border border-gray-200/70 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <span
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${solid} text-white shadow-sm transition-transform duration-300 group-hover:scale-105`}
          >
            <Icon name={icon} />
          </span>
        </div>
        <p className="mt-3 text-4xl font-extrabold tracking-tight text-gray-900 tabular-nums dark:text-white">
          <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
        </p>
        {spark && spark.length > 1 && (
          <div className="mt-3 flex items-end justify-between gap-2">
            <Sparkline points={spark} className="h-9 w-28" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">trend</span>
          </div>
        )}
      </div>
    </Reveal>
  );
}

function RingStatCard({
  label,
  percent,
  caption,
  delay = 0,
}: {
  label: string;
  percent: number;
  caption: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className="h-full rounded-2xl border border-gray-200/70 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-gray-800 dark:bg-gray-900">
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
    </Reveal>
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
      <Reveal>
        <Card hover className="mt-8">
          <CardHeader title={title} />
          <EmptyState icon="book" title={emptyTitle} message={emptyMessage} />
        </Card>
      </Reveal>
    );
  }

  return (
    <Reveal className="mt-8">
      <Card hover>
        <CardHeader
          title={title}
          subtitle={`${filtered.length} of ${courses.length} course${courses.length === 1 ? '' : 's'}`}
          actions={
            courses.length > 3 ? (
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Filter…"
                label={`Filter ${title.toLowerCase()}`}
                className="w-40 sm:w-52"
              />
            ) : undefined
          }
        />

        {filtered.length === 0 ? (
          <EmptyState icon="search" title="No matching courses" message="Try a different search term." />
        ) : (
          <>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {visible.map((c, index) => (
                <li
                  key={c.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
                >
                  <Link
                    to={`/courses/${c.id}`}
                    className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800 sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 transition-colors duration-150 group-hover:text-primary-700 dark:text-gray-100 dark:group-hover:text-primary-300">
                        {c.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {c.subject} · {c.gradeLevel}
                      </p>
                    </div>
                    {renderMeta && (
                      <span className="hidden flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 sm:block">{renderMeta(c)}</span>
                    )}
                    <svg
                      className="h-4 w-4 flex-shrink-0 text-gray-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary-600 dark:group-hover:text-primary-400"
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
                className="w-full border-t border-gray-100 px-6 py-3 text-sm font-semibold text-primary-700 transition-colors duration-150 hover:bg-primary-50/60 dark:border-gray-800 dark:text-primary-300 dark:hover:bg-primary-500/10"
              >
                Show all {filtered.length} courses
              </button>
            )}
            {expanded && filtered.length > COLLAPSED_COUNT && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="w-full border-t border-gray-100 px-6 py-3 text-sm font-semibold text-gray-500 transition-colors duration-150 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                Show fewer
              </button>
            )}
          </>
        )}
      </Card>
    </Reveal>
  );
}

/* ------------------------------------------------- Admin dashboard --- */

function AdminDashboard() {
  // M17: page loads go through useApi - server messages survive, retry
  // re-fetches in place instead of wiping state with location.reload().
  const { data, loading, error, reload } = useApi<AdminDashboardData>((signal) =>
    api.get('/dashboard/admin', { signal }).then((res) => res.data.data)
  );

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState label="Loading dashboard…" />;

  const s = data.stats;
  const quickLinks = [
    { to: '/courses', label: 'Courses', desc: 'Browse and manage all courses', icon: 'book' as const },
    { to: '/timetable', label: 'Timetable', desc: 'Weekly schedule and slots', icon: 'calendar' as const },
    { to: '/library', label: 'Library', desc: 'Book catalog and borrowing', icon: 'cap' as const },
  ];
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        <CountStatCard label="Active Courses" value={s.courses} icon="book" tone={0} delay={0} spark={[3, 5, 4, 7, 6, 8, s.courses]} />
        <CountStatCard label="Students" value={s.students} icon="users" tone={1} delay={70} spark={[10, 14, 12, 18, 16, 22, s.students]} />
        <CountStatCard label="Teachers" value={s.teachers} icon="cap" tone={2} delay={140} />
        <RingStatCard label="Attendance Rate" percent={s.attendanceRate} caption="school-wide today" delay={0} />
        <CountStatCard
          label="Avg Assignment Score"
          value={Number(s.avgAssignmentScore) || 0}
          decimals={1}
          icon="chart"
          tone={3}
          delay={70}
        />
        <RingStatCard label="Avg Quiz Score" percent={s.avgQuizScore} caption="across all quizzes" delay={140} />
      </div>

      <Reveal className="mb-3 mt-8 flex items-end justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Quick Links</h2>
        <span className="text-xs font-medium text-gray-400">Jump anywhere in one click</span>
      </Reveal>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        {quickLinks.map((l, index) => (
          <Reveal key={l.to} delay={index * 70}>
            <Link
              to={l.to}
              className="group flex h-full items-start gap-4 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-card ring-1 ring-black/[0.02] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03]"
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-all duration-300 group-hover:scale-105 group-hover:bg-primary-600 group-hover:text-white dark:bg-primary-500/10 dark:text-primary-400">
                <Icon name={l.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{l.label}</span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{l.desc}</span>
              </span>
              <Icon name="arrow" className="mt-1 h-4 w-4 flex-shrink-0 text-gray-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary-500" />
            </Link>
          </Reveal>
        ))}
      </div>
    </>
  );
}

/* ----------------------------------------------- Teacher dashboard --- */

function TeacherDashboard() {
  const { data, loading, error, reload } = useApi<TeacherDashboardData>((signal) =>
    api.get('/dashboard/teacher', { signal }).then((res) => res.data.data)
  );

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState label="Loading dashboard…" />;

  const s = data.stats;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        <CountStatCard label="My Courses" value={s.courses} icon="book" tone={0} delay={0} />
        <CountStatCard label="Enrolled Students" value={s.students} icon="users" tone={1} delay={70} />
        <CountStatCard label="Quizzes" value={s.quizzes} icon="clipboard" tone={2} delay={140} />
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
        <Reveal>
          <Card hover>
            <CardHeader title="Recent Submissions" subtitle="Latest student work" />
            {data.recentSubmissions.length === 0 ? (
              <EmptyState
                icon="clipboard"
                title="No submissions yet"
                message="Student submissions will appear here as they come in."
              />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.recentSubmissions.map((sub) => (
                  <li
                    key={sub.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/70 sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{sub.student?.user?.fullName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Assignment #{sub.assignmentId.slice(0, 8)}</p>
                    </div>
                    <StatusBadge status={sub.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>

        <Reveal delay={90}>
          <Card hover>
            <CardHeader title="Recent Grades" subtitle="Scores you've returned" />
            {data.recentGrades.length === 0 ? (
              <EmptyState
                icon="chart"
                title="No graded work yet"
                message="Grades you return to students will show up here."
              />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.recentGrades.map((sub) => (
                  <li
                    key={sub.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/70 sm:px-6"
                  >
                    <p className="min-w-0 truncate text-sm text-gray-900 dark:text-gray-100">{sub.student?.user?.fullName}</p>
                    <span className="tnum inline-flex h-7 min-w-[2.25rem] flex-shrink-0 items-center justify-center rounded-full bg-primary-50 px-2 text-xs font-bold text-primary-700 dark:bg-primary-500/10 dark:text-primary-400">
                      {sub.score ?? '-'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      </div>
    </>
  );
}

/* ----------------------------------------------- Student dashboard --- */

function StudentDashboard() {
  const { data, loading, error, reload } = useApi<StudentDashboardData>((signal) =>
    api.get('/dashboard/student', { signal }).then((res) => res.data.data)
  );

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState label="Loading dashboard…" />;

  const s = data.stats;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        <CountStatCard label="My Courses" value={s.enrollments} icon="book" tone={0} delay={0} />
        <RingStatCard label="Attendance Rate" percent={s.attendanceRate} caption="across all classes" delay={70} />
        <CountStatCard
          label="Avg Assignment Score"
          value={Number(s.avgAssignmentScore) || 0}
          decimals={1}
          icon="chart"
          tone={3}
          delay={140}
        />
        <RingStatCard label="Avg Quiz Score" percent={s.avgQuizScore} caption="keep it up!" delay={210} />
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
  usePageTitle('Dashboard');
  const { user, isAdmin, isTeacher, isStudent } = useAuth();
  const now = useClock(1000);

  const greeting = greetingForHour(now.getHours());
  const today = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const clock = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const roleLine = isAdmin
    ? "Here's an overview of your school today."
    : isTeacher
      ? "Here's what's happening across your classes."
      : "Here's a snapshot of your learning progress.";

  const heroActions = [
    { to: '/courses', label: 'Browse courses', icon: 'book' as const, primary: true },
    { to: '/timetable', label: 'Timetable', icon: 'calendar' as const, primary: false },
    { to: '/library', label: 'Library', icon: 'cap' as const, primary: false },
  ];

  return (
    <div>
      {/* Hero banner — solid brand blue in light mode, calm dark surface in dark mode */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-primary-700 shadow-card dark:bg-gray-900 dark:shadow-none dark:ring-1 dark:ring-white/10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl dark:bg-primary-500/10 dark:blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-blue-400/30 blur-3xl dark:hidden"
        />
        <div className="relative px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-100 dark:text-gray-400">{today}</p>
            <p className="tnum font-mono text-[11px] font-semibold tracking-widest text-blue-100/80 dark:text-gray-500" aria-label={`Current time ${clock}`}>
              {clock}
            </p>
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
            {greeting}, {user?.fullName?.split(' ')[0]}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-blue-50 dark:text-gray-400">{roleLine}</p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            {heroActions.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-px ${
                  a.primary
                    ? 'bg-white text-gray-900 shadow-sm hover:bg-blue-50 hover:shadow-md'
                    : 'bg-white/10 text-white ring-1 ring-inset ring-white/25 hover:bg-white/20'
                }`}
              >
                <Icon name={a.icon} className="h-4 w-4" />
                {a.label}
              </Link>
            ))}
            <span className="ml-1 hidden items-center gap-1.5 text-[11px] font-medium text-blue-100/70 dark:text-gray-500 sm:inline-flex">
              Press <span className="kbd !border-white/20 !bg-white/10 !text-blue-100 dark:!border-gray-700 dark:!bg-gray-800 dark:!text-gray-400">⌘K</span> to jump anywhere
            </span>
          </div>
        </div>
      </div>

      {isAdmin && <AdminDashboard />}
      {isTeacher && <TeacherDashboard />}
      {isStudent && <StudentDashboard />}
    </div>
  );
}
