"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Delays a changing value. For search inputs, where you want to render on every
 * keystroke but only fetch once the typing stops.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Tracks a media query.
 *
 * Returns false on the server and on the first client render, because the
 * server cannot know the viewport. Branching layout on this without accounting
 * for that produces a hydration mismatch -- prefer a CSS breakpoint when the
 * answer is purely visual, and keep this for behaviour that CSS cannot express.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * State backed by localStorage.
 *
 * Reads in an effect rather than during the initial render, for the same
 * hydration reason as above. Also listens for `storage`, so two tabs of the
 * same app do not drift apart.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Unparseable or unavailable; the initial value stands.
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue === null) return;
      try {
        setValue(JSON.parse(e.newValue) as T);
      } catch {
        // Another tab wrote something we cannot read; keep what we have.
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage full or blocked; the value still applies for this session.
      }
    },
    [key],
  );

  return { value, setValue: update, loaded } as const;
}

export type AsyncState<T> =
  | { status: "idle"; data: undefined; error: undefined }
  | { status: "loading"; data: undefined; error: undefined }
  | { status: "success"; data: T; error: undefined }
  | { status: "error"; data: undefined; error: Error };

/**
 * Runs an async function and tracks its state.
 *
 * The run counter is what makes this safe: if a second call starts before the
 * first resolves, the first one's result is discarded. Without it, a slow
 * earlier request can land after a fast later one and overwrite fresh data with
 * stale — the classic race in every hand-rolled fetch hook.
 */
export function useAsync<T, Args extends unknown[]>(fn: (...args: Args) => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({
    status: "idle",
    data: undefined,
    error: undefined,
  });

  const runId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args: Args): Promise<T | undefined> => {
      const id = ++runId.current;
      setState({ status: "loading", data: undefined, error: undefined });
      try {
        const data = await fn(...args);
        if (id !== runId.current || !mounted.current) return undefined;
        setState({ status: "success", data, error: undefined });
        return data;
      } catch (error) {
        if (id !== runId.current || !mounted.current) return undefined;
        setState({
          status: "error",
          data: undefined,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        return undefined;
      }
    },
    [fn],
  );

  const reset = useCallback(() => {
    runId.current++;
    setState({ status: "idle", data: undefined, error: undefined });
  }, []);

  return {
    ...state,
    run,
    reset,
    isLoading: state.status === "loading",
  } as const;
}
