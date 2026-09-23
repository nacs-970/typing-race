import React from "react";
import { useToastStore, dismissToast, pauseToast, resumeToast, type ToastItem } from "../store/toast.ts";

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

  const tagText = {
    error: "ERR",
    warning: "NOTE",
    success: "OK",
    info: "INFO",
  }[toast.type];

  const tagColorClass = {
    error: "text-[var(--color-status-danger)]",
    warning: "text-[var(--color-status-warning)]",
    success: "text-[var(--color-accent-green)]",
    info: "text-[var(--color-text-muted)]",
  }[toast.type];

  return (
    <div
      className={`pointer-events-auto relative p-3 bg-[var(--color-bg-surface)] border border-[var(--color-border-muted)] border-l-2 rounded-none transition-all duration-300 font-mono text-[var(--color-text-bright)] ${borderAndAccentClass}`}
      data-testid={`toast-${toast.type}`}
      data-toast-id={toast.id}
      role="alert"
      onMouseEnter={() => pauseToast(toast.id)}
      onMouseLeave={() => resumeToast(toast.id)}
      onFocus={() => pauseToast(toast.id)}
      onBlur={() => resumeToast(toast.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-grow">
          <span className={`label font-bold pt-0.5 select-none ${tagColorClass}`}>
            {tagText}
          </span>
          <div className="flex-grow">
            <p className="font-mono font-bold text-sm m-0 leading-tight text-[var(--color-text-bright)]">
              {toast.title}
            </p>
            {toast.body && (
              <p className="font-mono text-[13px] text-[var(--color-text-muted)] mt-1 m-0 leading-relaxed">
                {toast.body}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          aria-label="Dismiss notification"
          className="font-mono text-[13px] bg-transparent border-0 p-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] cursor-pointer leading-none"
          onClick={onDismiss}
        >
          ×
        </button>
      </div>

      {toast.showProgress && toast.durationMs && (
        <div className="w-full h-[1px] bg-[var(--color-border-muted)] overflow-hidden mt-2.5">
          <div
            className="h-full bg-[var(--color-text-bright)] animate-[shrink_linear_forwards]"
            style={{
              animationDuration: `${toast.durationMs}ms`,
            }}
          />
        </div>
      )}
    </div>
  );
}
