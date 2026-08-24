// Lightweight motion primitives shared across pages: animated counting
// numbers and SVG progress rings. Every animation is skipped when the user
// has prefers-reduced-motion enabled.
import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * Eases a number from 0 to `target` over `durationMs` using requestAnimationFrame.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const frameRef = useRef<number>();

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, durationMs]);

  return value;
}

export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = '',
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const v = useCountUp(value);
  return (
    <>
      {v.toFixed(decimals)}
      {suffix}
    </>
  );
}

/** Picks a semantic color for a completion percentage. Static Tailwind classes only. */
export function ringTone(percent: number): string {
  if (percent >= 80) return 'text-emerald-500';
  if (percent >= 60) return 'text-primary-600';
  if (percent >= 40) return 'text-amber-500';
  return 'text-red-500';
}

export function ProgressRing({
  percent,
  size = 64,
  strokeWidth = 7,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDrawn(true);
      return;
    }
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const offset = drawn ? circumference * (1 - clamped / 100) : circumference;

  return (
    <div className="relative inline-flex items-center justify-center" role="img" aria-label={`${Math.round(clamped)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-gray-100 dark:stroke-gray-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-[stroke-dashoffset] duration-700 ease-out ${ringTone(clamped)}`}
        />
      </svg>
      <span className="absolute text-xs font-bold text-gray-900 dark:text-gray-100">{Math.round(clamped)}%</span>
    </div>
  );
}