import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { EmptyState, buttonPrimary, LoadingState, PageHeader, Banner, Spinner } from '../components/ui';
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
      <PageHeader title="Library Catalog" description="Search the school library and request to borrow books." />

      {message && (
        <div className="mb-4">
          <Banner tone="success" message={message} />
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Banner tone="error" message={error} />
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, author, or ISBN…"
            className="block w-full flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 py-2.5 pl-10 pr-3.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (e.g. Textbook)"
          className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 sm:w-64"
        />
      </div>

      {loading ? (
        <LoadingState label="Loading books…" />
      ) : books.length === 0 ? (
        <EmptyState
          icon="book"
          title="No books found"
          message={
            search || category
              ? 'Try adjusting your search terms or clearing the category filter.'
              : 'The library catalog is empty right now.'
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => {
              const avail = availableCopies(book);
              return (
                <div key={book.id} className="flex flex-col rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-6 transition-shadow duration-200 hover:shadow-card-hover">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{book.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">by {book.author}</p>
                  {book.isbn && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">ISBN: {book.isbn}</p>}
                  {book.category && (
                    <span className="mt-2 inline-block text-xs bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400 rounded-full px-2 py-1 w-fit">
                      {book.category}
                    </span>
                  )}
                  <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">{avail.length}</span> available of{' '}
                    <span className="font-medium">{book.copies?.length || 0}</span> copies
                  </div>
                  <div className="mt-auto pt-4">
                    {isStudent && avail.length > 0 && (
                      <button
                        onClick={() => handleRequest(avail[0].id)}
                        disabled={requesting === avail[0].id}
                        className={`${buttonPrimary} w-full`}
                      >
                        {requesting === avail[0].id && <Spinner />}
                        {requesting === avail[0].id ? 'Requesting…' : 'Request to Borrow'}
                      </button>
                    )}
                    {isStudent && avail.length === 0 && (
                      <span className="text-sm text-gray-400 dark:text-gray-500">No copies available</span>
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
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:pointer-events-none disabled:opacity-60"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchBooks(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:pointer-events-none disabled:opacity-60"
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