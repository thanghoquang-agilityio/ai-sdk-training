"use client";

import { useEffect, useState } from "react";

export type ToastVariant = "success" | "error" | "info";

type ToastProps = {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
  onDismiss: () => void;
};

const ICON_BY_VARIANT: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

const STYLE_BY_VARIANT: Record<ToastVariant, string> = {
  success:
    "border-emerald-500/30 bg-emerald-500/12 text-emerald-300 shadow-[0_8px_32px_rgba(16,185,129,0.18)]",
  error:
    "border-red-500/30 bg-red-500/12 text-red-300 shadow-[0_8px_32px_rgba(239,68,68,0.18)]",
  info:
    "border-sky-500/30 bg-sky-500/12 text-sky-300 shadow-[0_8px_32px_rgba(14,165,233,0.18)]",
};

const ICON_BG_BY_VARIANT: Record<ToastVariant, string> = {
  success: "bg-emerald-500/20 text-emerald-400",
  error: "bg-red-500/20 text-red-400",
  info: "bg-sky-500/20 text-sky-400",
};

const DEFAULT_DURATION_MS = 3500;

export function Toast({
  message,
  variant = "success",
  durationMs = DEFAULT_DURATION_MS,
  onDismiss,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation on next frame.
    const enterFrame = requestAnimationFrame(() => setIsVisible(true));

    const dismissTimer = setTimeout(() => {
      setIsLeaving(true);
      // Wait for exit animation before unmounting.
      setTimeout(onDismiss, 280);
    }, durationMs);

    return () => {
      cancelAnimationFrame(enterFrame);
      clearTimeout(dismissTimer);
    };
  }, [durationMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "fixed right-5 top-5 z-[9999] flex max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-xl transition-all duration-280",
        STYLE_BY_VARIANT[variant],
        isVisible && !isLeaving
          ? "translate-y-0 opacity-100"
          : "-translate-y-3 opacity-0",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          ICON_BG_BY_VARIANT[variant],
        ].join(" ")}
      >
        {ICON_BY_VARIANT[variant]}
      </span>
      <span className="font-dm-sans text-sm font-medium leading-snug">
        {message}
      </span>
      <button
        type="button"
        className="ml-auto shrink-0 rounded-lg p-1 opacity-60 transition hover:opacity-100"
        onClick={() => {
          setIsLeaving(true);
          setTimeout(onDismiss, 280);
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
