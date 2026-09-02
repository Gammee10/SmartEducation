import { usePageTitle } from '../hooks/usePageTitle';
import { FormEvent, useState } from 'react';
import api from '../api/client';
import { buttonPrimary, inputStyles, PageHeader, Banner, Spinner } from '../components/ui';

export default function SettingsPage() {
  usePageTitle('Settings');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      setMessage('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account security."
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

      <form
        onSubmit={handleSubmit}
        className="max-w-md space-y-4 rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.03] p-5 sm:p-6"
      >
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Change password</h2>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Current password *</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputStyles}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            New password * <span className="font-normal">(at least 8 characters)</span>
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputStyles}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Confirm new password *</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputStyles}
          />
        </div>
        <button type="submit" disabled={saving} className={buttonPrimary}>
          {saving && <Spinner />}
          {saving ? 'Saving…' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}
