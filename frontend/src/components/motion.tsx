// Interactive motion primitives: count-ups, progress rings, scroll reveals,
// 3D tilt cards, sparklines and animated bars. All animations respect
// prefers-reduced-motion. No external dependencies.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type MouseEvent } from 'react';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/* ------------------------------- useInView -------------------------------- */

export function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.12) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* --------------------------------- Reveal --------------------------------- */

export function Reveal({
  children,
  delay = 0,
  y = 18,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  const { ref, visible } = useInView<HTMLDivElement>();
  const style = {
    '--reveal-delay': `${delay}ms`,
    transform: visible ? undefined : `translateY(${y}px) scale(0.99)`,
    opacity: visible ? undefined : 0,
  } as CSSProperties;
  const cls = `reveal ${visible ? 'is-visible' : ''} ${className}`;
  if (Tag === 'li') return <li ref={ref as never} style={style} className={cls}>{children}</li>;
  if (Tag === 'section') return <section ref={ref as never} style={style} className={cls}>{children}</section>;
  if (Tag === 'span') return <span ref={ref as never} style={style} className={cls}>{children}</span>;
  return <div ref={ref} style={style} className={cls}>{children}</div>;
}

/* -------------------------------- TiltCard -------------------------------- */

export function TiltCard({
  children,
  className = '',
  max = 7,
  glow = true,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  glow?: boolean;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [glare, setGlare] = useState({ x: 50, y: 50, active: false });

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion()) return;
    const el = innerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * max * 2;
    const ry = (px - 0.5) * max * 2;
    el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-3px)`;
    setGlare({ x: px * 100, y: py * 100, active: true });
  };

  const onLeave = () => {
    const el = innerRef.current;
    if (el) el.style.transform = 'rotateX(0deg) rotateY(0deg)';
    setGlare((g) => ({ ...g, active: false }));
  };

  return (
    <div className={`tilt-scope ${className}`} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div ref={innerRef} className="tilt-inner relative h-full">
        {children}
        {glow && glare.active && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
            style={{
              background: `radial-gradient(420px circle at ${glare.x}% ${glare.y}%, rgb(37 99 235 / 0.12), transparent 65%)`,
            }}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------- useCountUp ------------------------------- */

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
    <span className="tnum">
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* --------------------------------- Rings ---------------------------------- */

export function ringTone(percent: number): string {
  if (percent >= 80) return 'text-emerald-500';
  if (percent >= 60) return 'text-primary-600 dark:text-primary-400';
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
          stroke="currentColor"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-[stroke-dashoffset] duration-700 ease-out ${ringTone(clamped)}`}
        />
      </svg>
      <span className="tnum absolute text-xs font-bold text-gray-900 dark:text-gray-100">{Math.round(clamped)}%</span>
    </div>
  );
}

/* -------------------------------- Sparkline ------------------------------- */

export function Sparkline({
  points,
  className = 'h-10 w-28',
  strokeWidth = 2,
}: {
  points: number[];
  className?: string;
  strokeWidth?: number;
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setDrawn(true);
      return;
    }
    const t = window.setTimeout(() => setDrawn(true), 80);
    return () => window.clearTimeout(t);
  }, []);

  if (points.length < 2) return null;
  const w = 120;
  const h = 40;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - 4 - ((p - min) / span) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${coords.join(' L')}`;
  const area = `${line} L${w},${h} L0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" opacity={drawn ? 1 : 0} className="transition-opacity duration-700" />
      <path
        d={line}
        fill="none"
        stroke="url(#spark-stroke)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={drawn ? 'none' : `${w * 2} ${w * 2}`}
        strokeDashoffset={drawn ? 0 : w * 2}
        className="transition-all duration-700"
      />
      <defs>
        <linearGradient id="spark-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* -------------------------------- AnimatedBar ------------------------------ */

export function AnimatedBar({
  value,
  max = 100,
  className = '',
  barClassName = 'bg-primary-600',
}: {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
}) {
  const { ref, visible } = useInView<HTMLDivElement>();
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div ref={ref} className={`h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 ${className}`}>
      <div
        className={`h-full rounded-full ${barClassName} transition-[width] duration-500 ease-out`}
        style={{ width: visible ? `${pct}%` : '0%' }}
      />
    </div>
  );
}

/* --------------------------------- useClock -------------------------------- */

export function useClock(updateMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), updateMs);
    return () => window.clearInterval(t);
  }, [updateMs]);
  return now;
}
