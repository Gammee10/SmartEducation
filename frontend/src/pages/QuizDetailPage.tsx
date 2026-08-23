import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
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

  useEffect(() => {
    selectionsRef.current = selections;
  }, [selections]);

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
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Resume an in-progress attempt after a refresh or navigation away, so a
  // student does not silently lose an attempt that is still running
  // server-side. Selections cannot be recovered, but the remaining time can.
  useEffect(() => {
    if (!isStudent || !quiz || takingQuiz || result) return;
    const inProgress = attempts.find((a) => a.status === 'IN_PROGRESS');
    if (!inProgress) return;
    setActiveAttempt({ id: inProgress.id, expiresAt: inProgress.expiresAt });
    setTakingQuiz(true);
    const initial: Record<string, string[]> = {};
    for (const q of quiz.questions || []) {
      initial[q.id] = [];
    }
    setSelections(initial);
  }, [attempts, quiz, isStudent, takingQuiz, result]);

  // Countdown timer for active quiz attempt (auto-submits on expiry)
  useEffect(() => {
    if (!activeAttempt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(activeAttempt.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0 && takingQuiz) {
        submitRef.current(selectionsRef.current, true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setTakingQuiz(false);
      setActiveAttempt(null);
      setMessage(autoExpired ? 'Time expired — your attempt was auto-submitted' : 'Quiz submitted successfully');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit quiz');
      // If the attempt was already submitted server-side, refresh state
      fetchData();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">{error || 'Quiz not found'}</p>
        <Link to={`/courses/${courseId}`} className="text-primary-600 hover:text-primary-700">← Back to Course</Link>
      </div>
    );
  }

  return (
    <div>
      <Link to={`/courses/${courseId}`} className="text-sm text-primary-600 hover:text-primary-700">← Back to Course</Link>

      <div className="mt-2 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {quiz.course?.subject} · Grade {quiz.course?.gradeLevel}
          </p>
        </div>
        <StatusBadge status={quiz.status} />
      </div>

      {quiz.description && (
        <p className="mt-3 text-sm text-gray-600">{quiz.description}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
        <span className="font-medium text-gray-900">Time limit: {quiz.timeLimit} min</span>
        <span>Attempts allowed: {quiz.maxAttempts}</span>
        <span>{quiz.questions?.length || 0} question(s)</span>
        {quiz.shuffleQuestions && <span>Shuffled questions</span>}
        {quiz.shuffleOptions && <span>Shuffled options</span>}
      </div>

      {message && <div className="mt-4 mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">{message}</div>}
      {error && <div className="mt-4 mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {/* -----------------------------------------------------
          Student view when not actively taking the quiz
          ----------------------------------------------------- */}
      {isStudent && !takingQuiz && !result && (
        <div className="mt-8 space-y-6">
          {quiz.status === 'PUBLISHED' ? (
            <button
              onClick={handleStartAttempt}
              className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              Start Quiz
            </button>
          ) : (
            <p className="text-sm text-gray-500">This quiz is not available yet.</p>
          )}

          {attempts.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Attempts</h3>
              <div className="space-y-3">
                {attempts.map((attempt) => (
                  <div key={attempt.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">Started: {formatStart(attempt.startedAt)}</p>
                        {attempt.submittedAt && (
                          <p className="text-xs text-gray-400">Submitted: {formatStart(attempt.submittedAt)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <StatusBadge status={attempt.status} />
                        {attempt.score !== null && attempt.score !== undefined && (
                          <p className="mt-1 text-lg font-semibold text-gray-900">
                            {attempt.score} <span className="text-sm text-gray-500">/ {attempt.maxScore}</span>
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
          <div className="sticky top-0 bg-white border-b border-gray-200 py-3 mb-4 flex items-center justify-between z-10">
            <span className="text-sm font-medium text-gray-700">Time remaining:</span>
            <span className={`text-lg font-bold ${secondsLeft <= 60 ? 'text-red-600' : 'text-gray-900'}`}>
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
                <div key={question.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-xs text-gray-400">Question {qIndex + 1}</span>
                      <h3 className="text-sm font-medium text-gray-900 mt-1">{question.prompt}</h3>
                    </div>
                    <span className="text-xs text-gray-400">{question.points} pt(s)</span>
                  </div>
                  <div className="space-y-2">
                    {question.options.map((option) => {
                      const isSelected = selected.includes(option.id);
                      return (
                        <label
                          key={option.id}
                          className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                            isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
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
                            className="mt-1"
                          />
                          <span className="text-sm text-gray-700">{option.optionText}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </form>
        </div>
      )}

      {/* -----------------------------------------------------
      Student view — result after submission
      ----------------------------------------------------- */}
      {isStudent && result && (
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quiz Result</h3>
          {result.expired && (
            <p className="text-xs text-orange-600 font-medium mb-2">Time expired — attempt was auto-submitted</p>
          )}
          <p className="text-3xl font-bold text-gray-900">
            {result.score}
            <span className="text-lg font-normal text-gray-500"> / {result.maxScore}</span>
          </p>
          <p className="text-sm text-gray-500 mt-2">Status: {result.status.replace('_', ' ')}</p>
          <button
            onClick={() => {
              setResult(null);
              setMessage('');
              fetchData();
            }}
            className="mt-4 px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            Back to Quiz
          </button>
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
              className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              Edit Settings
            </button>
            <button
              onClick={() => setShowAddQuestion(!showAddQuestion)}
              className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
            >
              {showAddQuestion ? 'Cancel' : '+ Add Question'}
            </button>
          </div>

          {showEdit && (
            <form onSubmit={handleSaveQuiz} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Title *</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Time Limit (minutes) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={300}
                  value={editForm.timeLimit}
                  onChange={(e) => setEditForm({ ...editForm, timeLimit: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Max Attempts *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={10}
                  value={editForm.maxAttempts}
                  onChange={(e) => setEditForm({ ...editForm, maxAttempts: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
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
                    checked={editForm.shuffleQuestions}
                    onChange={(e) => setEditForm({ ...editForm, shuffleQuestions: e.target.checked })}
                  />
                  Shuffle questions
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editForm.shuffleOptions}
                    onChange={(e) => setEditForm({ ...editForm, shuffleOptions: e.target.checked })}
                  />
                  Shuffle options
                </label>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Quiz'}
                </button>
              </div>
            </form>
          )}

          {showAddQuestion && (
            <form onSubmit={handleAddQuestion} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Question Prompt *</label>
                <input
                  type="text"
                  required
                  value={questionDraft.prompt}
                  onChange={(e) => setQuestionDraft({ ...questionDraft, prompt: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                  placeholder="e.g. What is the capital of Ethiopia?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={questionDraft.type}
                    onChange={(e) => setQuestionDraft({ ...questionDraft, type: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                  >
                    <option value="SINGLE_CHOICE">Single Choice</option>
                    <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Points</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={questionDraft.points}
                    onChange={(e) => setQuestionDraft({ ...questionDraft, points: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Options (mark the correct one)</label>
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
                        className="mt-0.5 shrink-0"
                        title="Correct"
                      />
                      <input
                        type="text"
                        required
                        value={option.optionText}
                        onChange={(e) => updateQuestionOption(optIndex, 'optionText', e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
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
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
              >
                {addingQuestion ? 'Adding...' : 'Add Question'}
              </button>
            </form>
          )}

          {/* Questions list with correct answers */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Questions ({quiz.questions?.length || 0})</h3>
            {!quiz.questions || quiz.questions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No questions yet. Add one above.</div>
            ) : (
              <div className="space-y-4">
                {quiz.questions.map((question, qIndex) => (
                  <div key={question.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500">Q{qIndex + 1}</span>
                          <h4 className="text-sm font-medium text-gray-900">{question.prompt}</h4>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{question.points} pt(s) · {question.type.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {question.options.map((option) => (
                        <div key={option.id} className={`text-sm flex items-center gap-2 ${option.isCorrect ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Results ({attempts.length})</h3>
            {attempts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No attempts yet.</div>
            ) : (
              <div className="space-y-3">
                {attempts.map((attempt) => (
                  <div key={attempt.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {attempt.student?.user?.fullName || 'Unknown student'}
                      </p>
                      <p className="text-xs text-gray-400">Started: {formatStart(attempt.startedAt)}</p>
                      {attempt.submittedAt && (
                        <p className="text-xs text-gray-400">Submitted: {formatStart(attempt.submittedAt)}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <StatusBadge status={attempt.status} />
                      {attempt.score !== null && attempt.score !== undefined && (
                        <p className="mt-1 text-lg font-semibold text-gray-900">
                          {attempt.score} <span className="text-sm text-gray-500">/ {attempt.maxScore}</span>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Attempts ({attempts.length})</h3>
          {attempts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No attempts yet.</div>
          ) : (
            <div className="space-y-3">
              {attempts.map((attempt) => (
                <div key={attempt.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {attempt.student?.user?.fullName || 'Unknown student'}
                    </p>
                    <p className="text-xs text-gray-400">Started: {formatStart(attempt.startedAt)}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={attempt.status} />
                    {attempt.score !== null && attempt.score !== undefined && (
                      <p className="mt-1 text-lg font-semibold text-gray-900">
                        {attempt.score} <span className="text-sm text-gray-500">/ {attempt.maxScore}</span>
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
