import useSWR from "swr";
import { api } from "./api";

// Generic fetcher for SWR — uses our axios instance (has auth interceptor)
const fetcher = (url: string) => api.get(url).then(r => r.data);

/** Stale-while-revalidate config: show cached data instantly, revalidate in background */
const SWR_CONFIG = {
  revalidateOnFocus: false,
  dedupingInterval: 30_000, // dedupe identical requests within 30s
  errorRetryCount: 2,
};

// ─── Cached hooks for common data ────────────────────────────────────────────

export function useTasks() {
  return useSWR("/api/tasks", fetcher, { ...SWR_CONFIG, refreshInterval: 60_000 });
}

export function useGoals() {
  return useSWR("/api/goals", fetcher, SWR_CONFIG);
}

export function useCircles() {
  return useSWR("/api/circles", fetcher, SWR_CONFIG);
}

export function useWorks() {
  return useSWR("/api/works", fetcher, SWR_CONFIG);
}

export function useSalah(lat = "24.6877", lng = "46.7219") {
  return useSWR(`/api/salah/today?lat=${lat}&lng=${lng}`, fetcher, {
    ...SWR_CONFIG,
    refreshInterval: 300_000, // refresh every 5min
  });
}

export function usePreferences() {
  return useSWR("/api/users/me/preferences", fetcher, SWR_CONFIG);
}

export function useUsers() {
  return useSWR("/api/users", fetcher, { ...SWR_CONFIG, dedupingInterval: 120_000 });
}

export function useBoards(entityType: string, entityId: string) {
  return useSWR(
    entityId ? `/api/boards?entityType=${entityType}&entityId=${entityId}` : null,
    fetcher,
    SWR_CONFIG,
  );
}
