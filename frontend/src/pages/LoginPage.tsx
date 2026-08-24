import { useState, FormEvent } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { inputStyles, labelStyles, Spinner } from '../components/ui';

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
    <div className="relative hidden overflow-hidden bg-brand lg:flex lg:w-1/2 xl:w-[55%]">
      {/* Decorative glows */}
      <div
        className="absolute -left-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-blue-400/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-40 -right-24 h-[36rem] w-[36rem] rounded-full bg-indigo-400/25 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute right-24 top-16 h-48 w-48 rounded-full border border-white/15"
        aria-hidden="true"
      />

      <div className="relative flex flex-col justify-between p-12 xl:p-16">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-inset ring-white/25 backdrop-blur">
            <CapIcon />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-white">Smart Education</span>
        </div>

        <div className="max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-white xl:text-5xl">
            Learning,
            <br />
            connected — for every classroom.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-blue-100">
            Courses, assignments, quizzes, attendance, and a full library — one portal for
            students, teachers, and administrators in Ethiopian high schools.
          </p>
          <ul className="mt-9 space-y-3.5">
            {[
              'Role-based dashboards for admins, teachers & students',
              'Quizzes and assignments with instant grading',
              'Library borrowing and school-wide announcements',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm font-medium text-blue-50">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-inset ring-white/20">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-blue-200">© {new Date().getFullYear()} Smart Education System</p>
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
    <div className="flex min-h-screen">
      <BrandPanel />

      <div className="relative flex flex-1 flex-col justify-center overflow-hidden bg-gray-50 px-4 py-12 dark:bg-gray-950 sm:px-6 lg:px-16 xl:px-24">
        {/* Soft brand glow behind the form */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 right-0 h-80 w-80 rounded-full bg-primary-500/10 blur-3xl dark:bg-primary-500/20"
        />

        <div className="relative mx-auto w-full max-w-md">
          {/* Compact brand for mobile / tablet */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white shadow-glow">
              <CapIcon />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">
              Smart Education
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-2.5 text-sm text-gray-500 dark:text-gray-400">
            Sign in to access your school portal.
          </p>

          <form
            className="mt-8 space-y-5 rounded-2xl border border-gray-200/70 bg-white p-6 shadow-card sm:p-8 dark:border-gray-800 dark:bg-gray-900"
            onSubmit={handleSubmit}
          >
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
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

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary-600/25 transition-all duration-150 hover:shadow-xl hover:shadow-primary-600/30 hover:brightness-110 disabled:pointer-events-none disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              {submitting && <Spinner />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-4 text-xs leading-relaxed text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <p className="mb-1 font-semibold text-gray-700 dark:text-gray-300">Demo accounts (seeded, dev only)</p>
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
