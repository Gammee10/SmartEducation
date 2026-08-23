import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import {
  buttonPrimary,
  EmptyState,
  inputStyles,
  labelStyles,
  LoadingState,
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

  const typeBadge = (type: string) => {
    const styles: Record<string, string> = {
      VIDEO: 'bg-purple-50 text-purple-700',
      DOCUMENT: 'bg-blue-50 text-blue-700',
      PDF: 'bg-red-50 text-red-700',
      IMAGE: 'bg-green-50 text-green-700',
      LINK: 'bg-yellow-50 text-yellow-700',
      OTHER: 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-black/[0.04] ${styles[type] || 'bg-gray-100 text-gray-600'}`}>
        {type}
      </span>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return <LoadingState label="Loading course…" />;
  }

  if (!course) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center">
        <p className="text-sm text-red-700">{error || 'Course not found'}</p>
        <Link
          to="/courses"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 transition-colors duration-150 hover:bg-gray-50"
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

  return (
    <div>
      <div className="mb-8">
        <Link
          to="/courses"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors duration-150 hover:text-primary-700"
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
        <div className="mt-3 flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {course.title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {course.subject} · Grade {course.gradeLevel}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Teacher: {course.teacher?.user?.fullName || 'Unknown'}
            </p>
          </div>
          <StatusBadge status={course.status} />
        </div>
        {course.description && (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-600">{course.description}</p>
        )}
        <div className="mt-4">
          <Link
            to={`/courses/${course.id}/attendance`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 transition-colors duration-150 hover:text-primary-800"
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
        {isAdmin && course.enrollments && course.enrollments.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Enrolled Students ({course.enrollments.length})</h3>
            <div className="flex flex-wrap gap-2">
              {course.enrollments.map((enr) => (
                <span key={enr.id} className="text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-1">
                  {enr.student?.user?.fullName || 'Unknown'}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {message && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Course Content</h2>
        {isTeacher && (
          <button
            onClick={() => setShowUpload(!showUpload)}
            className={buttonPrimary}
          >
            {showUpload ? 'Cancel' : '+ Upload Content'}
          </button>
        )}
      </div>

      {showUpload && isTeacher && (
        <form onSubmit={handleUpload} className="mb-6 rounded-xl border border-gray-200/80 bg-white p-5 shadow-card grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-6">
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
            <button
              type="submit"
              disabled={submitting}
              className={buttonPrimary}
            >
              {submitting ? 'Uploading...' : 'Upload Content'}
            </button>
          </div>
        </form>
      )}

      {sectionErrors.content && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sectionErrors.content}</div>
      )}
      {!sectionErrors.content && content.length === 0 ? (
        <EmptyState
          icon="book"
          title="No content available yet"
          message="Uploaded materials for this course will appear here."
        />
      ) : (
        <div className="space-y-3">
          {content.map((item) => (
            <div key={item.id} className="flex items-start justify-between rounded-xl border border-gray-200/80 bg-white p-4 shadow-card">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-gray-900">{item.title}</h3>
                  {typeBadge(item.type)}
                </div>
                {item.description && (
                  <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                )}
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                  <span>Uploaded: {formatDate(item.createdAt)}</span>
                  <span>By: {item.uploadedBy?.fullName || 'Unknown'}</span>
                  {item.sizeBytes && <span>{(item.sizeBytes / 1024).toFixed(1)} KB</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
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
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-60"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Assignments</h2>
        {isTeacher && (
          <button
            onClick={() => setShowCreateAssignment(!showCreateAssignment)}
            className={buttonPrimary}
          >
            {showCreateAssignment ? 'Cancel' : '+ Create Assignment'}
          </button>
        )}
      </div>

      {showCreateAssignment && isTeacher && (
        <form onSubmit={handleCreateAssignment} className="mb-6 rounded-xl border border-gray-200/80 bg-white p-5 shadow-card grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-6">
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
            <button
              type="submit"
              disabled={creatingAssignment}
              className={buttonPrimary}
            >
              {creatingAssignment ? 'Creating...' : 'Create Assignment'}
            </button>
          </div>
        </form>
      )}

      {sectionErrors.assignments && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sectionErrors.assignments}</div>
      )}
      {!sectionErrors.assignments && assignments.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title="No assignments yet"
          message="Assignments for this course will be listed here."
        />
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <Link
              key={assignment.id}
              to={`/courses/${id}/assignments/${assignment.id}`}
              className="block rounded-xl border border-gray-200/80 bg-white p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-gray-900">{assignment.title}</h3>
                    <StatusBadge status={assignment.status} />
                  </div>
                  {assignment.instructions && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{assignment.instructions}</p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                <span>Max score: {assignment.maxScore}</span>
                {assignment.dueDate && <span>Due: {formatDate(assignment.dueDate)}</span>}
                <span>{assignment._count?.submissions || 0} submissions</span>
                {assignment.submissions && assignment.submissions.length > 0 && (
                  <span className="text-green-600 font-medium">Submitted</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* -----------------------------------------------------
          Quizzes (Member 4)
          ----------------------------------------------------- */}
      <div className="mt-10 flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Quizzes</h2>
        {isTeacher && (
          <button
            onClick={() => setShowCreateQuiz(!showCreateQuiz)}
            className={buttonPrimary}
          >
            {showCreateQuiz ? 'Cancel' : '+ Create Quiz'}
          </button>
        )}
      </div>

      {quizMessage && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{quizMessage}</div>
      )}

      {showCreateQuiz && isTeacher && (
        <form onSubmit={handleCreateQuiz} className="mb-6 rounded-xl border border-gray-200/80 bg-white p-5 shadow-card grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-6">
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
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={quizForm.shuffleQuestions}
                onChange={(e) => setQuizForm({ ...quizForm, shuffleQuestions: e.target.checked })}
              />
              Shuffle questions
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={quizForm.shuffleOptions}
                onChange={(e) => setQuizForm({ ...quizForm, shuffleOptions: e.target.checked })}
              />
              Shuffle options
            </label>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creatingQuiz}
              className={buttonPrimary}
            >
              {creatingQuiz ? 'Creating...' : 'Create Quiz'}
            </button>
          </div>
        </form>
      )}

      {sectionErrors.quizzes && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sectionErrors.quizzes}</div>
      )}
      {!sectionErrors.quizzes && quizzes.length === 0 ? (
        <EmptyState
          icon="clipboard"
          title="No quizzes yet"
          message="Quizzes for this course will be listed here."
        />
      ) : (
        <div className="space-y-3">
          {quizzes.map((quiz) => (
            <Link
              key={quiz.id}
              to={`/courses/${id}/quizzes/${quiz.id}`}
              className="block rounded-xl border border-gray-200/80 bg-white p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-gray-900">{quiz.title}</h3>
                    <StatusBadge status={quiz.status} />
                  </div>
                  {quiz.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{quiz.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                <span>Time limit: {quiz.timeLimit} min</span>
                <span>Attempts: {quiz.maxAttempts}</span>
                <span>{quiz._count?.questions || 0} questions</span>
                <span>{quiz._count?.attempts || 0} attempts</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
