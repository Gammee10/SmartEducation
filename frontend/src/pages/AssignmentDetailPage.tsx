import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
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

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-yellow-50 text-yellow-700',
      PUBLISHED: 'bg-green-50 text-green-700',
      CLOSED: 'bg-gray-100 text-gray-600',
      ARCHIVED: 'bg-gray-100 text-gray-500',
      SUBMITTED: 'bg-blue-50 text-blue-700',
      GRADED: 'bg-green-50 text-green-700',
    };
    return (
      <span className={`inline-block text-xs font-medium rounded-full px-2 py-1 ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (!assignment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">{error || 'Assignment not found'}</p>
        <Link to={`/courses/${courseId}`} className="text-primary-600 hover:text-primary-700">
          ← Back to Course
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link to={`/courses/${courseId}`} className="text-sm text-primary-600 hover:text-primary-700">
        ← Back to Course
      </Link>
      <div className="mt-2 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {assignment.course?.subject} · Grade {assignment.course?.gradeLevel}
          </p>
        </div>
        {statusBadge(assignment.status)}
      </div>

      {assignment.instructions && (
        <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Instructions</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{assignment.instructions}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
        <span className="font-medium text-gray-900">Max score: {assignment.maxScore}</span>
        {assignment.dueDate && <span>Due: {formatDate(assignment.dueDate)}</span>}
        <span>{submissions.length} submission(s)</span>
      </div>

      {message && (
        <div className="mt-4 mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">{message}</div>
      )}
      {error && (
        <div className="mt-4 mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* -----------------------------------------------------
          Student view: submit or view own submission
          ----------------------------------------------------- */}
      {isStudent && (
        <div className="mt-8">
          {mySubmission ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Your Submission</h3>
                {statusBadge(mySubmission.status)}
              </div>
              {mySubmission.isLate && (
                <p className="text-xs text-orange-600 font-medium mb-2">Submitted late</p>
              )}
              <p className="text-xs text-gray-400 mb-4">Submitted: {formatDate(mySubmission.submittedAt)}</p>

              {mySubmission.content && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Your answer</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-md p-3">
                    {mySubmission.content}
                  </p>
                </div>
              )}

              {mySubmission.fileUrl && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Submitted file</h4>
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
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Grade</h4>
                  <p className="text-2xl font-bold text-gray-900">
                    {mySubmission.score}
                    <span className="text-sm font-normal text-gray-500"> / {assignment.maxScore}</span>
                  </p>
                  {mySubmission.feedback && (
                    <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{mySubmission.feedback}</p>
                  )}
                  {mySubmission.gradedAt && (
                    <p className="text-xs text-gray-400 mt-2">Graded: {formatDate(mySubmission.gradedAt)}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Awaiting grade from your teacher.</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Submit Your Work</h3>
              {assignment.status !== 'PUBLISHED' ? (
                <p className="text-sm text-gray-500">This assignment is not open for submissions.</p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Your answer</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={5}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                      placeholder="Type your answer here..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Attach a file (optional, max 50MB)</label>
                    <input
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="mt-1 block w-full text-sm text-gray-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || (!content.trim() && !file)}
                    className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Assignment'}
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Submissions ({submissions.length})
          </h3>
          {submissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No submissions yet.</div>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => (
                <div key={sub.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {sub.student?.user?.fullName || 'Unknown student'}
                      </p>
                      <p className="text-xs text-gray-400">
                        Submitted: {formatDate(sub.submittedAt)}
                        {sub.isLate && <span className="ml-2 text-orange-600 font-medium">Late</span>}
                      </p>
                    </div>
                    {statusBadge(sub.status)}
                  </div>

                  {sub.content && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-md p-3 mb-3">
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
                      className="border-t border-gray-200 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3"
                    >
                      <div>
                        <label className="block text-xs font-medium text-gray-700">
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
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-medium text-gray-700">Feedback</label>
                        <input
                          type="text"
                          value={gradeFeedbacks[sub.id] ?? sub.feedback ?? ''}
                          onChange={(e) => setGradeFeedbacks({ ...gradeFeedbacks, [sub.id]: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                          placeholder="Feedback..."
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          disabled={gradingId === sub.id}
                          className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                        >
                          {gradingId === sub.id ? 'Saving...' : sub.status === 'GRADED' ? 'Update Grade' : 'Grade'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="border-t border-gray-200 pt-3 text-sm text-gray-600">
                      {sub.status === 'GRADED' ? (
                        <span>
                          Score: <span className="font-semibold">{sub.score}</span> / {assignment.maxScore}
                          {sub.feedback && <span className="ml-3">Feedback: {sub.feedback}</span>}
                        </span>
                      ) : (
                        <span className="text-gray-500">Awaiting grade.</span>
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