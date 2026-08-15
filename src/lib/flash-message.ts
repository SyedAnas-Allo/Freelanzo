"use client";

import { toast } from "sonner";
import {
  assertOnlineForMutation,
  classifyAppError,
  type AppError,
  type ClassifyOptions,
} from "@/lib/app-errors";

const recentKeys = new Map<string, number>();
const DEDUPE_MS = 2_500;

function dedupeKey(kind: string, message: string) {
  return `${kind}:${message}`;
}

function shouldShow(kind: string, message: string): boolean {
  const key = dedupeKey(kind, message);
  const now = Date.now();
  const prev = recentKeys.get(key);
  if (prev && now - prev < DEDUPE_MS) return false;
  recentKeys.set(key, now);
  // Bound map growth.
  if (recentKeys.size > 40) {
    for (const [k, at] of recentKeys) {
      if (now - at > DEDUPE_MS * 4) recentKeys.delete(k);
    }
  }
  return true;
}

export type FlashAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

export type FlashOptions = {
  description?: string;
  duration?: number;
  id?: string;
  action?: FlashAction;
};

function resolveAction(action?: FlashAction) {
  if (!action) return undefined;
  return {
    label: action.label,
    onClick: () => {
      if (action.onClick) {
        action.onClick();
        return;
      }
      if (action.href && typeof window !== "undefined") {
        window.location.assign(action.href);
      }
    },
  };
}

export function flashSuccess(message: string, options: FlashOptions = {}) {
  if (!shouldShow("success", message)) return;
  toast.success(message, {
    id: options.id,
    description: options.description,
    duration: options.duration,
    action: resolveAction(options.action),
  });
}

export function flashInfo(message: string, options: FlashOptions = {}) {
  if (!shouldShow("info", message)) return;
  toast.message(message, {
    id: options.id,
    description: options.description,
    duration: options.duration,
    action: resolveAction(options.action),
  });
}

export function flashWarning(message: string, options: FlashOptions = {}) {
  if (!shouldShow("warning", message)) return;
  toast.warning(message, {
    id: options.id,
    description: options.description,
    duration: options.duration ?? 6_000,
    action: resolveAction(options.action),
  });
}

export function flashError(message: string, options: FlashOptions = {}) {
  if (!shouldShow("error", message)) return;
  toast.error(message, {
    id: options.id,
    description: options.description,
    duration: options.duration ?? 6_500,
    action: resolveAction(options.action),
  });
}

export function flashValidation(message: string) {
  flashError(message, { duration: 4_500 });
}

/**
 * Present a classified AppError as a flash card.
 * Offline/auth use stable ids so they don't stack.
 */
export function presentAppError(
  error: AppError | unknown,
  options: ClassifyOptions & {
    onRetry?: () => void;
    duration?: number;
  } = {},
) {
  const classified =
    error &&
    typeof error === "object" &&
    "category" in error &&
    "message" in error &&
    "retryable" in error
      ? (error as AppError)
      : classifyAppError(error, options);

  if (typeof console !== "undefined" && classified.raw) {
    console.warn("[app-error]", classified.category, classified.raw);
  }

  const id =
    classified.category === "offline"
      ? "freelanzo-offline"
      : classified.category === "auth"
        ? "freelanzo-auth"
        : undefined;

  let action: FlashAction | undefined;
  if (classified.action) {
    action = {
      label: classified.action.label,
      href: classified.action.href,
    };
  } else if (classified.retryable && options.onRetry) {
    action = { label: "Retry", onClick: options.onRetry };
  }

  const duration =
    options.duration ??
    (classified.category === "offline" || classified.category === "auth"
      ? 10_000
      : 6_500);

  flashError(classified.message, { id, duration, action });
  return classified;
}

export function flashBackOnline() {
  toast.dismiss("freelanzo-offline");
  flashSuccess("Back online", {
    id: "freelanzo-back-online",
    duration: 2_500,
  });
}

/**
 * Returns false (and flashes) when offline so callers can abort writes.
 * Drafts should already be preserved by session storage — do not queue.
 */
export function ensureOnlineForMutation(): boolean {
  const offline = assertOnlineForMutation();
  if (!offline) return true;
  presentAppError(offline);
  return false;
}
