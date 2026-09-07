import { usePageTitle } from '../hooks/usePageTitle';
import { FormEvent, useState } from 'react';
import api from '../api/client';
import { buttonPrimary, inputStyles, PageHeader, Banner, Spinner } from '../components/ui';
import { getApiError } from '../utils/apiError';

// O4: inline strength guidance so weak passwords fail here, not at the API.
function passwordStrength(pw: string): { label: string; score: number } {
  if (!pw) return { label: '', score: 0 };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  return { label: labels[score], score };
}

export default function SettingsPage() {
  usePageTitle('Settings');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // O4: shoulder-surfing guard for shared computers.
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const strength = passwordStrength(newPassword);
  const matchState =
    !confirmPassword || !newPassword ? null : confirmPassword === newPassword ? 'match' : 'mismatch';

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
      setError(getApiError(err, 'Failed to change password'));
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
        {/* L2: every label is paired with its input via htmlFor/id. */}
        <div>
          <label
            htmlFor="settings-current-password"
            className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
          >
            Current password *
          </label>
          <input
            id="settings-current-password"
            type={showPasswords ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputStyles}
          />
        </div>
        <div>
          <label
            htmlFor="settings-new-password"
            className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
          >
            New password * <span className="font-normal">(at least 8 characters)</span>
          </label>
          <input
            id="settings-new-password"
            type={showPasswords ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputStyles}
            aria-describedby="settings-password-strength"
          />
          {newPassword && (
            <div id="settings-password-strength" className="mt-1.5 flex items-center gap-2" role="status">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <span
                  className={`block h-full rounded-full transition-all ${
                    strength.score <= 1 ? 'bg-red-500' : strength.score <= 3 ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${(strength.score / 5) * 100}%` }}
                />
              </span>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{strength.label}</span>
            </div>
          )}
        </div>
        <div>
          <label
            htmlFor="settings-confirm-password"
            className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
          >
            Confirm new password *
          </label>
          <input
            id="settings-confirm-password"
            type={showPasswords ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputStyles}
            aria-describedby={matchState ? 'settings-password-match' : undefined}
          />
          {matchState && (
            <p
              id="settings-password-match"
              role="status"
              className={`mt-1 text-xs font-medium ${
                matchState === 'match' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {matchState === 'match' ? 'Passwords match' : 'Passwords do not match'}
            </p>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showPasswords}
            onChange={(e) => setShowPasswords(e.target.checked)}
            className="h-4 w-4 accent-primary-600"
          />
          Show passwords
        </label>
        <button type="submit" disabled={saving} className={buttonPrimary}>
          {saving && <Spinner />}
          {saving ? 'Saving…' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}
