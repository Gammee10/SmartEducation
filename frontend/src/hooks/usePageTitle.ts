import { useEffect } from 'react';

const APP_NAME = 'Smart Education';

/** Set the browser tab title per route. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
}
