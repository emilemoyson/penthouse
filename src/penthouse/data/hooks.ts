"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FitnessData, NutritionData, ProfessionalData, SleepData, ZoneDataKey } from "./types";

type Live<T> = { data: T; loading: boolean; error: string | null; refresh: () => Promise<void>; setData: (d: T) => void };

/**
 * Stale-while-revalidate for a zone payload:
 * renders instantly with the server's first paint, then refetches GET /api/penthouse/:zone
 * on an interval, when the tab regains focus, and whenever `refresh()` is called.
 */
export function useLiveData<T>(key: ZoneDataKey, initial: T, { refreshMs = 5 * 60_000, enabled = true } = {}): Live<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    inflight.current?.abort();
    const ac = new AbortController();
    inflight.current = ac;
    setLoading(true);
    try {
      const res = await fetch(`/api/penthouse/${key}`, { signal: ac.signal, cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 401 ? "Signed out" : `HTTP ${res.status}`);
      setData((await res.json()) as T);
      setError(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (inflight.current === ac) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(refresh, refreshMs);
    const onFocus = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [enabled, refresh, refreshMs]);

  return { data, loading, error, refresh, setData };
}

/* One hook per station. Pass the server's initial payload; swap the endpoint inside useLiveData if a zone moves to its own API. */

/** 🛏️ Sleep, deep/REM, recovery. Source: sleep_logs ← POST /api/ingest/sleep */
export const useSleepData = (initial: SleepData) => useLiveData<SleepData>("sleep", initial, { refreshMs: 15 * 60_000 });

/** 🖥️ To-dos and calendar feeds. */
export const useProfessionalData = (initial: ProfessionalData) => useLiveData<ProfessionalData>("professional", initial, { refreshMs: 5 * 60_000 });

/** 🏋️ Weekly frequency, active minutes, muscle split. Source: Training tab (workouts/runs). */
export const useFitnessData = (initial: FitnessData) => useLiveData<FitnessData>("fitness", initial, { refreshMs: 10 * 60_000 });

/** 🍳 Macros, calories vs target, meal log. Source: meals ← kitchen panel / POST /api/ingest/meals */
export const useNutritionData = (initial: NutritionData) => useLiveData<NutritionData>("nutrition", initial, { refreshMs: 10 * 60_000 });
