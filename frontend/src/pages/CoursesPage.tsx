import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import {
  buttonPrimary,
  buttonSecondary,
  EmptyState,
  Icon,
  inputStyles,
  labelStyles,
  LoadingState,
  PageHeader,
  Banner,
  Spinner,
} from '../components/ui';
import type { Course } from '../types';

// Static Tailwind classes only, so the JIT compiler keeps them all.
const SUBJECT_TILES = [
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-violet-500 to-purple-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-sky-600 to-indigo-600',
];

function subjectTileClass(subject?: string): string {
  if (!subject) return SUBJECT_TILES[0];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash += subject.charCodeAt(i);
  return SUBJECT_TILES[hash % SUBJECT_TILES.length];
}

function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
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

export default function CoursesPage() {
  const { isTeacher } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CourseForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/courses', { params: { pageSize: 100 } });
      setCourses(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

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
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create course');
    } finally {
      setSubmitting(false);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCourses = normalizedQuery
    ? courses.filter(
        (c) =>
          c.title.toLowerCase().includes(normalizedQuery) ||
          c.subject?.toLowerCase().includes(normalizedQuery) ||
          c.gradeLevel?.toLowerCase().includes(normalizedQuery)
      )
    : courses;

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Browse the catalog and manage course content."
        actions={
          isTeacher ? (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className={showCreate ? buttonSecondary : buttonPrimary}
            >
              {showCreate ? 'Cancel' : '+ Create Course'}
            </button>
          ) : undefined
        }
      />

      {message && (
        <div className="mb-4">
          <Banner tone="success" message={message} />
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Banner tone="error" message={error} />
        </div>
      )}

      {showCreate && isTeacher && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 p-5 shadow-card grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-6">
          <div className="sm:col-span-2">
            <label className={labelStyles}>Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputStyles}
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
          <div className="sm:col-span-2">
            <label className={labelStyles}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className={inputStyles}
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className={buttonPrimary}
            >
              {submitting && <Spinner />}
              {submitting ? 'Creating…' : 'Create Course'}
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      {!loading && courses.length > 0 && (
        <div className="relative mb-5 max-w-md">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
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
            placeholder="Search by title, subject, or grade…"
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 py-2.5 pl-10 pr-3.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading courses…" />
      ) : courses.length === 0 ? (
        <EmptyState
          icon="book"
          title={isTeacher ? 'No courses yet' : 'No courses available'}
          message={
            isTeacher
              ? 'Create your first course to start adding content, assignments, and quizzes.'
              : 'Check back soon — new courses are added regularly.'
          }
        />
      ) : filteredCourses.length === 0 ? (
        <EmptyState
          icon="search"
          title={`No matches for “${query.trim()}”`}
          message="Try a different title, subject, or grade level."
        />
      ) : (
        <>
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {filteredCourses.length} course{filteredCourses.length === 1 ? '' : 's'}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {filteredCourses.map((course) => {
              const teacherName = course.teacher?.user?.fullName || 'Unknown teacher';
              return (
                <CourseCard key={course.id} course={course} teacherName={teacherName} />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CourseCard({ course, teacherName }: { course: Course; teacherName: string }) {
  return (
    <Link
      to={`/courses/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-gray-800 dark:bg-gray-900"
    >
      {/* Gradient header */}
      <div className={`relative flex h-24 items-center justify-between bg-gradient-to-br px-6 ${subjectTileClass(course.subject)}`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-white/15 blur-xl transition-opacity duration-300 group-hover:opacity-80"
        />
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-inset ring-white/25 backdrop-blur">
          <Icon name="book" className="h-6 w-6" />
        </span>
        <StatusBadge status={course.status} />
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-base font-bold leading-snug tracking-tight text-gray-900 transition-colors duration-150 group-hover:text-primary-700 dark:text-gray-100">
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
          <div className="mb-4 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
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
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-[10px] font-bold text-white shadow-sm">
                {getInitials(teacherName)}
              </span>
              <span className="truncate text-xs font-medium text-gray-600 dark:text-gray-400">{teacherName}</span>
            </div>
            <svg
              className="h-4 w-4 flex-shrink-0 text-gray-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-primary-600"
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