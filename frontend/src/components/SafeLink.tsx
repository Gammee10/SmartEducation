// H11: scheme-allowlisted outbound link. Stored teacher content and
// submission URLs render through here so a `javascript:` (or data:) URL
// can never execute in the app origin - it renders as an inert note.
import type { ReactNode } from 'react';
import { isSafeHttpUrl } from '../utils/safeUrl';

export default function SafeLink({
  href,
  className,
  children,
}: {
  href?: string | null;
  className?: string;
  children: ReactNode;
}) {
  if (!href) return null;
  if (isSafeHttpUrl(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return <span className="text-xs italic text-gray-400 dark:text-gray-500">Blocked unsafe link</span>;
}
