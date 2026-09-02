import { usePageTitle } from '../hooks/usePageTitle';
import { useEffect, useState, useCallback, FormEvent, ChangeEvent } from 'react';
import api from '../api/client';
import {
  buttonPrimary,
  buttonSecondary,
  inputStyles,
  LoadingState,
  PageHeader,
  Banner,
  EmptyState,
  Spinner,
} from '../components/ui';
import type { AdminUser, ImportResult } from '../types';

const emptyCreateForm = {
  fullName: '',
  email: '',
  role: 'STUDENT',
  password: '',
  phone: '',
  gradeLevel: '',
  section: '',
  subject: '',
};

export default function AdminUsersPage() {
  usePageTitle('User Management');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Debounce the search box so typing does not fire a request per keystroke
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);

  // Password reset
  const [resetting, setResetting] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; temporaryPassword: string } | null>(null);

  // CSV import
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/users', {
        params: {
          role: roleFilter || undefined,
          search: search || undefined,
          pageSize: 100,
        },
      })
      .then((res) => setUsers(res.data.data.users))
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false));
  }, [roleFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    setMessage('');
    try {
      await api.post('/users', {
        fullName: createForm.fullName,
        email: createForm.email,
        role: createForm.role,
        password: createForm.password || undefined,
        phone: createForm.phone || undefined,
        ...(createForm.role === 'STUDENT'
          ? { gradeLevel: createForm.gradeLevel, section: createForm.section || undefined }
          : { subject: createForm.subject || undefined }),
      });
      setMessage('User created successfully');
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!window.confirm('Archive this user? They will no longer be able to log in.')) return;
    setArchiving(id);
    setError('');
    setMessage('');
    try {
      await api.post(`/users/${id}/archive`);
      setMessage('User archived');
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to archive user');
    } finally {
      setArchiving(null);
    }
  };

  const handleResetPassword = async (u: AdminUser) => {
    if (!window.confirm(`Generate a new temporary password for ${u.fullName}? Their current password will stop working.`)) return;
    setResetting(u.id);
    setError('');
    setMessage('');
    try {
      const res = await api.post(`/users/${u.id}/reset-password`);
      setResetResult({ email: u.email, temporaryPassword: res.data.data.temporaryPassword });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetting(null);
    }
  };

  const handleCsvFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ''));
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');
    setMessage('');
    setImportResult(null);
    try {
      const res = await api.post('/users/import', { csv: csvText, filename: 'bulk-import.csv' });
      setImportResult(res.data.data.import);
      setCsvText('');
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Create accounts, manage roles, and archive users."
        actions={
          <button
            onClick={() => setShowCreate(!showCreate)}
            className={showCreate ? buttonSecondary : buttonPrimary}
          >
            {showCreate ? 'Cancel' : '+ Create User'}
          </button>
        }
      />

      {error && (
        <div className="mb-4">
          <Banner tone="error" message={error} />
        </div>
      )}
      {message && (
        <div className="mb-4">
          <Banner tone="success" message={message} />
        </div>
      )}
      {resetResult && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Temporary password for {resetResult.email}:{' '}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono dark:bg-amber-500/20">
              {resetResult.temporaryPassword}
            </code>
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Shown only once — copy it now and share it with the user securely. Ask them to change it after logging in.
          </p>
        </div>
      )}

      {/* Create user */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-5 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:p-6"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Full name *</label>
            <input
              type="text"
              required
              value={createForm.fullName}
              onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
              className={inputStyles}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Email *</label>
            <input
              type="email"
              required
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              className={inputStyles}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Role *</label>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
              className={inputStyles}
            >
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Password (defaults to Password123!)
            </label>
            <input
              type="text"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              className={inputStyles}
            />
          </div>
          {createForm.role === 'STUDENT' ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Grade level *</label>
                <input
                  type="text"
                  required
                  value={createForm.gradeLevel}
                  onChange={(e) => setCreateForm({ ...createForm, gradeLevel: e.target.value })}
                  placeholder="e.g. Grade 9"
                  className={inputStyles}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Section</label>
                <input
                  type="text"
                  value={createForm.section}
                  onChange={(e) => setCreateForm({ ...createForm, section: e.target.value })}
                  className={inputStyles}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Subject</label>
              <input
                type="text"
                value={createForm.subject}
                onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                className={inputStyles}
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className={buttonPrimary}
            >
              {creating && <Spinner />}
              {creating ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className={inputStyles}
        >
          <option value="">All roles</option>
          <option value="ADMIN">Admins</option>
          <option value="TEACHER">Teachers</option>
          <option value="STUDENT">Students</option>
        </select>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or email..."
          className="block min-w-[200px] flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm transition-colors duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        />
      </div>

      {/* Users table */}
      {loading ? (
        <LoadingState label="Loading users…" />
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03]">
          <EmptyState
            icon="users"
            title="No users found"
            message={
              search || roleFilter
                ? 'Try adjusting your search or role filter.'
                : 'Create a user or import them via CSV below.'
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03]">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Code / Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {users.map((u) => (
                <tr key={u.id} className="transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{u.fullName}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">{u.email}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">{u.role}</td>
                  <td className="px-6 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {u.student
                      ? `${u.student.studentCode} · ${u.student.gradeLevel}${u.student.section ? ` ${u.student.section}` : ''}`
                      : u.teacher
                        ? `${u.teacher.employeeCode}${u.teacher.subject ? ` · ${u.teacher.subject}` : ''}`
                        : '-'}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-black/[0.04] ${
                        u.status === 'ACTIVE'
                          ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                          : u.status === 'ARCHIVED'
                            ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                            : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {u.status !== 'ARCHIVED' && (
                        <button
                          onClick={() => handleResetPassword(u)}
                          disabled={resetting === u.id}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          {resetting === u.id ? 'Resetting…' : 'Reset Password'}
                        </button>
                      )}
                      {u.status !== 'ARCHIVED' && (
                        <button
                          onClick={() => handleArchive(u.id)}
                          disabled={archiving === u.id}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-colors duration-150 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-60 dark:border-red-500/30 dark:bg-gray-900 dark:hover:bg-red-500/10"
                        >
                          {archiving === u.id ? 'Archiving…' : 'Archive'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CSV import */}
      <div className="mt-10 rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-5 sm:p-6">
        <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">CSV Bulk Import</h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Header row required:{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono dark:bg-gray-800">fullName,email,role,password,gradeLevel,section,subject</code>.
          Rows with errors are skipped and reported; valid rows are imported.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleCsvFile}
          className="mb-3 block w-full cursor-pointer text-sm text-gray-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-700 hover:file:bg-primary-100 dark:text-gray-400"
        />
        <textarea
          rows={5}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="fullName,email,role,password,gradeLevel,section,subject"
          className={`${inputStyles} font-mono`}
        />
        <button
          onClick={handleImport}
          disabled={importing || !csvText.trim()}
          className={`${buttonPrimary} mt-3`}
        >
          {importing && <Spinner />}
          {importing ? 'Importing…' : 'Import Users'}
        </button>

        {importResult && (
          <div
            className={`mt-4 rounded-xl border p-4 ${
              importResult.errorCount > 0
                ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'
                : 'border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10'
            }`}
          >
            <p className={`text-sm font-medium ${importResult.errorCount > 0 ? 'text-red-800 dark:text-red-300' : 'text-green-800 dark:text-green-300'}`}>
              Import {importResult.status.toLowerCase()} — {importResult.successCount} created,{' '}
              {importResult.errorCount} failed out of {importResult.totalRows} rows.
            </p>
            {importResult.errors.length > 0 && (
              <ul className="mt-2 space-y-1">
                {importResult.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-600 dark:text-red-400">
                    Row {e.rowNumber}
                    {e.email ? ` (${e.email})` : ''}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}