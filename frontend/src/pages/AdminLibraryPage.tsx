import { useState, useEffect, useCallback, FormEvent, Fragment } from 'react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import {
  buttonPrimary,
  buttonSecondary,
  inputStyles,
  labelStyles,
  LoadingState,
  PageHeader,
} from '../components/ui';
import type { Book, BorrowRequest, Loan } from '../types';

const TABS = {
  BOOKS: 'books',
  REQUESTS: 'requests',
  LOANS: 'loans',
} as const;

type TabKey = (typeof TABS)[keyof typeof TABS];

interface BookForm {
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  publishedYear: string;
  category: string;
  description: string;
  copies: string;
}

const emptyForm: BookForm = {
  title: '',
  author: '',
  isbn: '',
  publisher: '',
  publishedYear: '',
  category: '',
  description: '',
  copies: '1',
};

export default function AdminLibraryPage() {
  const [tab, setTab] = useState<TabKey>(TABS.BOOKS);
  const [books, setBooks] = useState<Book[]>([]);
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showAddBook, setShowAddBook] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);

  // Add book form
  const [bookForm, setBookForm] = useState<BookForm>(emptyForm);

  // Inline approve/reject form state (replaces blocking prompt() dialogs)
  const [decisionTarget, setDecisionTarget] = useState<{ id: string; decision: 'APPROVED' | 'REJECTED' } | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const openDecision = (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    setDecisionTarget({ id: requestId, decision });
    setDueDate('');
    setRejectReason('');
    setError('');
    setMessage('');
  };

  const cancelDecision = () => {
    setDecisionTarget(null);
    setDueDate('');
    setRejectReason('');
  };

  const fetchBooks = useCallback(async () => {
    try {
      const response = await api.get('/library/books', { params: { pageSize: 100 } });
      setBooks(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load books');
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const response = await api.get('/library/requests', { params: { pageSize: 100 } });
      setRequests(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load requests');
    }
  }, []);

  const fetchLoans = useCallback(async () => {
    try {
      const response = await api.get('/library/loans', { params: { pageSize: 100 } });
      setLoans(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load loans');
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([fetchBooks(), fetchRequests(), fetchLoans()]);
    } finally {
      setLoading(false);
    }
  }, [fetchBooks, fetchRequests, fetchLoans]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleAddBook = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.post('/library/books', bookForm);
      setMessage('Book added successfully');
      setShowAddBook(false);
      setBookForm(emptyForm);
      fetchBooks();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add book');
    }
  };

  const handleDecide = async () => {
    if (!decisionTarget) return;
    const { id: requestId, decision } = decisionTarget;
    if (decision === 'APPROVED') {
      if (!dueDate) {
        setError('Please choose a due date before approving.');
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      if (dueDate < today) {
        setError('Due date cannot be in the past.');
        return;
      }
    }
    setDeciding(requestId);
    setError('');
    setMessage('');
    try {
      const body: Record<string, string> = { decision };
      if (decision === 'APPROVED') {
        body.dueDate = dueDate;
      } else {
        body.reason = rejectReason.trim();
      }
      await api.post(`/library/requests/${requestId}/decide`, body);
      setMessage(`Request ${decision.toLowerCase()} successfully`);
      cancelDecision();
      fetchRequests();
      fetchLoans();
      fetchBooks();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update request');
    } finally {
      setDeciding(null);
    }
  };

  const handleReturn = async (loanId: string) => {
    setDeciding(loanId);
    setError('');
    setMessage('');
    try {
      await api.post(`/library/loans/${loanId}/return`, {});
      setMessage('Loan returned successfully');
      fetchLoans();
      fetchBooks();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to return loan');
    } finally {
      setDeciding(null);
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString();
  };

  const tabButton = (key: TabKey, label: string) => (
    <button
      onClick={() => setTab(key)}
      aria-pressed={tab === key}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
        tab === key
          ? 'bg-white dark:bg-gray-900 text-primary-700 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700'
          : 'text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:text-gray-100'
      }`}
    >
      {label}
    </button>
  );

  // Only show the full-page loader before the first load completes so
  // background refetches do not blank the page and cause a layout flash.
  const initialLoading = loading && books.length === 0 && requests.length === 0 && loans.length === 0;

  if (initialLoading) {
    return <LoadingState label="Loading library administration…" />;
  }

  return (
    <div>
      <PageHeader
        title="Library Administration"
        description="Manage the book catalog, borrow requests, and loans."
        actions={
          <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
            {tabButton(TABS.BOOKS, 'Books')}
            {tabButton(TABS.REQUESTS, 'Requests')}
            {tabButton(TABS.LOANS, 'Loans')}
          </div>
        }
      />

      {message && (
        <div className="mb-4 rounded-xl border border-green-200 dark:border-green-500/30 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {tab === TABS.BOOKS && (
        <div>
          <div className="mb-4">
            <button
              onClick={() => setShowAddBook(!showAddBook)}
              className={showAddBook ? buttonSecondary : buttonPrimary}
            >
              {showAddBook ? 'Cancel' : '+ Add Book'}
            </button>
          </div>

          {showAddBook && (
            <form onSubmit={handleAddBook} className="mb-6 rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 p-5 shadow-card grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-6">
              <div>
                <label className={labelStyles}>Title *</label>
                <input
                  type="text"
                  required
                  value={bookForm.title}
                  onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  className={inputStyles}
                />
              </div>
              <div>
                <label className={labelStyles}>Author *</label>
                <input
                  type="text"
                  required
                  value={bookForm.author}
                  onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                  className={inputStyles}
                />
              </div>
              <div>
                <label className={labelStyles}>ISBN</label>
                <input
                  type="text"
                  value={bookForm.isbn}
                  onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                  className={inputStyles}
                />
              </div>
              <div>
                <label className={labelStyles}>Publisher</label>
                <input
                  type="text"
                  value={bookForm.publisher}
                  onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })}
                  className={inputStyles}
                />
              </div>
              <div>
                <label className={labelStyles}>Published Year</label>
                <input
                  type="number"
                  value={bookForm.publishedYear}
                  onChange={(e) => setBookForm({ ...bookForm, publishedYear: e.target.value })}
                  className={inputStyles}
                />
              </div>
              <div>
                <label className={labelStyles}>Category</label>
                <input
                  type="text"
                  value={bookForm.category}
                  onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                  className={inputStyles}
                />
              </div>
              <div>
                <label className={labelStyles}>Number of Copies</label>
                <input
                  type="number"
                  min="1"
                  value={bookForm.copies}
                  onChange={(e) => setBookForm({ ...bookForm, copies: e.target.value })}
                  className={inputStyles}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelStyles}>Description</label>
                <textarea
                  value={bookForm.description}
                  onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                  rows={3}
                  className={inputStyles}
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className={buttonPrimary}
                >
                  Save Book
                </button>
              </div>
            </form>
          )}

          <div className="rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 shadow-card overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Author</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">ISBN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Copies</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {books.map((book) => (
                  <tr key={book.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{book.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">{book.author}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">{book.isbn || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">{book.category || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {book.copies?.map((copy) => (
                          <span key={copy.id} title={`Copy ${copy.copyNumber}`}>
                            <StatusBadge status={copy.status} />
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === TABS.REQUESTS && (
        <div className="rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 shadow-card overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Book</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Requested</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center">No borrow requests</td>
                </tr>
              )}
              {requests.map((req) => (
                <Fragment key={req.id}>
                  <tr>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {req.student?.user?.fullName}
                    <span className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{req.student?.user?.email}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {req.bookCopy?.book?.title}
                    <span className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Copy {req.bookCopy?.copyNumber}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">{formatDate(req.requestedAt)}</td>
                  <td className="px-6 py-4"><StatusBadge status={req.status} /></td>
                  <td className="px-6 py-4">
                    {req.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openDecision(req.id, 'APPROVED')}
                          disabled={deciding === req.id}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-green-700 disabled:pointer-events-none disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => openDecision(req.id, 'REJECTED')}
                          disabled={deciding === req.id}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-red-700 disabled:pointer-events-none disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {decisionTarget?.id === req.id && (
                  <tr>
                    <td colSpan={5} className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleDecide();
                        }}
                        className="flex flex-wrap items-end gap-3"
                      >
                        {decisionTarget.decision === 'APPROVED' ? (
                          <div>
                            <label htmlFor={`due-${req.id}`} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500">
                              Due date *
                            </label>
                            <input
                              id={`due-${req.id}`}
                              type="date"
                              required
                              value={dueDate}
                              onChange={(e) => setDueDate(e.target.value)}
                              className={inputStyles}
                            />
                          </div>
                        ) : (
                          <div className="min-w-[220px] flex-1">
                            <label htmlFor={`reason-${req.id}`} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500">
                              Reason for rejection (optional)
                            </label>
                            <input
                              id={`reason-${req.id}`}
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="e.g. Copy reserved for another student"
                              className={inputStyles}
                            />
                          </div>
                        )}
                        <button
                          type="submit"
                          disabled={deciding === req.id}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium text-white disabled:opacity-50 ${
                            decisionTarget.decision === 'APPROVED'
                              ? 'bg-green-600 hover:bg-green-700'
                              : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          {deciding === req.id ? 'Saving...' : `Confirm ${decisionTarget.decision === 'APPROVED' ? 'Approval' : 'Rejection'}`}
                        </button>
                        <button
                          type="button"
                          onClick={cancelDecision}
                          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          Cancel
                        </button>
                      </form>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === TABS.LOANS && (
        <div className="rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-900 shadow-card overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Book</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Issued</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Due</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {loans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    No loans yet. Loans appear here once requests are approved.
                  </td>
                </tr>
              )}
              {loans.map((loan) => (
                <tr key={loan.id}>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {loan.student?.user?.fullName}
                    <span className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{loan.student?.user?.email}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {loan.bookCopy?.book?.title}
                    <span className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Copy {loan.bookCopy?.copyNumber}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">{formatDate(loan.issuedAt)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">{formatDate(loan.dueDate)}</td>
                  <td className="px-6 py-4"><StatusBadge status={loan.status} /></td>
                  <td className="px-6 py-4">
                    {loan.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleReturn(loan.id)}
                        disabled={deciding === loan.id}
                        className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-primary-700 disabled:pointer-events-none disabled:opacity-60"
                      >
                        Record Return
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}