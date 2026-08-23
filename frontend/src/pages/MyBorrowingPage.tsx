import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
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

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Borrowing</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Borrow Requests</h2>
          {requests.length === 0 ? (
            <p className="text-sm text-gray-500">You have not made any borrow requests yet.</p>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map((req) => (
                    <tr key={req.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {req.bookCopy?.book?.title}
                        <span className="text-gray-500"> — {req.bookCopy?.book?.author}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(req.requestedAt)}</td>
                      <td className="px-6 py-4"><StatusBadge status={req.status} /></td>
                      <td className="px-6 py-4 text-sm text-gray-600">{req.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Loans</h2>
          {loans.length === 0 ? (
            <p className="text-sm text-gray-500">You have no loans.</p>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issued</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Returned</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loans.map((loan) => (
                    <tr key={loan.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {loan.bookCopy?.book?.title}
                        <span className="text-gray-500"> — {loan.bookCopy?.book?.author}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(loan.issuedAt)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(loan.dueDate)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(loan.returnedAt)}</td>
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