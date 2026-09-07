import { useState, useEffect, useMemo, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useApi } from '../hooks/useApi';
import StatusBadge from '../components/StatusBadge';
import {
  buttonPrimary,
  buttonSecondary,
  EmptyState,
  Icon,
  inputStyles,
  labelStyles,
  PageHeader,
  Banner,
  Spinner,
  SearchInput,
  SegmentedControl,
  Avatar,
  Modal,
} from '../components/ui';
import { Reveal } from '../components/motion';
import type { Course } from '../types';
import { getApiError } from '../utils/apiError';

// Solid professional colors — no gradients, no purple.
const SUBJECT_TILES = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-cyan-600',
  'bg-amber-500',
  'bg-rose-500',
  'bg-slate-600',
];

function subjectTileClass(subject?: string): string {
  if (!subject) return SUBJECT_TILES[0];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash += subject.charCodeAt(i);
  return SUBJECT_TILES[hash % SUBJECT_TILES.length];
}

interface CourseForm {
  title: string;
  description: string;
  subject: string;
  gradeLevel: string;
  status: string;
}

const emptyForm: CourseForm = {
  title: '',
  description: '',
  subject: '',
  gradeLevel: '',
  status: 'DRAFT',
};

type ViewMode = 'grid' | 'list';
type SortMode = 'title' | 'subject' | 'students';

export default function CoursesPage() {
  usePageTitle('Courses');
  const { isTeacher } = useAuth();
  // M17: list loading goes through useApi (abort-safe, server messages,
  // in-place reload for mutations).
  const {
    data: loadedCourses,
    loading,
    error: loadError,
    reload,
  } = useApi<Course[]>((signal) =>
    api.get('/courses', { params: { pageSize: 100 }, signal }).then((response) => response.data.data)
  );
  const courses = useMemo(() => loadedCourses ?? [], [loadedCourses]);
  const [error, setError] = useState('');
  const displayError = error || loadError;
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CourseForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortMode>('title');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');

  const fetchCourses = reload;

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(''), 5000);
    return () => window.clearTimeout(t);
  }, [message]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await api.post('/courses', form);
      setMessage('Course created successfully');
      setShowCreate(false);
      setForm(emptyForm);
      fetchCourses();
    } catch (err: unknown) {
      setError(getApiError(err, 'Failed to create course'));
    } finally {
      setSubmitting(false);
    }
  };

  const subjects = useMemo(() => {
    const set = new Set(courses.map((c) => c.subject).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [courses]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCourses = useMemo(() => {
    let list = normalizedQuery
      ? courses.filter(
          (c) =>
            c.title.toLowerCase().includes(normalizedQuery) ||
            c.subject?.toLowerCase().includes(normalizedQuery) ||
            c.gradeLevel?.toLowerCase().includes(normalizedQuery)
        )
      : [...courses];
    if (subjectFilter !== 'All') list = list.filter((c) => c.subject === subjectFilter);
    list.sort((a, b) => {
      if (sort === 'subject') return (a.subject ?? '').localeCompare(b.subject ?? '');
      if (sort === 'students') return (b._count?.enrollments ?? 0) - (a._count?.enrollments ?? 0);
      return a.title.localeCompare(b.title);
    });
    return list;
  }, [courses, normalizedQuery, subjectFilter, sort]);

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Browse the catalog and manage course content."
        actions={
          isTeacher ? (
            <button
              onClick={() => setShowCreate(true)}
              className={buttonPrimary}
            >
              <Icon name="plus" className="h-4 w-4" />
              Create Course
            </button>
          ) : undefined
        }
      />

      {message && (
        <div className="mb-4">
          <Banner tone="success" message={message} dismissible onDismiss={() => setMessage('')} />
        </div>
      )}
      {displayError && (
        <div className="mb-4">
          <Banner tone="error" message={displayError} dismissible onDismiss={() => setError('')} />
        </div>
      )}

      {/* Toolbar */}
      {!loading && courses.length > 0 && (
        <Reveal className="mb-5 flex flex-col gap-3 rounded-2xl border border-gray-200/70 bg-white p-3 shadow-card sm:p-4 dark:border-gray-800 dark:bg-gray-900 lg:flex-row lg:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by title, subject, or grade…"
            className="w-full lg:max-w-md"
          />
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <label htmlFor="course-sort" className="sr-only">Sort courses</label>
            <select
              id="course-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="cursor-pointer rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:border-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
            >
              <option value="title">Sort: Title</option>
              <option value="subject">Sort: Subject</option>
              <option value="students">Sort: Students</option>
            </select>
            <SegmentedControl<ViewMode>
              value={view}
              onChange={setView}
              size="sm"
              options={[
                { value: 'grid', label: <Icon name="grid" className="h-4 w-4" />, tip: 'Grid view' },
                { value: 'list', label: <Icon name="list" className="h-4 w-4" />, tip: 'List view' },
              ]}
            />
          </div>
        </Reveal>
      )}

      {/* Subject filter chips */}
      {!loading && subjects.length > 2 && (
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by subject">
          {subjects.map((s) => {
            const active = subjectFilter === s;
            const count = s === 'All' ? courses.length : courses.filter((c) => c.subject === s).length;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSubjectFilter(s)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300 hover:-translate-y-px ${
                  active
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-primary-300 hover:text-primary-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-primary-500/40 dark:hover:text-primary-300'
                }`}
              >
                {s}
                <span className={`tnum rounded-full px-1.5 text-[10px] ${active ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3" aria-label="Loading courses">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-card dark:border-gray-800 dark:bg-gray-900">
              <div className="skeleton-shimmer h-24" />
              <div className="space-y-2.5 p-5">
                <div className="skeleton-shimmer h-4 w-3/4 rounded" />
                <div className="skeleton-shimmer h-3 w-1/2 rounded" />
                <div className="skeleton-shimmer h-3 w-full rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState
          icon="book"
          title={isTeacher ? 'No courses yet' : 'No courses available'}
          message={
            isTeacher
              ? 'Create your first course to start adding content, assignments, and quizzes.'
              : 'Check back soon — new courses are added regularly.'
          }
          action={isTeacher ? <button onClick={() => setShowCreate(true)} className={buttonPrimary}><Icon name="plus" className="h-4 w-4" /> Create your first course</button> : undefined}
        />
      ) : filteredCourses.length === 0 ? (
        <EmptyState
          icon="search"
          title={`No matches for “${query.trim() || subjectFilter}”`}
          message="Try a different title, subject, or grade level."
          action={<button onClick={() => { setQuery(''); setSubjectFilter('All'); }} className={buttonSecondary}>Clear filters</button>}
        />
      ) : (
        <>
          <p className="tnum mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {filteredCourses.length} course{filteredCourses.length === 1 ? '' : 's'}
            {subjectFilter !== 'All' && ` in ${subjectFilter}`}
          </p>
          {view === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {filteredCourses.map((course, i) => {
                const teacherName = course.teacher?.user?.fullName || 'Unknown teacher';
                return (
                  <Reveal key={course.id} delay={Math.min(i, 8) * 60} className="h-full">
                    <CourseCard course={course} teacherName={teacherName} />
                  </Reveal>
                );
              })}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-card dark:border-gray-800 dark:bg-gray-900">
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredCourses.map((course, i) => {
                  return (
                    <li key={course.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                      <Link to={`/courses/${course.id}`} className="group flex items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/70">
                        <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${subjectTileClass(course.subject)}`}>
                          <Icon name="book" className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-gray-900 group-hover:text-primary-700 dark:text-gray-100 dark:group-hover:text-primary-300">{course.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                            {course.subject} · {course.gradeLevel} · {course._count?.enrollments || 0} students
                          </span>
                        </span>
                        <StatusBadge status={course.status} />
                        <Icon name="arrow" className="h-4 w-4 flex-shrink-0 text-gray-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary-500" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Create course modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create a new course" wide>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelStyles}>Title *</label>
            <input
              type="text"
              required
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputStyles}
              placeholder="e.g. Grade 10 Mathematics"
            />
          </div>
          <div>
            <label className={labelStyles}>Subject *</label>
            <input
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className={inputStyles}
              placeholder="e.g. Mathematics"
            />
          </div>
          <div>
            <label className={labelStyles}>Grade Level *</label>
            <input
              type="text"
              required
              value={form.gradeLevel}
              onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
              className={inputStyles}
              placeholder="e.g. Grade 9"
            />
          </div>
          <div>
            <label className={labelStyles}>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className={inputStyles}
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
            </select>
          </div>
          <div>
            <label className={labelStyles}>Preview</label>
            <div className={`flex h-[46px] items-center gap-2 rounded-xl px-3 text-white ${subjectTileClass(form.subject || undefined)}`}>
              <Icon name="book" className="h-4 w-4" />
              <span className="truncate text-sm font-semibold">{form.title || 'Course title…'}</span>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelStyles}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className={inputStyles}
              placeholder="What will students learn?"
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={submitting} className={buttonPrimary}>
              {submitting && <Spinner />}
              {submitting ? 'Creating…' : 'Create Course'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className={buttonSecondary}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function CourseCard({ course, teacherName }: { course: Course; teacherName: string }) {
  return (
    <Link
      to={`/courses/${course.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-gray-800 dark:bg-gray-900"
    >
      {/* Solid color header */}
      <div className={`relative flex h-24 items-center justify-between px-6 ${subjectTileClass(course.subject)}`}>
        <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-inset ring-white/25">
          <Icon name="book" className="h-6 w-6" />
        </span>
        <span className="relative">
          <StatusBadge status={course.status} />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-base font-bold leading-snug tracking-tight text-gray-900 transition-colors duration-150 group-hover:text-primary-700 dark:text-gray-100 dark:group-hover:text-primary-300">
              {course.title}
            </h3>
            <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">{course.subject}</p>
          </div>
          <span className="ml-auto flex-shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-bold uppercase text-primary-700 dark:bg-primary-500/10 dark:text-primary-400">
            {course.gradeLevel.replace(/[^0-9]/g, '') || course.gradeLevel}
          </span>
        </div>

        {course.description && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {course.description}
          </p>
        )}

        <div className="mt-auto pt-4">
          <div className="tnum mb-4 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="users" className="h-3.5 w-3.5" />
              {course._count?.enrollments || 0} students
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="inbox" className="h-3.5 w-3.5" />
              {course._count?.content || 0} items
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar name={teacherName} size="sm" />
              <span className="truncate text-xs font-medium text-gray-600 dark:text-gray-400">{teacherName}</span>
            </div>
              <svg
              className="h-4 w-4 flex-shrink-0 text-gray-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
