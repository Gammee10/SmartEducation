import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { Card, EmptyState, LoadingState, PageHeader, Banner } from '../components/ui';
import type { BorrowRequest, Loan } from '../types';

export default function MyBorrowingPage() {
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [reqRes, loanRes] = await Promise.all([
        api.get('/library/requests/mine', { params: { pageSize: 50 } }),
        api.get('/library/loans/mine', { params: { pageSize: 50 } }),
      ]);
      setRequests(reqRes.data.data);
      setLoans(loanRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load borrowing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString();
  };

  const isOverdue = (loan: Loan) =>
    loan.status === 'ACTIVE' && loan.dueDate && new Date(loan.dueDate) < new Date();

  // Only show the full-page loader before the first load completes so
  // background refetches do not blank the page and cause a layout flash.
  const initialLoading = loading && requests.length === 0 && loans.length === 0;

  if (initialLoading) {
    return <LoadingState label="Loading your borrowing activity…" />;
  }

  const thClass =
    'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400';

  return (
    <div>
      <PageHeader
        title="My Borrowing"
        description="Track your borrow requests and active loans."
      />

      {error && (
        <div className="mb-4">
          <Banner tone="error" message={error} />
        </div>
      )}

      <div className="space-y-8">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Borrow Requests</h2>
          {requests.length === 0 ? (
            <Card>
              <EmptyState
                icon="book"
                title="No borrow requests yet"
                message="Request a book from the library catalog and it will show up here."
              />
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03]">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className={thClass}>Book</th>
                    <th className={thClass}>Requested</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                  {requests.map((req) => (
                    <tr key={req.id} className="transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {req.bookCopy?.book?.title}
                        <span className="text-gray-500 dark:text-gray-400"> — {req.bookCopy?.book?.author}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{formatDate(req.requestedAt)}</td>
                      <td className="px-6 py-4"><StatusBadge status={req.status} /></td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{req.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Loans</h2>
          {loans.length === 0 ? (
            <Card>
              <EmptyState
                icon="book"
                title="No loans"
                message="Once a request is approved, your loan and its due date will appear here."
              />
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03]">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className={thClass}>Book</th>
                    <th className={thClass}>Issued</th>
                    <th className={thClass}>Due</th>
                    <th className={thClass}>Returned</th>
                    <th className={thClass}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                  {loans.map((loan) => (
                    <tr
                      key={loan.id}
                      className={`transition-colors duration-150 ${
                        isOverdue(loan)
                          ? 'bg-red-50/60 hover:bg-red-50 dark:bg-red-500/10 dark:hover:bg-red-500/15'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                      }`}
                    >
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {loan.bookCopy?.book?.title}
                        <span className="text-gray-500 dark:text-gray-400"> — {loan.bookCopy?.book?.author}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{formatDate(loan.issuedAt)}</td>
                      <td
                        className={`px-6 py-4 text-sm font-medium ${
                          isOverdue(loan) ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {formatDate(loan.dueDate)}
                        {isOverdue(loan) && <span className="ml-2 text-xs font-semibold">· Overdue</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{formatDate(loan.returnedAt)}</td>
                      <td className="px-6 py-4"><StatusBadge status={loan.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
