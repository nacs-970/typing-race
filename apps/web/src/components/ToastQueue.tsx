import React from "react";
import { useToastStore, dismissToast, type ToastItem } from "../store/toast.ts";

export function ToastQueue(): React.ReactElement {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) {
    return <div className="toast-queue-empty fixed top-4 right-4 z-50 pointer-events-none" />;
  }

  return (
    <div
      className="toast-queue fixed top-4 right-4 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full font-mono"
      data-testid="toast-queue"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}): React.ReactElement {
  const borderAndAccentClass = {
    error: "toast-error",
    warning: "toast-warning",
    success: "toast-success",
    info: "toast-info",
  }[toast.type];

  const icon = {
    error: "❌",
    warning: "⚠️",
    success: "✓",
    info: "ℹ️",
  }[toast.type];

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden rounded-lg p-3.5 bg-[var(--color-bg-base)]/95 border shadow-2xl backdrop-blur-md transition-all duration-300 ${borderAndAccentClass}`}
      data-testid={`toast-${toast.type}`}
      data-toast-id={toast.id}
      role="alert"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="text-base select-none">{icon}</span>
          <div>
            <h5 className="font-bold text-sm m-0 leading-tight">{toast.title}</h5>
            {toast.body && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1 m-0 leading-relaxed">
                {toast.body}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          aria-label="Dismiss notification"
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] transition-colors p-1 rounded hover:bg-[var(--color-bg-surface-hover)]"
          onClick={onDismiss}
        >
          ✕
        </button>
      </div>

      {toast.showProgress && toast.durationMs && (
        <div className="w-full h-1 bg-[var(--color-bg-surface)] rounded-full overflow-hidden mt-2.5">
          <div
            className="h-full bg-current rounded-full animate-[shrink_linear_forwards]"
            style={{
              animationDuration: `${toast.durationMs}ms`,
            }}
          />
        </div>
      )}
    </div>
  );
}
