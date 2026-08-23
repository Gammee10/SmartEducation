import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Book, Pagination } from '../types';

export default function LibraryCatalogPage() {
  const { isStudent } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [requesting, setRequesting] = useState<string | null>(null);

  const fetchBooks = useCallback(async (page = 1, signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, unknown> = { page, pageSize: 20 };
      if (search) params.search = search;
      if (category) params.category = category;
      const response = await api.get('/library/books', { params, signal });
      setBooks(response.data.data);
      setPagination(response.data.pagination);
    } catch (err: any) {
      // Ignore aborted requests - a newer search superseded this one
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
      setError(err.response?.data?.message || 'Failed to load books');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => fetchBooks(1, controller.signal), 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fetchBooks]);

  const handleRequest = async (bookCopyId: string) => {
    setRequesting(bookCopyId);
    setMessage('');
    setError('');
    try {
      await api.post('/library/requests', { bookCopyId });
      setMessage('Borrow request submitted successfully');
      fetchBooks(pagination.page);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit request');
    } finally {
      setRequesting(null);
    }
  };

  const availableCopies = (book: Book) => book.copies?.filter((c) => c.status === 'AVAILABLE') || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Library Catalog</h1>
      </div>

      {message && (
        <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">{message}</div>
      )}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, author, or ISBN..."
          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
        />
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (e.g. Textbook)"
          className="sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm border px-3 py-2"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading books...</div>
      ) : books.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No books found</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => {
              const avail = availableCopies(book);
              return (
                <div key={book.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col">
                  <h3 className="text-lg font-semibold text-gray-900">{book.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">by {book.author}</p>
                  {book.isbn && <p className="text-xs text-gray-400 mt-1">ISBN: {book.isbn}</p>}
                  {book.category && (
                    <span className="mt-2 inline-block text-xs bg-primary-50 text-primary-700 rounded-full px-2 py-1 w-fit">
                      {book.category}
                    </span>
                  )}
                  <div className="mt-4 text-sm text-gray-600">
                    <span className="font-medium">{avail.length}</span> available of{' '}
                    <span className="font-medium">{book.copies?.length || 0}</span> copies
                  </div>
                  <div className="mt-auto pt-4">
                    {isStudent && avail.length > 0 && (
                      <button
                        onClick={() => handleRequest(avail[0].id)}
                        disabled={requesting === avail[0].id}
                        className="w-full px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                      >
                        {requesting === avail[0].id ? 'Requesting...' : 'Request to Borrow'}
                      </button>
                    )}
                    {isStudent && avail.length === 0 && (
                      <span className="text-sm text-gray-400">No copies available</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {pagination.totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              <button
                onClick={() => fetchBooks(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-4 py-2 rounded-md text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchBooks(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-4 py-2 rounded-md text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}