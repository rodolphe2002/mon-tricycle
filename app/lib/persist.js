"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function safeGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function usePersistentState(key, initialValue) {
  // SSR-safe: first render matches the server (initialValue), persisted
  // value is loaded after mount to avoid hydration mismatches.
  const [state, setState] = useState(initialValue);
  const stateRef = useRef(initialValue);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null && raw !== undefined) {
        const v = JSON.parse(raw);
        stateRef.current = v;
        setState(v);
      }
    } catch {}
  }, [key]);

  // The setter writes to localStorage synchronously: callers often navigate
  // away right after updating (e.g. trip selection -> /commander), and a
  // passive useEffect write can be skipped when the page unmounts.
  const set = useCallback((v) => {
    const next = typeof v === "function" ? v(stateRef.current) : v;
    stateRef.current = next;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
    setState(next);
  }, [key]);

  return [state, set];
}
