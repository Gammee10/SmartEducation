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
  Banner,
  Spinner,
} from '../components/ui';
import type { Assignment, AssignmentSubmission } from '../types';

export default function AssignmentDetailPage() {
  const { id: courseId, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const { isTeacher, isStudent } = useAuth();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [gradeScores, setGradeScores] = useState<Record<string, string>>({});
  const [gradeFeedbacks, setGradeFeedbacks] = useState<Record<string, string>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/assignments/${assignmentId}`);
      setAssignment(response.data.data.assignment);
      setSubmissions(response.data.data.submissions);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load assignment');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // A student has at most one submission per assignment
  const mySubmission = submissions.length > 0 ? submissions[0] : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('content', content);
      if (file) formData.append('file', file);
      await api.post(`/assignments/${assignmentId}/submit`, formData);
      setMessage('Assignment submitted successfully');
      setContent('');
      setFile(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrade = async (submissionId: string, e: FormEvent) => {
    e.preventDefault();
    setGradingId(submissionId);
    setError('');
    setMessage('');
    try {
      await api.post(`/submissions/${submissionId}/grade`, {
        score: Number(gradeScores[submissionId] || 0),
        feedback: gradeFeedbacks[submissionId] || '',
      });
      setMessage('Submission graded');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to grade submission');
    } finally {
      setGradingId(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return <LoadingState label="Loading assignment…" />;
  }

  if (!assignment) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-500/30 dark:bg-red-500/10">
        <p className="text-sm text-red-700 dark:text-red-400">{error || 'Assignment not found'}</p>
        <Link
          to={`/courses/${courseId}`}
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
          Back to Course
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        to={`/courses/${courseId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors duration-150 hover:text-primary-700"
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
        Back to Course
      </Link>
      <div className="mt-3 flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
            {assignment.title}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {assignment.course?.subject} · Grade {assignment.course?.gradeLevel}
          </p>
        </div>
        <StatusBadge status={assignment.status} />
      </div>

      {assignment.instructions && (
        <div className="mt-6 rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-5 shadow-card">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Instructions</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{assignment.instructions}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <span className="font-medium text-gray-900 dark:text-gray-100">Max score: {assignment.maxScore}</span>
        {assignment.dueDate && <span>Due: {formatDate(assignment.dueDate)}</span>}
        <span>{submissions.length} submission(s)</span>
      </div>

      {message && (
        <div className="mt-4 mb-4">
          <Banner tone="success" message={message} />
        </div>
      )}
      {error && (
        <div className="mt-4 mb-4">
          <Banner tone="error" message={error} />
        </div>
      )}

      {/* -----------------------------------------------------
          Student view: submit or view own submission
          ----------------------------------------------------- */}
      {isStudent && (
        <div className="mt-8">
          {mySubmission ? (
            <div className="rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Submission</h3>
                <StatusBadge status={mySubmission.status} />
              </div>
              {mySubmission.isLate && (
                <p className="text-xs text-orange-600 font-medium mb-2">Submitted late</p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Submitted: {formatDate(mySubmission.submittedAt)}</p>

              {mySubmission.content && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your answer</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                    {mySubmission.content}
                  </p>
                </div>
              )}

              {mySubmission.fileUrl && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Submitted file</h4>
                  <a
                    href={mySubmission.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 hover:text-primary-700 underline"
                  >
                    Open file{mySubmission.mimeType ? ` (${mySubmission.mimeType})` : ''}
                  </a>
                </div>
              )}

              {mySubmission.status === 'GRADED' ? (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Grade</h4>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {mySubmission.score}
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> / {assignment.maxScore}</span>
                  </p>
                  {mySubmission.feedback && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap">{mySubmission.feedback}</p>
                  )}
                  {mySubmission.gradedAt && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Graded: {formatDate(mySubmission.gradedAt)}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Awaiting grade from your teacher.</p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-6 shadow-card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Submit Your Work</h3>
              {assignment.status !== 'PUBLISHED' ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">This assignment is not open for submissions.</p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className={labelStyles}>Your answer</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={5}
                      className={inputStyles}
                      placeholder="Type your answer here..."
                    />
                  </div>
                  <div>
                    <label className={labelStyles}>Attach a file (optional, max 50MB)</label>
                    <input
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="mt-1.5 block w-full cursor-pointer text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-700 hover:file:bg-primary-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || (!content.trim() && !file)}
                    className={buttonPrimary}
                  >
                    {submitting && <Spinner />}
                    {submitting ? 'Submitting…' : 'Submit Assignment'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* -----------------------------------------------------
          Teacher / Admin view: submissions + grading
          ----------------------------------------------------- */}
      {!isStudent && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Submissions ({submissions.length})
          </h3>
          {submissions.length === 0 ? (
            <EmptyState
              icon="clipboard"
              title="No submissions yet"
              message="Student submissions will appear here as they come in."
            />
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => (
                <div key={sub.id} className="rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-4 shadow-card">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {sub.student?.user?.fullName || 'Unknown student'}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Submitted: {formatDate(sub.submittedAt)}
                        {sub.isLate && <span className="ml-2 text-orange-600 font-medium">Late</span>}
                      </p>
                    </div>
                    <StatusBadge status={sub.status} />
                  </div>

                  {sub.content && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 mb-3">
                      {sub.content}
                    </p>
                  )}
                  {sub.fileUrl && (
                    <a
                      href={sub.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-700 underline inline-block mb-3"
                    >
                      Open submitted file
                    </a>
                  )}

                  {isTeacher ? (
                    <form
                      onSubmit={(e) => handleGrade(sub.id, e)}
                      className="border-t border-gray-200 dark:border-gray-700 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3"
                    >
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                          Score (max {assignment.maxScore})
                        </label>
                        <input
                          type="number"
                          required
                          min={0}
                          max={assignment.maxScore}
                          step="0.5"
                          value={gradeScores[sub.id] ?? (sub.score !== null && sub.score !== undefined ? String(sub.score) : '')}
                          onChange={(e) => setGradeScores({ ...gradeScores, [sub.id]: e.target.value })}
                          className={inputStyles}
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Feedback</label>
                        <input
                          type="text"
                          value={gradeFeedbacks[sub.id] ?? sub.feedback ?? ''}
                          onChange={(e) => setGradeFeedbacks({ ...gradeFeedbacks, [sub.id]: e.target.value })}
                          className={inputStyles}
                          placeholder="Feedback..."
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          disabled={gradingId === sub.id}
                          className={buttonPrimary}
                        >
                          {gradingId === sub.id && <Spinner />}
                          {gradingId === sub.id ? 'Saving…' : sub.status === 'GRADED' ? 'Update Grade' : 'Grade'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3 text-sm text-gray-600 dark:text-gray-400">
                      {sub.status === 'GRADED' ? (
                        <span>
                          Score: <span className="font-semibold">{sub.score}</span> / {assignment.maxScore}
                          {sub.feedback && <span className="ml-3">Feedback: {sub.feedback}</span>}
                        </span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">Awaiting grade.</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}