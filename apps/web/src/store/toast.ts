import { create } from "zustand";

export interface ToastItem {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  body?: string;
  durationMs?: number;
  showProgress?: boolean;
  progressTotalMs?: number;
}

export interface ToastState {
  toasts: ToastItem[];
}

export const useToastStore = create<ToastState>(() => ({
  toasts: [],
}));

const timerMap = new Map<string, ReturnType<typeof setTimeout>>();

export function addToast(toast: Omit<ToastItem, "id">): string {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `toast-${Date.now()}-${Math.random()}`;

  const item: ToastItem = { ...toast, id };

  useToastStore.setState((s) => {
    // Deduplicate identical title and body if already active
    const exists = s.toasts.some(
      (t) => t.title === item.title && t.body === item.body,
    );
    if (exists) {
      return s;
    }
    // Cap at 5 toasts max (evicting oldest from front)
    const next = [...s.toasts, item];
    if (next.length > 5) {
      const removed = next.shift();
      if (removed) {
        const t = timerMap.get(removed.id);
        if (t) clearTimeout(t);
        timerMap.delete(removed.id);
      }
    }
    return { toasts: next };
  });

  startTimer(id, toast.durationMs);

  return id;
}

function startTimer(id: string, durationMs: number | undefined): void {
  if (!durationMs || durationMs <= 0) return;
  const timer = setTimeout(() => {
    dismissToast(id);
  }, durationMs);
  timerMap.set(id, timer);
}

/** Stops auto-dismiss while the toast is hovered or focused (WCAG 2.2.1). */
export function pauseToast(id: string): void {
  const timer = timerMap.get(id);
  if (timer) clearTimeout(timer);
  timerMap.delete(id);
}

/** Restarts the full duration when hover/focus leaves the toast. */
export function resumeToast(id: string): void {
  if (timerMap.has(id)) return;
  const toast = useToastStore.getState().toasts.find((t) => t.id === id);
  if (toast) startTimer(id, toast.durationMs);
}

export function dismissToast(id: string): void {
  const timer = timerMap.get(id);
  if (timer) {
    clearTimeout(timer);
    timerMap.delete(id);
  }
  useToastStore.setState((s) => ({
    toasts: s.toasts.filter((t) => t.id !== id),
  }));
}

export function clearToasts(): void {
  for (const timer of timerMap.values()) {
    clearTimeout(timer);
  }
  timerMap.clear();
  useToastStore.setState({ toasts: [] });
}
