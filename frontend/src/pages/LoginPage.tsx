import { useState, FormEvent } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { buttonPrimary, inputStyles, labelStyles } from '../components/ui';

function CapIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3L2 8l10 5 10-5-10-5zM4.5 10.5V15c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-4.5M20 9v6"
      />
    </svg>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-primary-700 lg:flex lg:w-1/2 xl:w-[55%]">
      {/* Decorative shapes */}
      <div
        className="absolute -left-24 -top-24 h-96 w-96 rounded-full border border-primary-500/40"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full border border-primary-500/40"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-24 -left-20 h-72 w-72 rounded-full bg-primary-600/50 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col justify-between p-12 xl:p-16">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-inset ring-white/20">
            <CapIcon />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">Smart Education</span>
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
            Learning, connected — for every classroom.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-100">
            Courses, assignments, quizzes, attendance, and a full library — one portal for
            students, teachers, and administrators in Ethiopian high schools.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              'Role-based dashboards for admins, teachers & students',
              'Quizzes and assignments with instant grading',
              'Library borrowing and school-wide announcements',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-primary-50">
                <svg
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-primary-200">
          © {new Date().getFullYear()} Smart Education System
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Only follow same-origin relative redirects to avoid open redirects.
  const requestedRedirect = searchParams.get('redirect') || '/';
  const redirectTo =
    requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//') ? requestedRedirect : '/';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      try {
        sessionStorage.removeItem('postLoginRedirect');
      } catch {
        // ignore storage errors
      }
      navigate(redirectTo);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      <BrandPanel />

      <div className="flex flex-1 flex-col justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          {/* Compact brand for mobile / tablet */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white shadow-card">
              <CapIcon />
            </span>
            <span className="text-lg font-bold tracking-tight text-gray-900">Smart Education</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-gray-500">Sign in to access your school portal.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <svg
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className={labelStyles}>
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputStyles}
                placeholder="you@school.edu"
              />
            </div>

            <div>
              <label htmlFor="password" className={labelStyles}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputStyles}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" disabled={submitting} className={`${buttonPrimary} w-full py-2.5`}>
              {submitting && (
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-500">
              <p className="mb-1 font-semibold text-gray-700">Demo accounts (seeded, dev only)</p>
              <p>admin@school.edu / Password123!</p>
              <p>teacher@school.edu / Password123!</p>
              <p>student@school.edu / Password123!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}