// Shared interactive design system: every screen follows the same spacing,
// radii, shadows, typography, motion and state patterns. Components are
// keyboard-accessible, dual-themed, and respect prefers-reduced-motion
// via the global CSS layer.
import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';

/* ---------------------------------- Icons --------------------------------- */

const ICON_PATHS: Record<string, string> = {
  book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  users:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  cap: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z',
  chart:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  clipboard:
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  inbox:
    'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
  warning:
    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  calendar:
    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  bell: 'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  pin: 'M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  plus: 'M12 4v16m8-8H4',
  spark: 'M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5l-2 2m-7 7l-2 2m11 0l-2-2m-7-7l-2-2M16 12a4 4 0 11-8 0 4 4 0 018 0zM12 2l1.8 4.7L18.5 8l-4.7 1.3L12 14l-1.8-4.7L5.5 8l4.7-1.3L12 2z',
  arrow: 'M13 6l6 6-6 6M5 12h14',
  grid: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  list: 'M4 6h16M4 12h16M4 18h16',
  x: 'M6 18L18 6M6 6l12 12',
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  'eye-off':
    'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.948 9.948 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21',
  copy: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  command: 'M9 9V7a2 2 0 012-2h2a2 2 0 012 2v2m0 6v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2m-4-4H5a2 2 0 00-2 2v2a2 2 0 002 2h2m8-8h2a2 2 0 012 2v2a2 2 0 01-2 2h-2',
  chevron: 'M19 9l-7 7-7-7',
};

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[name]} />
    </svg>
  );
}

/* --------------------------------- Spinner -------------------------------- */

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/* ------------------------------- Page header ------------------------------ */

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="animate-fade-up mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary-200/70 bg-primary-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300">
            <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {eyebrow}
          </p>
        )}
        <div className="flex items-center gap-3">
          <span className="hidden h-9 w-1.5 rounded-full bg-primary-600 sm:block" aria-hidden="true" />
          <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            {title}
          </h1>
        </div>
        {description && (
          <p className="mt-2 max-w-2xl pl-0 text-sm leading-relaxed text-gray-500 dark:text-gray-400 sm:pl-[1.125rem]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
    </div>
  );
}

/* ---------------------------------- Card ---------------------------------- */

export function Card({
  children,
  className = '',
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-200/70 bg-white shadow-card ring-1 ring-black/[0.02] transition-shadow duration-200 dark:border-gray-800 dark:bg-gray-900 dark:ring-white/[0.06] ${
        hover ? 'card-interactive hover:shadow-card-hover' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:px-6">
      <div className="min-w-0">
        <h2 className="font-display truncate text-base font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</h2>
        {subtitle && <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* --------------------------------- Avatar --------------------------------- */

const AVATAR_SOLIDS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-600',
  'bg-slate-600',
] as const;

export function Avatar({
  name,
  size = 'md',
  className = '',
}: {
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const initials = (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('') || '?';
  let hash = 0;
  for (let i = 0; i < (name ?? '?').length; i++) hash += (name ?? '?').charCodeAt(i);
  const solid = AVATAR_SOLIDS[hash % AVATAR_SOLIDS.length];
  const sizes = {
    xs: 'h-6 w-6 text-[9px]',
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-12 w-12 text-sm',
  } as const;
  return (
    <span
      className={`inline-flex flex-shrink-0 select-none items-center justify-center rounded-full ${solid} font-bold text-white shadow-sm ring-2 ring-white dark:ring-gray-900 ${sizes[size]} ${className}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/* ---------------------------------- Chip ---------------------------------- */

export function Chip({
  children,
  tone = 'gray',
  dot = false,
}: {
  children: ReactNode;
  tone?: 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'sky';
  dot?: boolean;
}) {
  const tones: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    blue: 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-black/[0.04] transition-transform duration-300 hover:scale-[1.03] dark:ring-white/10 ${tones[tone]}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* -------------------------------- Stat card ------------------------------- */

const STAT_SOLIDS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-cyan-600',
  'bg-amber-500',
  'bg-rose-500',
] as const;

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 0,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: IconName;
  tone?: number;
}) {
  const solid = STAT_SOLIDS[Math.abs(tone) % STAT_SOLIDS.length];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-gray-800 dark:bg-gray-900">
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        {icon && (
          <span
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${solid} text-white shadow-sm transition-transform duration-300 group-hover:scale-105`}
          >
            <Icon name={icon} className="h-5 w-5" />
          </span>
        )}
      </div>
      <p className="tnum relative mt-3 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
        {value}
      </p>
      {hint && <p className="relative mt-2 text-xs font-medium text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

/* --------------------------------- Search --------------------------------- */

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  label,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`group relative ${className}`}>
      <Icon
        name="search"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors duration-150 group-focus-within:text-primary-500 dark:text-gray-500"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className="block w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-9 text-sm text-gray-900 shadow-sm transition-all duration-200 placeholder:text-gray-400 hover:border-gray-400 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500 dark:hover:border-gray-600"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700 animate-pop-in dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------ Segmented tabs ----------------------------- */

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel ?? 'Tabs'}
      className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-gray-200/70 bg-gray-100/80 p-1 dark:border-gray-800 dark:bg-gray-900"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`pressable relative flex-shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
              active
                ? 'bg-white text-gray-900 shadow-card dark:bg-gray-800 dark:text-white'
                : 'text-gray-500 hover:bg-white/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100'
            }`}
          >
            {opt.label}
            {typeof opt.count === 'number' && (
              <span
                className={`ml-1.5 inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors duration-200 ${
                  active
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300'
                    : 'bg-gray-200/70 text-gray-500 dark:bg-gray-700/60 dark:text-gray-400'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: T; label: ReactNode; tip?: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200/70 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            data-tip={opt.tip}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`pressable flex items-center justify-center rounded-lg font-semibold transition-colors duration-150 ${
              size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 px-3 text-sm'
            } ${
              active
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------- Progress -------------------------------- */

export function ProgressBar({
  value,
  max = 100,
  className = '',
}: {
  value: number;
  max?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-primary-600 transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ------------------------------- Empty state ------------------------------ */

export function EmptyState({
  title,
  message,
  icon = 'inbox',
  action,
}: {
  title: string;
  message?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
        <span aria-hidden="true" className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-primary-500/15" />
        <Icon name={icon} className="h-8 w-8" />
      </span>
      <p className="mt-5 text-base font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      {message && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* --------------------------------- Banner --------------------------------- */

const BANNER_TONES: Record<'success' | 'error' | 'warning' | 'info', { box: string; icon: string; title: string }> = {
  success: {
    box: 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-emerald-500/10',
    icon: 'text-emerald-600 dark:text-emerald-400',
    title: 'text-emerald-800 dark:text-emerald-300',
  },
  error: {
    box: 'border-red-200 bg-red-50/80 dark:border-red-500/30 dark:bg-red-500/10',
    icon: 'text-red-600 dark:text-red-400',
    title: 'text-red-800 dark:text-red-300',
  },
  warning: {
    box: 'border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10',
    icon: 'text-amber-600 dark:text-amber-400',
    title: 'text-amber-800 dark:text-amber-300',
  },
  info: {
    box: 'border-primary-200 bg-primary-50/80 dark:border-primary-500/30 dark:bg-primary-500/10',
    icon: 'text-primary-600 dark:text-primary-400',
    title: 'text-primary-800 dark:text-primary-300',
  },
};

export function Banner({
  tone = 'info',
  message,
  children,
  dismissible = false,
  onDismiss,
}: {
  tone?: 'success' | 'error' | 'warning' | 'info';
  message: string;
  children?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}) {
  const tones = BANNER_TONES[tone];
  return (
    <div
      role="alert"
      className={`animate-scale-in flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm ${tones.box}`}
    >
      <Icon name={tone === 'error' || tone === 'warning' ? 'warning' : 'check'} className={`mt-0.5 h-5 w-5 flex-shrink-0 ${tones.icon}`} />
      <p className={`flex-1 text-sm font-medium ${tones.title}`}>
        {message}
        {children}
      </p>
      {(dismissible || onDismiss) && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="pressable -mr-1 -mt-0.5 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------- Error state ------------------------------ */

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="animate-scale-in rounded-2xl border border-red-200 bg-red-50/80 px-6 py-12 text-center dark:border-red-500/30 dark:bg-red-500/10">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-500 dark:bg-red-500/20 dark:text-red-400">
        <Icon name="warning" className="h-7 w-7" />
      </span>
      <p className="mt-4 text-base font-semibold text-red-800 dark:text-red-300">Something went wrong</p>
      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${buttonSecondary} mt-5`}>
          Try again
        </button>
      )}
    </div>
  );
}

/* ------------------------------ Loading state ----------------------------- */

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16" role="status" aria-live="polite">
      <span className="relative flex h-12 w-12 items-center justify-center">
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-500/10">
          <Spinner className="h-5 w-5 text-primary-600 dark:text-primary-400" />
        </span>
      </span>
      <span className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}

/* -------------------------------- Skeletons ------------------------------- */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-card dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-11 rounded-xl" />
      </div>
      <Skeleton className="mt-3 h-9 w-16" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4 sm:px-6">
          <Skeleton className="h-10 w-10 flex-shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Buttons --------------------------------- */

const BUTTON_BASE =
  'pressable inline-flex select-none items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 disabled:pointer-events-none disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-offset-2';

export const buttonPrimary = `${BUTTON_BASE} bg-primary-600 text-white shadow-sm hover:-translate-y-px hover:bg-primary-700 hover:shadow-md focus-visible:ring-primary-500 dark:focus-visible:ring-offset-gray-950`;

export const buttonSecondary = `${BUTTON_BASE} border border-gray-300 bg-white text-gray-700 shadow-sm hover:-translate-y-px hover:border-gray-400 hover:bg-gray-50 hover:shadow-card-hover focus-visible:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800 dark:focus-visible:ring-offset-gray-950`;

export const buttonDanger = `${BUTTON_BASE} bg-red-600 text-white shadow-sm hover:-translate-y-px hover:bg-red-700 hover:shadow-md focus-visible:ring-red-500 dark:focus-visible:ring-offset-gray-950`;

export const buttonGhost =
  'pressable inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 transition-all duration-150 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100';

export function LinkButton({
  to,
  children,
  variant = 'primary',
}: {
  to: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Link to={to} className={variant === 'secondary' ? buttonSecondary : buttonPrimary}>
      {children}
    </Link>
  );
}

export function ActionButton({
  children,
  variant = 'primary',
  loading = false,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
}) {
  const cls =
    variant === 'secondary' ? buttonSecondary : variant === 'danger' ? buttonDanger : variant === 'ghost' ? buttonGhost : buttonPrimary;
  return (
    <button type="button" className={cls} disabled={loading || rest.disabled} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/* ------------------------------ Form controls ----------------------------- */

export const inputStyles =
  'block w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-all duration-200 hover:border-gray-400 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder-gray-500 dark:hover:border-gray-600 dark:focus:border-primary-500 dark:disabled:bg-gray-800/50';

export const selectStyles = inputStyles;

export const labelStyles = 'mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300';

export const fieldErrorStyles = 'mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600 animate-fade-in dark:text-red-400';

export const fieldHintStyles = 'mt-1.5 text-xs text-gray-500 dark:text-gray-400';

export function PasswordInput({
  value,
  onChange,
  id = 'password',
  placeholder = '••••••••',
  autoComplete = 'current-password',
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputStyles} pr-11`}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      >
        <Icon name={show ? 'eye-off' : 'eye'} className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      aria-label={label}
      data-tip={copied ? 'Copied!' : label}
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => undefined);
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1400);
      }}
      className={`pressable rounded-lg p-1.5 transition-colors duration-150 ${
        copied
          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200'
      }`}
    >
      <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" />
    </button>
  );
}

/* ---------------------------------- Modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-gray-950/55 backdrop-blur-sm"
      />
      <div
        className={`animate-scale-in relative w-full overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-dropdown dark:border-gray-700 dark:bg-gray-900 ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="font-display text-base font-bold tracking-tight text-gray-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="pressable rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------- Tooltip -------------------------------- */

export function Tooltip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <span data-tip={tip} className="inline-flex">
      {children}
    </span>
  );
}

/* ------------------------------ Dropdown menu ------------------------------ */

export function DropdownMenu({
  trigger,
  items,
  align = 'right',
}: {
  trigger: ReactNode;
  items: { label: string; icon?: IconName; danger?: boolean; onSelect: () => void }[];
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          role="menu"
          className={`animate-scale-in absolute z-50 mt-2 w-52 origin-top overflow-hidden rounded-xl border border-gray-200/70 bg-white p-1.5 shadow-dropdown dark:border-gray-700 dark:bg-gray-900 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
                item.danger
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              {item.icon && <Icon name={item.icon} className="h-4 w-4 opacity-70" />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
