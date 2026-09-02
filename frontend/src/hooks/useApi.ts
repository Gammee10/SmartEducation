import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiError } from '../utils/apiError';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => void;
}

/**
 * Small fetch wrapper for page-level data loading: owns the loading/error
 * state, extracts API error messages consistently, and aborts the request
 * on unmount to avoid setState-after-unmount warnings.
 *
 * @param fetcher receives an AbortSignal and returns the data
 * @param deps    re-fetch when these change (like a useCallback dep array)
 */
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: unknown[] = []): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');
    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active && !controller.signal.aborted) setError(getApiError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  return { data, loading, error, reload };
}
