import { useState, useEffect, useCallback, FormEvent, Fragment } from 'react';
import api from '../api/client';
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

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-50 text-yellow-700',
      APPROVED: 'bg-green-50 text-green-700',
      REJECTED: 'bg-red-50 text-red-700',
      CANCELLED: 'bg-gray-100 text-gray-600',
      ACTIVE: 'bg-blue-50 text-blue-700',
      RETURNED: 'bg-green-50 text-green-700',
      OVERDUE: 'bg-red-50 text-red-700',
      AVAILABLE: 'bg-green-50 text-green-700',
      BORROWED: 'bg-blue-50 text-blue-700',
      LOST: 'bg-red-50 text-red-700',
      DAMAGED: 'bg-orange-50 text-orange-700',
      ARCHIVED: 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`inline-block text-xs font-medium rounded-full px-2 py-1 ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString();
  };

  const tabButton = (key: TabKey, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`px-4 py-2 rounded-md text-sm font-medium ${
        tab === key ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Library Administration</h1>
        <div className="flex gap-2">
          {tabButton(TABS.BOOKS, 'Books')}
          {tabButton(TABS.REQUESTS, 'Requests')}
          {tabButton(TABS.LOANS, 'Loans')}
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">{message}</div>
      )}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {tab === TABS.BOOKS && (
        <div>
          <div className="mb-4">
            <button
              onClick={() => setShowAddBook(!showAddBook)}
              className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              {showAddBook ? 'Cancel' : '+ Add Book'}
            </button>
          </div>

          {showAddBook && (
            <form onSubmit={handleAddBook} className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title *</label>
                <input
                  type="text"
                  required
                  value={bookForm.title}
                  onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Author *</label>
                <input
                  type="text"
                  required
                  value={bookForm.author}
                  onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">ISBN</label>
                <input
                  type="text"
                  value={bookForm.isbn}
                  onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Publisher</label>
                <input
                  type="text"
                  value={bookForm.publisher}
                  onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Published Year</label>
                <input
                  type="number"
                  value={bookForm.publishedYear}
                  onChange={(e) => setBookForm({ ...bookForm, publishedYear: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <input
                  type="text"
                  value={bookForm.category}
                  onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Number of Copies</label>
                <input
                  type="number"
                  min="1"
                  value={bookForm.copies}
                  onChange={(e) => setBookForm({ ...bookForm, copies: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={bookForm.description}
                  onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                >
                  Save Book
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISBN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Copies</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {books.map((book) => (
                  <tr key={book.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{book.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{book.author}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{book.isbn || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{book.category || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {book.copies?.map((copy) => (
                          <span key={copy.id} title={`Copy ${copy.copyNumber}`}>
                            {statusBadge(copy.status)}
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-sm text-gray-500 text-center">No borrow requests</td>
                </tr>
              )}
              {requests.map((req) => (
                <Fragment key={req.id}>
                  <tr>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {req.student?.user?.fullName}
                    <span className="block text-xs text-gray-500">{req.student?.user?.email}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {req.bookCopy?.book?.title}
                    <span className="block text-xs text-gray-500">Copy {req.bookCopy?.copyNumber}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(req.requestedAt)}</td>
                  <td className="px-6 py-4">{statusBadge(req.status)}</td>
                  <td className="px-6 py-4">
                    {req.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openDecision(req.id, 'APPROVED')}
                          disabled={deciding === req.id}
                          className="px-3 py-1 rounded-md text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => openDecision(req.id, 'REJECTED')}
                          disabled={deciding === req.id}
                          className="px-3 py-1 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {decisionTarget?.id === req.id && (
                  <tr>
                    <td colSpan={5} className="bg-gray-50 px-6 py-4">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleDecide();
                        }}
                        className="flex flex-wrap items-end gap-3"
                      >
                        {decisionTarget.decision === 'APPROVED' ? (
                          <div>
                            <label htmlFor={`due-${req.id}`} className="block text-xs font-medium text-gray-700">
                              Due date *
                            </label>
                            <input
                              id={`due-${req.id}`}
                              type="date"
                              required
                              value={dueDate}
                              onChange={(e) => setDueDate(e.target.value)}
                              className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                            />
                          </div>
                        ) : (
                          <div className="min-w-[220px] flex-1">
                            <label htmlFor={`reason-${req.id}`} className="block text-xs font-medium text-gray-700">
                              Reason for rejection (optional)
                            </label>
                            <input
                              id={`reason-${req.id}`}
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="e.g. Copy reserved for another student"
                              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
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
                          className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-100"
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issued</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-sm text-gray-500 text-center">No loans</td>
                </tr>
              )}
              {loans.map((loan) => (
                <tr key={loan.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {loan.student?.user?.fullName}
                    <span className="block text-xs text-gray-500">{loan.student?.user?.email}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {loan.bookCopy?.book?.title}
                    <span className="block text-xs text-gray-500">Copy {loan.bookCopy?.copyNumber}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(loan.issuedAt)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(loan.dueDate)}</td>
                  <td className="px-6 py-4">{statusBadge(loan.status)}</td>
                  <td className="px-6 py-4">
                    {loan.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleReturn(loan.id)}
                        disabled={deciding === loan.id}
                        className="px-3 py-1 rounded-md text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
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