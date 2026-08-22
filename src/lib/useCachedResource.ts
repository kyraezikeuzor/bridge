"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser-side resource cache that survives client-side navigation.
 *
 * The store is module-level (not React state) so cached data outlives a page
 * component unmounting — switching pages reads straight from memory instead of
 * refetching. Mirrors the server-side caches in lib/*Cache.ts. A full browser
 * reload clears it; users get fresh data via each page's Refresh button.
 */
const store = new Map<string, unknown>();

export function clearResourceCache(key?: string) {
  if (key) store.delete(key);
  else store.clear();
}

type Options<T> = {
  /** Skip fetching until true (e.g. while the session is still loading). */
  enabled?: boolean;
  onError?: (error: unknown) => void;
  /** Called after a successful fetch — e.g. to reset paging. */
  onSuccess?: (data: T) => void;
};

export function useCachedResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: Options<T>
) {
  const enabled = options?.enabled ?? true;

  const [data, setDataState] = useState<T | undefined>(
    () => store.get(key) as T | undefined
  );
  const [loading, setLoading] = useState(enabled && !store.has(key));
  const [refreshing, setRefreshing] = useState(false);

  // Hold the latest callbacks without making them effect dependencies, so an
  // inline fetcher/handler doesn't retrigger the load on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onErrorRef = useRef(options?.onError);
  onErrorRef.current = options?.onError;
  const onSuccessRef = useRef(options?.onSuccess);
  onSuccessRef.current = options?.onSuccess;

  /** Update both React state and the persistent cache. */
  const setData = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setDataState((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (p: T) => T)(prev as T)
            : updater;
        store.set(key, next);
        return next;
      });
    },
    [key]
  );

  const run = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      try {
        const next = await fetcherRef.current();
        store.set(key, next);
        setDataState(next);
        onSuccessRef.current?.(next);
      } catch (error) {
        onErrorRef.current?.(error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [key]
  );

  useEffect(() => {
    if (!enabled) return;
    if (store.has(key)) {
      // Cache hit — render immediately, no network round trip.
      setDataState(store.get(key) as T);
      setLoading(false);
      return;
    }
    void run("initial");
  }, [key, enabled, run]);

  const refresh = useCallback(() => run("refresh"), [run]);

  return { data, setData, loading, refreshing, refresh };
}
