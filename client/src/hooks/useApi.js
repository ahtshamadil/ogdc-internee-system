import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client.js';

/**
 * GET a path, re-fetching whenever it changes.
 *
 * Requests are aborted when the path changes or the component unmounts, so a
 * slow response for an old filter can never overwrite a newer one -- with a
 * filter bar driving six widgets that race is otherwise easy to hit.
 */
export function useApi(path, { skip = false, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [reloadToken, setReloadToken] = useState(0);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (skip || !path) {
      setLoading(false);
      return undefined;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);

    api
      .get(path, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError' || controller.signal.aborted) return;
        setError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, skip, reloadToken, ...deps]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  return { data, error, loading, reload, setData };
}

/** Debounce a fast-changing value (search boxes) before it hits the network. */
export function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
