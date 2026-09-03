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

  if (toast.durationMs && toast.durationMs > 0) {
    const timer = setTimeout(() => {
      dismissToast(id);
    }, toast.durationMs);
    timerMap.set(id, timer);
  }

  return id;
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
