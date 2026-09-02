import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
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
  Spinner,
} from '../components/ui';
import type { Quiz, QuizQuestion, QuizAttempt } from '../types';

interface QuizForm {
  title: string;
  description: string;
  timeLimit: string;
  maxAttempts: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  status: string;
}

const emptyQuizForm: QuizForm = {
  title: '',
  description: '',
  timeLimit: '10',
  maxAttempts: '1',
  shuffleQuestions: false,
  shuffleOptions: false,
  status: 'DRAFT',
};

interface QuestionDraft {
  prompt: string;
  type: string;
  points: string;
  options: Array<{ optionText: string; isCorrect: boolean }>;
}

const emptyQuestion: QuestionDraft = {
  prompt: '',
  type: 'SINGLE_CHOICE',
  points: '1',
  options: [
    { optionText: '', isCorrect: false },
    { optionText: '', isCorrect: false },
  ],
};

export default function QuizDetailPage() {
  const { id: courseId, quizId } = useParams<{ id: string; quizId: string }>();
  const { isTeacher, isStudent, user } = useAuth();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Teacher: quiz settings builder
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<QuizForm>(emptyQuizForm);
  const [saving, setSaving] = useState(false);

  // Teacher: question builder
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(emptyQuestion);
  const [addingQuestion, setAddingQuestion] = useState(false);

  // Student: active attempt
  const [activeAttempt, setActiveAttempt] = useState<{ id: string; expiresAt: string } | null>(null);
  const [takingQuiz, setTakingQuiz] = useState(false);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    maxScore: number;
    status: string;
    expired: boolean;
  } | null>(null);

  // Refs to avoid stale closures in the countdown auto-submit effect
  const selectionsRef = useRef<Record<string, string[]>>({});
  const submitRef = useRef<(s: Record<string, string[]>, auto?: boolean) => Promise<void>>(async () => {});
  // Synchronous guard so the expiring countdown tick cannot fire duplicate
  // submissions while a manual/auto submit request is still in flight.
  const submittingRef = useRef(false);
  // Once an auto-submit at expiry has failed (network blip), stop re-firing
  // it every second; the student submits manually instead.
  const autoSubmitFailedRef = useRef(false);
  const [autoSubmitFailed, setAutoSubmitFailed] = useState(false);

  useEffect(() => {
    selectionsRef.current = selections;
    // Persist selections so an accidental refresh does not wipe answers
    if (activeAttempt) {
      sessionStorage.setItem(`quiz-${activeAttempt.id}`, JSON.stringify(selections));
    }
  }, [selections, activeAttempt]);

  // Warn before leaving the page with an attempt in progress
  useEffect(() => {
    if (!takingQuiz) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [takingQuiz]);

  // Keep submitRef pointing at the latest handleSubmit for the countdown effect
  useEffect(() => {
    submitRef.current = handleSubmit;
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/quizzes/${quizId}`);
      setQuiz(response.data.data.quiz);
      setAttempts(response.data.data.attempts || []);
      // Teacher/admin: the details endpoint returns no attempts - load them
      // from the dedicated results endpoint. Non-fatal on failure so a
      // results problem never blanks the whole page.
      if (!isStudent) {
        try {
          const results = await api.get(`/quizzes/${quizId}/results`);
          setAttempts(results.data.data.attempts || []);
        } catch {
          // keep whatever attempts data we already have
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  }, [quizId, isStudent]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Resume an in-progress attempt after a refresh or navigation away, so a
  // student does not silently lose an attempt that is still running
  // server-side. Selections saved in sessionStorage are restored.
  useEffect(() => {
    if (!isStudent || !quiz || takingQuiz || result) return;
    const inProgress = attempts.find((a) => a.status === 'IN_PROGRESS');
    if (!inProgress) return;
    setActiveAttempt({ id: inProgress.id, expiresAt: inProgress.expiresAt });
    setTakingQuiz(true);
    autoSubmitFailedRef.current = false;
    setAutoSubmitFailed(false);
    const initial: Record<string, string[]> = {};
    for (const q of quiz.questions || []) {
      initial[q.id] = [];
    }
    try {
      const saved = sessionStorage.getItem(`quiz-${inProgress.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSelections({ ...initial, ...parsed });
        return;
      }
    } catch {
      // corrupted saved state - fall back to empty selections
    }
    setSelections(initial);
  }, [attempts, quiz, isStudent, takingQuiz, result]);

  // Countdown timer for active quiz attempt (auto-submits on expiry)
  useEffect(() => {
    if (!activeAttempt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(activeAttempt.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0 && takingQuiz && !autoSubmitFailedRef.current && !submittingRef.current) {
        submitRef.current(selectionsRef.current, true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeAttempt, takingQuiz]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ---------------------------------------------------------------
  // Teacher: update quiz settings
  // ---------------------------------------------------------------
  const openEdit = () => {
    if (!quiz) return;
    setEditForm({
      title: quiz.title,
      description: quiz.description || '',
      timeLimit: String(quiz.timeLimit),
      maxAttempts: String(quiz.maxAttempts),
      shuffleQuestions: quiz.shuffleQuestions,
      shuffleOptions: quiz.shuffleOptions,
      status: quiz.status,
    });
    setShowEdit(true);
  };

  const handleSaveQuiz = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.put(`/quizzes/${quizId}`, {
        title: editForm.title,
        description: editForm.description,
        timeLimit: Number(editForm.timeLimit),
        maxAttempts: Number(editForm.maxAttempts),
        shuffleQuestions: editForm.shuffleQuestions,
        shuffleOptions: editForm.shuffleOptions,
        status: editForm.status,
      });
      setMessage('Quiz updated successfully');
      setShowEdit(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update quiz');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------
  // Teacher: add a question
  // ---------------------------------------------------------------
  const handleAddQuestion = async (e: FormEvent) => {
    e.preventDefault();
    setAddingQuestion(true);
    setError('');
    setMessage('');
    try {
      await api.post(`/quizzes/${quizId}/questions`, {
        prompt: questionDraft.prompt,
        type: questionDraft.type,
        points: Number(questionDraft.points),
        options: questionDraft.options
          .filter((o) => o.optionText.trim())
          .map((o) => ({ optionText: o.optionText.trim(), isCorrect: o.isCorrect })),
      });
      setMessage('Question added successfully');
      setShowAddQuestion(false);
      setQuestionDraft(emptyQuestion);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add question');
    } finally {
      setAddingQuestion(false);
    }
  };

  const updateQuestionOption = (index: number, field: 'optionText' | 'isCorrect', value: string | boolean) => {
    setQuestionDraft((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt)),
    }));
  };

  const addOptionRow = () => {
    setQuestionDraft((prev) => ({
      ...prev,
      options: [...prev.options, { optionText: '', isCorrect: false }],
    }));
  };

  const removeOptionRow = (index: number) => {
    setQuestionDraft((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  // ---------------------------------------------------------------
  // Student: start attempt
  // ---------------------------------------------------------------
  const handleStartAttempt = async () => {
    setError('');
    setMessage('');
    try {
      const response = await api.post(`/quizzes/${quizId}/attempt`);
      const data = response.data.data;
      setActiveAttempt(data.attempt);
      setTakingQuiz(true);
      setResult(null);
      autoSubmitFailedRef.current = false;
      setAutoSubmitFailed(false);
      // Initialize empty selections for all questions
      const initial: Record<string, string[]> = {};
      for (const q of data.quiz.questions) {
        initial[q.id] = [];
      }
      setSelections(initial);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start quiz attempt');
    }
  };

  // ---------------------------------------------------------------
  // Student: submit attempt
  // ---------------------------------------------------------------
  const handleSubmit = async (currentSelections: Record<string, string[]>, autoExpired = false) => {
    if (!activeAttempt || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      // Build answers payload
      const answers = Object.entries(currentSelections)
        .filter(([, optionIds]) => optionIds.length > 0)
        .map(([questionId, optionIds]) => ({ questionId, optionIds }));

      const response = await api.post(`/attempts/${activeAttempt.id}/submit`, { answers });
      const data = response.data.data;
      setResult({
        score: data.score,
        maxScore: data.maxScore,
        status: data.status,
        expired: data.expired,
      });
      sessionStorage.removeItem(`quiz-${activeAttempt.id}`);
      setTakingQuiz(false);
      setActiveAttempt(null);
      setMessage(autoExpired ? 'Time expired — your attempt was auto-submitted' : 'Quiz submitted successfully');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit quiz');
      if (autoExpired) {
        // Stop the auto-submit retry loop; the student submits manually.
        autoSubmitFailedRef.current = true;
        setAutoSubmitFailed(true);
      } else {
        // If the attempt was already submitted server-side, refresh state
        fetchData();
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  if (loading) {
    return <LoadingState label="Loading quiz…" />;
  }

  if (!quiz) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 px-6 py-12 text-center">
        <p className="text-sm text-red-700">{error || 'Quiz not found'}</p>
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">{quiz.title}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {quiz.course?.subject} · Grade {quiz.course?.gradeLevel}
          </p>
        </div>
        <StatusBadge status={quiz.status} />
      </div>

      {quiz.description && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{quiz.description}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <span className="font-medium text-gray-900 dark:text-gray-100">Time limit: {quiz.timeLimit} min</span>
        <span>Attempts allowed: {quiz.maxAttempts}</span>
        <span>{quiz.questions?.length || 0} question(s)</span>
        {quiz.shuffleQuestions && <span>Shuffled questions</span>}
        {quiz.shuffleOptions && <span>Shuffled options</span>}
      </div>

      {message && <div className="mt-4 mb-4"><Banner tone="success" message={message} /></div>}
      {error && <div className="mt-4 mb-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* -----------------------------------------------------
          Student view when not actively taking the quiz
          ----------------------------------------------------- */}
      {isStudent && !takingQuiz && !result && (
        <div className="mt-8 space-y-6">
          {quiz.status === 'PUBLISHED' ? (
            <button
              onClick={handleStartAttempt}
              className={buttonPrimary}
            >
              Start Quiz
            </button>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">This quiz is not available yet.</p>
          )}

          {attempts.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Your Attempts</h3>
              <div className="space-y-3">
                {attempts.map((attempt) => (
                  <div key={attempt.id} className="rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400 dark:text-gray-500">Started: {formatStart(attempt.startedAt)}</p>
                        {attempt.submittedAt && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">Submitted: {formatStart(attempt.submittedAt)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <StatusBadge status={attempt.status} />
                        {attempt.score !== null && attempt.score !== undefined && (
                          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {attempt.score} <span className="text-sm text-gray-500 dark:text-gray-400">/ {attempt.maxScore}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* -----------------------------------------------------
        Student view — active quiz taking (with timer)
        ----------------------------------------------------- */}
      {isStudent && takingQuiz && activeAttempt && (
        <div className="mt-8">
          <div className="sticky top-16 z-10 -mx-1 mb-6 mt-8 flex items-center justify-between gap-4 rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] px-4 py-3 sm:px-5">
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <svg
                className="h-4 w-4 text-gray-400 dark:text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Time remaining
            </span>
            <span
              className={`rounded-lg px-2.5 py-1 font-mono text-lg font-bold tabular-nums ${
                secondsLeft <= 60
                  ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400 animate-pulse'
                  : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
              }`}
              role="timer"
              aria-live="off"
            >
              {formatTimer(secondsLeft)}
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(selections);
            }}
            className="space-y-6"
          >
            {quiz.questions?.map((question: QuizQuestion, qIndex: number) => {
              const selected = selections[question.id] || [];
              return (
                <div key={question.id} className="rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">Question {qIndex + 1}</span>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{question.prompt}</h3>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{question.points} pt(s)</span>
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="sr-only">{question.prompt}</legend>
                    {question.options.map((option) => {
                      const isSelected = selected.includes(option.id);
                      return (
                        <label
                          key={option.id}
                          className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors duration-150 ${
                            isSelected ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500 dark:bg-primary-500/10' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <input
                            type={question.type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'}
                            name={`question-${question.id}`}
                            checked={isSelected}
                            onChange={() => {
                              setSelections((prev) => {
                                const current = prev[question.id] || [];
                                if (question.type === 'MULTIPLE_CHOICE') {
                                  return {
                                    ...prev,
                                    [question.id]: isSelected
                                      ? current.filter((id) => id !== option.id)
                                      : [...current, option.id],
                                  };
                                }
                                return { ...prev, [question.id]: [option.id] };
                              });
                            }}
                            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{option.optionText}</span>
                        </label>
                      );
                    })}
                  </fieldset>
                </div>
              );
            })}

            {autoSubmitFailed && (
              <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-500/30 dark:bg-orange-500/10">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                  Time expired — automatic submission failed. Please submit manually below.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={`${buttonPrimary} px-6`}
            >
              {submitting && <Spinner />}
              {submitting ? 'Submitting…' : 'Submit Quiz'}
            </button>
          </form>
        </div>
      )}

      {/* -----------------------------------------------------
      Student view — result after submission
      ----------------------------------------------------- */}
      {isStudent && result && (
        <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6 shadow-card dark:border-green-500/30 dark:bg-green-500/10">
          <h3 className="text-base font-semibold text-green-900 dark:text-green-300">Quiz submitted</h3>
          {result.expired && (
            <p className="mt-1 text-xs font-medium text-orange-600 dark:text-orange-400">
              Time expired — attempt was auto-submitted
            </p>
          )}
          <p className="mt-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {result.score}
            <span className="text-lg font-normal text-gray-500 dark:text-gray-400"> / {result.maxScore}</span>
          </p>
          <p className="mt-2 inline-block rounded-full bg-white dark:bg-gray-900 px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-black/[0.04]">
            Status: {result.status.replace('_', ' ')}
          </p>
          <div className="mt-5">
            <button
              onClick={() => {
                setResult(null);
                setMessage('');
                fetchData();
              }}
              className={buttonSecondary}
            >
              Back to Quiz
            </button>
          </div>
        </div>
      )}

      {/* -----------------------------------------------------
      Teacher view — edit settings + questions + results
      ----------------------------------------------------- */}
      {isTeacher && (
        <div className="mt-8 space-y-8">
          <div className="flex gap-3">
            <button
              onClick={openEdit}
              className={buttonPrimary}
            >
              Edit Settings
            </button>
            <button
              onClick={() => setShowAddQuestion(!showAddQuestion)}
              className={buttonSecondary}
            >
              {showAddQuestion ? 'Cancel' : '+ Add Question'}
            </button>
          </div>

          {showEdit && (
            <form onSubmit={handleSaveQuiz} className="rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-5 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-6">
              <div className="sm:col-span-2">
                <label className={labelStyles}>Title *</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className={inputStyles}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelStyles}>Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
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
                  value={editForm.timeLimit}
                  onChange={(e) => setEditForm({ ...editForm, timeLimit: e.target.value })}
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
                  value={editForm.maxAttempts}
                  onChange={(e) => setEditForm({ ...editForm, maxAttempts: e.target.value })}
                  className={inputStyles}
                />
              </div>
              <div>
                <label className={labelStyles}>Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className={inputStyles}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={editForm.shuffleQuestions}
                    onChange={(e) => setEditForm({ ...editForm, shuffleQuestions: e.target.checked })}
                    className="h-4 w-4 accent-primary-600"
                  />
                  Shuffle questions
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={editForm.shuffleOptions}
                    onChange={(e) => setEditForm({ ...editForm, shuffleOptions: e.target.checked })}
                    className="h-4 w-4 accent-primary-600"
                  />
                  Shuffle options
                </label>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className={buttonPrimary}
                >
                  {saving && <Spinner />}
                  {saving ? 'Saving…' : 'Save Quiz'}
                </button>
              </div>
            </form>
          )}

          {showAddQuestion && (
            <form onSubmit={handleAddQuestion} className="rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] space-y-4 p-5">
              <div>
                <label className={labelStyles}>Question Prompt *</label>
                <input
                  type="text"
                  required
                  value={questionDraft.prompt}
                  onChange={(e) => setQuestionDraft({ ...questionDraft, prompt: e.target.value })}
                  className={inputStyles}
                  placeholder="e.g. What is the capital of Ethiopia?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelStyles}>Type</label>
                  <select
                    value={questionDraft.type}
                    onChange={(e) => setQuestionDraft({ ...questionDraft, type: e.target.value })}
                    className={inputStyles}
                  >
                    <option value="SINGLE_CHOICE">Single Choice</option>
                    <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyles}>Points</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={questionDraft.points}
                    onChange={(e) => setQuestionDraft({ ...questionDraft, points: e.target.value })}
                    className={inputStyles}
                  />
                </div>
              </div>

              <div>
                <label className={`${labelStyles} mb-2`}>Options (mark the correct one)</label>
                <div className="space-y-2">
                  {questionDraft.options.map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <input
                        type={questionDraft.type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'}
                        name="correct-option"
                        checked={option.isCorrect}
                        onChange={() =>
                          setQuestionDraft((prev) => ({
                            ...prev,
                            options: prev.options.map((o, i) =>
                              i === optIndex ? { ...o, isCorrect: !o.isCorrect } : o
                            ),
                          }))
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary-600"
                        title="Correct"
                      />
                      <input
                        type="text"
                        required
                        value={option.optionText}
                        onChange={(e) => updateQuestionOption(optIndex, 'optionText', e.target.value)}
                        className={inputStyles}
                        placeholder={`Option ${optIndex + 1}`}
                      />
                      {questionDraft.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOptionRow(optIndex)}
                          className="text-xs text-red-600 hover:text-red-800 shrink-0"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addOptionRow}
                  className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                >
                  + Add option
                </button>
              </div>

              <button
                type="submit"
                disabled={addingQuestion}
                className={buttonPrimary}
              >
                {addingQuestion && <Spinner />}
                {addingQuestion ? 'Adding…' : 'Add Question'}
              </button>
            </form>
          )}

          {/* Questions list with correct answers */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Questions ({quiz.questions?.length || 0})</h3>
            {!quiz.questions || quiz.questions.length === 0 ? (
              <EmptyState
                icon="clipboard"
                title="No questions yet"
                message="Add your first question above to build this quiz."
              />
            ) : (
              <div className="space-y-4">
                {quiz.questions.map((question, qIndex) => (
                  <div key={question.id} className="rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Q{qIndex + 1}</span>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{question.prompt}</h4>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{question.points} pt(s) · {question.type.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {question.options.map((option) => (
                        <div key={option.id} className={`text-sm flex items-center gap-2 ${option.isCorrect ? 'text-green-700 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                          <span>{option.isCorrect ? '✓' : '•'}</span>
                          <span>{option.optionText}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teacher results */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Results ({attempts.length})</h3>
            {attempts.length === 0 ? (
              <EmptyState
                icon="users"
                title="No attempts yet"
                message="Student attempts will appear here as they are submitted."
              />
            ) : (
              <div className="space-y-3">
                {attempts.map((attempt) => (
                  <div key={attempt.id} className="flex items-center justify-between rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {attempt.student?.user?.fullName || 'Unknown student'}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Started: {formatStart(attempt.startedAt)}</p>
                      {attempt.submittedAt && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">Submitted: {formatStart(attempt.submittedAt)}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <StatusBadge status={attempt.status} />
                      {attempt.score !== null && attempt.score !== undefined && (
                        <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {attempt.score} <span className="text-sm text-gray-500 dark:text-gray-400">/ {attempt.maxScore}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin view */}
      {user?.role === 'ADMIN' && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Attempts ({attempts.length})</h3>
          {attempts.length === 0 ? (
            <EmptyState
              icon="users"
              title="No attempts yet"
              message="No students have taken this quiz yet."
            />
          ) : (
            <div className="space-y-3">
              {attempts.map((attempt) => (
                <div key={attempt.id} className="flex items-center justify-between rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {attempt.student?.user?.fullName || 'Unknown student'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Started: {formatStart(attempt.startedAt)}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={attempt.status} />
                    {attempt.score !== null && attempt.score !== undefined && (
                      <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {attempt.score} <span className="text-sm text-gray-500 dark:text-gray-400">/ {attempt.maxScore}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatStart(date: string) {
  return new Date(date).toLocaleString();
}
