import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import {
  buttonPrimary,
  buttonSecondary,
  EmptyState,
  inputStyles,
  labelStyles,
  LoadingState,
  Banner,
} from '../components/ui';
import type { Course, ContentItem, Assignment, Quiz } from '../types';

interface ContentForm {
  title: string;
  description: string;
  url: string;
  type: string;
}

interface AssignmentForm {
  title: string;
  instructions: string;
  maxScore: string;
  dueDate: string;
  status: string;
}

interface QuizForm {
  title: string;
  description: string;
  timeLimit: string;
  maxAttempts: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  status: string;
}

type TabKey = 'content' | 'assignments' | 'quizzes';

const emptyForm: ContentForm = {
  title: '',
  description: '',
  url: '',
  type: 'OTHER',
};

const emptyAssignmentForm: AssignmentForm = {
  title: '',
  instructions: '',
  maxScore: '',
  dueDate: '',
  status: 'PUBLISHED',
};

const emptyQuizForm: QuizForm = {
  title: '',
  description: '',
  timeLimit: '10',
  maxAttempts: '1',
  shuffleQuestions: false,
  shuffleOptions: false,
  status: 'DRAFT',
};

const CONTENT_TYPE_META: Record<string, { path: string; tile: string }> = {
  VIDEO: {
    path: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.283a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    tile: 'bg-purple-100 text-purple-600',
  },
  DOCUMENT: {
    path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    tile: 'bg-blue-100 text-blue-600',
  },
  PDF: {
    path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    tile: 'bg-red-100 text-red-600',
  },
  IMAGE: {
    path: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
    tile: 'bg-emerald-100 text-emerald-600',
  },
  LINK: {
    path: 'M13.828 10.172a4 4 0 015.656 0M9 12h.01M15 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    tile: 'bg-amber-100 text-amber-600',
  },
  OTHER: {
    path: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
    tile: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  },
};

const TYPE_BADGE_STYLES: Record<string, string> = {
  VIDEO: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  DOCUMENT: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  PDF: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  IMAGE: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  LINK: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  OTHER: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
};

function TypeIcon({ type }: { type: string }) {
  const meta = CONTENT_TYPE_META[type] || CONTENT_TYPE_META.OTHER;
  return (
    <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${meta.tile}`}>
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={meta.path} />
      </svg>
    </span>
  );
}

function typeBadge(type: string) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-black/[0.04] ${
        TYPE_BADGE_STYLES[type] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
      }`}
    >
      {type}
    </span>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString();
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
export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isTeacher, isAdmin } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizMessage, setQuizMessage] = useState('');
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [quizForm, setQuizForm] = useState<QuizForm>(emptyQuizForm);
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Per-section errors so a failure in one list does not blank the whole page
  const [sectionErrors, setSectionErrors] = useState<{
    content?: string;
    assignments?: string;
    quizzes?: string;
  }>({});
  const [message, setMessage] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState<ContentForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>(emptyAssignmentForm);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('content');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Load the course first - it drives the whole page.
      const courseRes = await api.get(`/courses/${id}`);
      setCourse(courseRes.data.data.course);

      // Load each section independently so a single failed request only
      // affects its own section instead of blanking the entire page.
      setSectionErrors({});
      api
        .get(`/courses/${id}/content`, { params: { pageSize: 100 } })
        .then((res) => setContent(res.data.data))
        .catch((err: any) =>
          setSectionErrors((prev) => ({
            ...prev,
            content: err.response?.data?.message || 'Failed to load content',
          }))
        );
      api
        .get(`/courses/${id}/assignments`, { params: { pageSize: 100 } })
        .then((res) => setAssignments(res.data.data))
        .catch((err: any) =>
          setSectionErrors((prev) => ({
            ...prev,
            assignments: err.response?.data?.message || 'Failed to load assignments',
          }))
        );
      api
        .get(`/courses/${id}/quizzes`, { params: { pageSize: 100 } })
        .then((res) => setQuizzes(res.data.data))
        .catch((err: any) =>
          setSectionErrors((prev) => ({
            ...prev,
            quizzes: err.response?.data?.message || 'Failed to load quizzes',
          }))
        );
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await api.post(`/courses/${id}/content`, form);
      setMessage('Content uploaded successfully');
      setShowUpload(false);
      setForm(emptyForm);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload content');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (contentId: string) => {
    setArchiving(contentId);
    setError('');
    setMessage('');
    try {
      await api.post(`/courses/content/${contentId}/archive`);
      setMessage('Content archived');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to archive content');
    } finally {
      setArchiving(null);
    }
  };

  const handleCreateAssignment = async (e: FormEvent) => {
    e.preventDefault();
    setCreatingAssignment(true);
    setError('');
    setMessage('');
    try {
      await api.post(`/courses/${id}/assignments`, {
        title: assignmentForm.title,
        instructions: assignmentForm.instructions,
        maxScore: Number(assignmentForm.maxScore),
        dueDate: assignmentForm.dueDate || null,
        status: assignmentForm.status,
      });
      setMessage('Assignment created successfully');
      setShowCreateAssignment(false);
      setAssignmentForm(emptyAssignmentForm);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create assignment');
    } finally {
      setCreatingAssignment(false);
    }
  };

  const handleCreateQuiz = async (e: FormEvent) => {
    e.preventDefault();
    setCreatingQuiz(true);
    setError('');
    setQuizMessage('');
    try {
      await api.post(`/courses/${id}/quizzes`, {
        title: quizForm.title,
        description: quizForm.description,
        timeLimit: Number(quizForm.timeLimit),
        maxAttempts: Number(quizForm.maxAttempts),
        shuffleQuestions: quizForm.shuffleQuestions,
        shuffleOptions: quizForm.shuffleOptions,
        status: quizForm.status,
      });
      setQuizMessage('Quiz created successfully');
      setShowCreateQuiz(false);
      setQuizForm(emptyQuizForm);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create quiz');
    } finally {
      setCreatingQuiz(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading course…" />;
  }

  if (!course) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 px-6 py-12 text-center">
        <p className="text-sm text-red-700">{error || 'Course not found'}</p>
        <Link
          to="/courses"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800"
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
          Back to Courses
        </Link>
      </div>
    );
  }

  const teacherName = course.teacher?.user?.fullName || 'Unknown teacher';
  const studentCount =
    course._count?.enrollments ?? course.enrollments?.length ?? 0;
  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'content', label: 'Content', count: content.length },
    { key: 'assignments', label: 'Assignments', count: assignments.length },
    { key: 'quizzes', label: 'Quizzes', count: quizzes.length },
  ];
  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-primary-700 px-6 py-8 shadow-card sm:px-10">
        {/* Decorative shapes */}
        <div
          className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-primary-500/40"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-primary-600/60 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative">
          <Link
            to="/courses"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-200 transition-colors duration-150 hover:text-white"
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
            Back to Courses
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {course.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-white dark:bg-gray-900/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/20">
                  {course.subject}
                </span>
                <span className="inline-flex items-center rounded-full bg-white dark:bg-gray-900/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/20">
                  Grade {course.gradeLevel}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-gray-900/10 py-1 pl-1 pr-3 text-xs font-semibold text-white ring-1 ring-inset ring-white/20">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-[9px] font-bold">
                    {getInitials(teacherName)}
                  </span>
                  {teacherName}
                </span>
              </div>
            </div>
            <StatusBadge status={course.status} />
          </div>

          {course.description && (
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-primary-100">
              {course.description}
            </p>
          )}

          <div className="mt-6">
            <Link
              to={`/courses/${course.id}/attendance`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors duration-150 hover:bg-white/20"
            >
              View Attendance
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats strip — overlaps the hero */}
      <div className="-mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: 'Content Items', value: content.length, icon: 'inbox' as const },
          { label: 'Assignments', value: assignments.length, icon: 'clipboard' as const },
          { label: 'Quizzes', value: quizzes.length, icon: 'cap' as const },
          { label: 'Students', value: studentCount, icon: 'users' as const },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3.5 rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 p-4 shadow-card sm:p-5"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <svg
                className="h-[18px] w-[18px]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={
                    stat.icon === 'inbox'
                      ? 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4'
                      : stat.icon === 'clipboard'
                        ? 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
                        : stat.icon === 'cap'
                          ? 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z'
                          : 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'
                  }
                />
              </svg>
            </span>
            <div>
              <p className="text-xl font-bold leading-none tracking-tight text-gray-900 dark:text-gray-100">
                {stat.value}
              </p>
              <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Admin: enrolled students */}
      {isAdmin && course.enrollments && course.enrollments.length > 0 && (
        <div className="mt-8 rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 p-5 shadow-card sm:p-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Enrolled Students{' '}
            <span className="ml-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
              {course.enrollments.length}
            </span>
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {course.enrollments.map((enr) => (
              <span
                key={enr.id}
                className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300"
              >
                {enr.student?.user?.fullName || 'Unknown'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {message && (
        <div role="status" className="mb-4 mt-6">
          <Banner tone="success" message={message} />
        </div>
      )}
      {quizMessage && (
        <div role="status" className="mb-4 mt-6">
          <Banner tone="success" message={quizMessage} />
        </div>
      )}
      {error && (
        <div role="alert" className="mb-4 mt-6">
          <Banner tone="error" message={error} />
        </div>
      )}

      {/* Section tabs */}
      <div className="mt-8 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
        {tabs.map((t) => (
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

      {/* --------------------------------------------- Content panel --- */}
      {activeTab === 'content' && (
        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Learning materials uploaded for this course.</p>
            {isTeacher && (
              <button
                onClick={() => setShowUpload(!showUpload)}
                className={showUpload ? buttonSecondary : buttonPrimary}
              >
                {showUpload ? 'Cancel' : '+ Upload Content'}
              </button>
            )}
          </div>

          {showUpload && isTeacher && (
            <form onSubmit={handleUpload} className="mb-6 rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 p-5 shadow-card grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-6">
              <div className="sm:col-span-2">
                <label className={labelStyles}>Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputStyles}
                  placeholder="e.g. Chapter 1 — Introduction Video"
                />
              </div>
              <div>
                <label className={labelStyles}>Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className={inputStyles}
                >
                  <option value="VIDEO">Video</option>
                  <option value="DOCUMENT">Document</option>
                  <option value="PDF">PDF</option>
                  <option value="IMAGE">Image</option>
                  <option value="LINK">Link</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className={labelStyles}>URL *</label>
                <input
                  type="url"
                  required
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className={inputStyles}
                  placeholder="https://..."
                />
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
                <button type="submit" disabled={submitting} className={buttonPrimary}>
                  {submitting ? 'Uploading…' : 'Upload Content'}
                </button>
              </div>
            </form>
          )}

          {sectionErrors.content && (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-700">{sectionErrors.content}</div>
          )}

          {!sectionErrors.content && content.length === 0 ? (
            <div className="rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 shadow-card">
              <EmptyState
                icon="book"
                title="No content available yet"
                message={
                  isTeacher
                    ? 'Upload your first material so students can start learning.'
                    : 'Uploaded materials for this course will appear here.'
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              {content.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 p-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="flex min-w-0 items-start gap-3.5">
                    <TypeIcon type={item.type} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</h3>
                        {typeBadge(item.type)}
                      </div>
                      {item.description && (
                        <p className="mt-0.5 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
                      )}
                      <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                        {formatDate(item.createdAt)} · {item.uploadedBy?.fullName || 'Unknown'}
                        {item.sizeBytes ? ` · ${(item.sizeBytes / 1024).toFixed(1)} KB` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2 sm:ml-4">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-primary-700"
                    >
                      Open
                    </a>
                    {isTeacher && (
                      <button
                        onClick={() => handleArchive(item.id)}
                        disabled={archiving === item.id}
                        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:pointer-events-none disabled:opacity-60"
                      >
                        {archiving === item.id ? 'Archiving…' : 'Archive'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------ Assignments panel --- */}
      {activeTab === 'assignments' && (
        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Coursework with due dates and scoring.</p>
            {isTeacher && (
              <button
                onClick={() => setShowCreateAssignment(!showCreateAssignment)}
                className={showCreateAssignment ? buttonSecondary : buttonPrimary}
              >
                {showCreateAssignment ? 'Cancel' : '+ Create Assignment'}
              </button>
            )}
          </div>

          {showCreateAssignment && isTeacher && (
            <form onSubmit={handleCreateAssignment} className="mb-6 rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 p-5 shadow-card grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-6">
              <div className="sm:col-span-2">
                <label className={labelStyles}>Title *</label>
                <input
                  type="text"
                  required
                  value={assignmentForm.title}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                  className={inputStyles}
                  placeholder="e.g. Homework 1"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelStyles}>Instructions</label>
                <textarea
                  value={assignmentForm.instructions}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, instructions: e.target.value })}
                  rows={3}
                  className={inputStyles}
                  placeholder="Describe what students should do..."
                />
              </div>
              <div>
                <label className={labelStyles}>Max Score *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={assignmentForm.maxScore}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, maxScore: e.target.value })}
                  className={inputStyles}
                />
              </div>
              <div>
                <label className={labelStyles}>Due Date</label>
                <input
                  type="datetime-local"
                  value={assignmentForm.dueDate}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                  className={inputStyles}
                />
              </div>
              <div>
                <label className={labelStyles}>Status</label>
                <select
                  value={assignmentForm.status}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, status: e.target.value })}
                  className={inputStyles}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <button type="submit" disabled={creatingAssignment} className={buttonPrimary}>
                  {creatingAssignment ? 'Creating…' : 'Create Assignment'}
                </button>
              </div>
            </form>
          )}

          {sectionErrors.assignments && (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-700">{sectionErrors.assignments}</div>
          )}

          {!sectionErrors.assignments && assignments.length === 0 ? (
            <div className="rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 shadow-card">
              <EmptyState
                icon="clipboard"
                title="No assignments yet"
                message={
                  isTeacher
                    ? 'Create the first assignment — students will see it here as soon as it is published.'
                    : 'Assignments for this course will be listed here.'
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => {
                const overdue =
                  !!assignment.dueDate &&
                  assignment.status !== 'CLOSED' &&
                  new Date(assignment.dueDate).getTime() < Date.now();
                return (
                  <Link
                    key={assignment.id}
                    to={`/courses/${id}/assignments/${assignment.id}`}
                    className="group block rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3.5">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-colors duration-150 group-hover:text-primary-700">
                            {assignment.title}
                          </h3>
                          {assignment.instructions && (
                            <p className="mt-0.5 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">{assignment.instructions}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {assignment.submissions && assignment.submissions.length > 0 && (
                          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-inset ring-black/[0.04]">
                            Submitted
                          </span>
                        )}
                        <StatusBadge status={assignment.status} />
                        <svg
                          className="hidden h-4 w-4 text-gray-300 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-primary-600 sm:block"
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
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 dark:border-gray-800 pt-3 text-xs text-gray-400 dark:text-gray-500">
                      <span>Max score: {assignment.maxScore}</span>
                      {assignment.dueDate && (
                        <span className={overdue ? 'font-semibold text-red-600' : ''}>
                          Due: {formatDate(assignment.dueDate)}
                          {overdue ? ' · Overdue' : ''}
                        </span>
                      )}
                      <span>{assignment._count?.submissions || 0} submissions</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ---------------------------------------------- Quizzes panel --- */}
      {activeTab === 'quizzes' && (
        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Timed assessments with auto-grading.</p>
            {isTeacher && (
              <button
                onClick={() => setShowCreateQuiz(!showCreateQuiz)}
                className={showCreateQuiz ? buttonSecondary : buttonPrimary}
              >
                {showCreateQuiz ? 'Cancel' : '+ Create Quiz'}
              </button>
            )}
          </div>

          {showCreateQuiz && isTeacher && (
            <form onSubmit={handleCreateQuiz} className="mb-6 rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 p-5 shadow-card grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-6">
              <div className="sm:col-span-2">
                <label className={labelStyles}>Title *</label>
                <input
                  type="text"
                  required
                  value={quizForm.title}
                  onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                  className={inputStyles}
                  placeholder="e.g. Chapter 1 Quiz"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelStyles}>Description</label>
                <textarea
                  value={quizForm.description}
                  onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
                  rows={2}
                  className={inputStyles}
                />
              </div>
              <div>
                <label className={labelStyles}>Time Limit (minutes) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={300}
                  value={quizForm.timeLimit}
                  onChange={(e) => setQuizForm({ ...quizForm, timeLimit: e.target.value })}
                  className={inputStyles}
                />
              </div>
              <div>
                <label className={labelStyles}>Max Attempts *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={10}
                  value={quizForm.maxAttempts}
                  onChange={(e) => setQuizForm({ ...quizForm, maxAttempts: e.target.value })}
                  className={inputStyles}
                />
              </div>
              <div>
                <label className={labelStyles}>Status</label>
                <select
                  value={quizForm.status}
                  onChange={(e) => setQuizForm({ ...quizForm, status: e.target.value })}
                  className={inputStyles}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={quizForm.shuffleQuestions}
                    onChange={(e) => setQuizForm({ ...quizForm, shuffleQuestions: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  Shuffle questions
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={quizForm.shuffleOptions}
                    onChange={(e) => setQuizForm({ ...quizForm, shuffleOptions: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  Shuffle options
                </label>
              </div>
              <div className="sm:col-span-2">
                <button type="submit" disabled={creatingQuiz} className={buttonPrimary}>
                  {creatingQuiz ? 'Creating…' : 'Create Quiz'}
                </button>
              </div>
            </form>
          )}

          {sectionErrors.quizzes && (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-700">{sectionErrors.quizzes}</div>
          )}

          {!sectionErrors.quizzes && quizzes.length === 0 ? (
            <div className="rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 shadow-card">
              <EmptyState
                icon="cap"
                title="No quizzes yet"
                message={
                  isTeacher
                    ? 'Build the first quiz — add questions after creating it.'
                    : 'Quizzes for this course will be listed here.'
                }
              />
            </div>
          ) : (
            <div className="space-y-3">
              {quizzes.map((quiz) => (
                <Link
                  key={quiz.id}
                  to={`/courses/${id}/quizzes/${quiz.id}`}
                  className="group block rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3.5">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-colors duration-150 group-hover:text-primary-700">
                          {quiz.title}
                        </h3>
                        {quiz.description && (
                          <p className="mt-0.5 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">{quiz.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <StatusBadge status={quiz.status} />
                      <svg
                        className="hidden h-4 w-4 text-gray-300 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-primary-600 sm:block"
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
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 dark:border-gray-800 pt-3 text-xs text-gray-400 dark:text-gray-500">
                    <span>Time limit: {quiz.timeLimit} min</span>
                    <span>Attempts: {quiz.maxAttempts}</span>
                    <span>{quiz._count?.questions || 0} questions</span>
                    <span>{quiz._count?.attempts || 0} attempts</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}