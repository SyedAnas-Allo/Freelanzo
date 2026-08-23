import { applyEligibilityErrorMessage } from "@/lib/profile-eligibility";

export type AppErrorCategory =
  | "validation"
  | "auth"
  | "eligibility"
  | "permission"
  | "conflict"
  | "rate_limit"
  | "network"
  | "offline"
  | "timeout"
  | "device"
  | "storage"
  | "unknown";

export type AppErrorAction = {
  label: string;
  href?: string;
};

export type AppError = {
  category: AppErrorCategory;
  message: string;
  retryable: boolean;
  action?: AppErrorAction;
  /** Original error text for logs — never show to users unless mapped. */
  raw?: string;
};

export type ClassifyOptions = {
  /** Hint for domain-specific mapping (apply, attendance upload, etc.). */
  op?: string;
  /** Prefer offline messaging when the device reports no connectivity. */
  offline?: boolean;
};

declare global {
  /**
   * Written by the Expo shell (NetInfo) through injected JS. When present it
   * outranks `navigator.onLine`, which is unreliable inside a WebView.
   */
  var __FREELANZO_NATIVE_ONLINE__: boolean | undefined;
}

type NativeFlagHost = { __FREELANZO_NATIVE_ONLINE__?: unknown };

function nativeFlagHost(): NativeFlagHost | null {
  if (typeof window !== "undefined") return window as NativeFlagHost;
  if (typeof globalThis !== "undefined") return globalThis as NativeFlagHost;
  return null;
}

/** Native connectivity as reported by NetInfo, or null when not in the shell. */
export function readNativeOnlineFlag(): boolean | null {
  const value = nativeFlagHost()?.__FREELANZO_NATIVE_ONLINE__;
  return typeof value === "boolean" ? value : null;
}

export function setNativeOnlineFlag(online: boolean): void {
  const host = nativeFlagHost();
  if (host) host.__FREELANZO_NATIVE_ONLINE__ = online;
}

export function clearNativeOnlineFlag(): void {
  const host = nativeFlagHost();
  if (host) delete host.__FREELANZO_NATIVE_ONLINE__;
}

/** True once the native shell has reported connectivity at least once. */
export function isNativeNetworkBridgeActive(): boolean {
  return readNativeOnlineFlag() !== null;
}

const DEFAULT_MESSAGES: Record<AppErrorCategory, string> = {
  validation: "Please check your details and try again.",
  auth: "Please sign in to continue.",
  eligibility: "You're not eligible for this action right now.",
  permission: "You don't have permission to do that.",
  conflict: "This action can't be completed right now.",
  rate_limit: "Please wait a bit and try again.",
  network: "Connection problem. Check your network and try again.",
  offline: "You're offline. Reconnect, then try again.",
  timeout: "That took too long. Check your connection and try again.",
  device: "Something went wrong with your device. Try again.",
  storage: "Couldn't upload the file. Try again.",
  unknown: "Something went wrong. Try again.",
};

const RETRYABLE: ReadonlySet<AppErrorCategory> = new Set([
  "network",
  "offline",
  "timeout",
  "storage",
  "unknown",
]);

const AUTH_ACTION: AppErrorAction = { label: "Sign in", href: "/login" };

function asMessage(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value instanceof Error) return value.message.trim();
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  ) {
    return ((value as { message: string }).message ?? "").trim();
  }
  return "";
}

function asStatus(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const status = (value as { status?: unknown; statusCode?: unknown }).status
    ?? (value as { statusCode?: unknown }).statusCode;
  return typeof status === "number" ? status : null;
}

function asCode(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const code = (value as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function looksLikeNetworkFailure(message: string, code: string): boolean {
  const lower = message.toLowerCase();
  return (
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower === "load failed" ||
    lower.includes("fetch failed") ||
    lower.includes("network error") ||
    lower.includes("err_internet_disconnected") ||
    lower.includes("err_network_changed")
  );
}

function looksLikeTimeout(message: string, code: string): boolean {
  const lower = message.toLowerCase();
  return (
    code === "ETIMEDOUT" ||
    code === "TimeoutError" ||
    lower.includes("timed out") ||
    lower.includes("timeout") ||
    lower.includes("deadline exceeded")
  );
}

function looksLikeAuth(message: string, code: string, status: number | null): boolean {
  const lower = message.toLowerCase();
  return (
    status === 401 ||
    code === "PGRST301" ||
    lower.includes("not authenticated") ||
    lower.includes("jwt expired") ||
    lower.includes("invalid jwt") ||
    lower.includes("session not found") ||
    lower.includes("please sign in") ||
    lower.includes("auth session missing")
  );
}

function looksLikePermission(
  message: string,
  code: string,
  status: number | null,
): boolean {
  const lower = message.toLowerCase();
  return (
    status === 403 ||
    code === "42501" ||
    lower.includes("permission denied") ||
    lower.includes("row-level security") ||
    lower.includes("only the business owner") ||
    lower.includes("not allowed") ||
    lower.includes("forbidden")
  );
}

function looksLikeConflict(message: string, code: string, status: number | null): boolean {
  const lower = message.toLowerCase();
  return (
    status === 409 ||
    code === "23505" ||
    lower.includes("already exists") ||
    lower.includes("duplicate") ||
    lower.includes("already reported") ||
    lower.includes("overlaps another application") ||
    lower.includes("already accepted another overlapping") ||
    lower.includes("freelancer count cannot be lower") ||
    lower.includes("all openings") ||
    lower.includes("headcount")
  );
}

function looksLikeRateLimit(
  message: string,
  code: string,
  status: number | null,
): boolean {
  const lower = message.toLowerCase();
  return (
    status === 429 ||
    code === "over_request_rate_limit" ||
    lower.includes("once every") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("try again later")
  );
}

function looksLikePkceOrAuthStorage(message: string, code: string): boolean {
  const lower = message.toLowerCase();
  return (
    code === "pkce_code_verifier_not_found" ||
    lower.includes("pkce") ||
    lower.includes("code verifier") ||
    lower.includes("auth code and code verifier")
  );
}

function looksLikeStorage(message: string, op?: string): boolean {
  if (op === "storage" || op === "upload") return true;
  // Supabase PKCE errors say "not found in storage" — that is auth, not file upload.
  if (looksLikePkceOrAuthStorage(message, "")) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("upload") ||
    lower.includes("object not found") ||
    lower.includes("bucket") ||
    // File/object storage only — avoid bare "storage" (matches PKCE copy).
    lower.includes("storage.object") ||
    lower.includes("storage api") ||
    (lower.includes("storage") &&
      (lower.includes("bucket") ||
        lower.includes("object") ||
        lower.includes("upload") ||
        lower.includes("file")))
  );
}

function looksLikeDevice(message: string, op?: string): boolean {
  const lower = message.toLowerCase();
  return (
    op === "camera" ||
    op === "geolocation" ||
    op === "device" ||
    lower.includes("camera") ||
    lower.includes("geolocation") ||
    (lower.includes("permission denied") &&
      (lower.includes("location") || lower.includes("media"))) ||
    lower.includes("notallowederror") ||
    lower.includes("notreadableerror")
  );
}

function mapConflictMessage(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("overlaps another application") ||
    lower.includes("already accepted another overlapping")
  ) {
    return "You've already accepted another overlapping gig. Withdraw it first.";
  }
  if (lower.includes("freelancer count cannot be lower")) {
    return "Can't reduce openings below selected freelancers.";
  }
  if (lower.includes("already reported") || lower.includes("duplicate")) {
    return "You've already done this.";
  }
  return DEFAULT_MESSAGES.conflict;
}

function mapPermissionMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("only upcoming active")) {
    return "Only upcoming active gigs can be changed.";
  }
  return DEFAULT_MESSAGES.permission;
}

function isSafeUserMessage(message: string): boolean {
  if (!message || message.length > 180) return false;
  // Avoid leaking Postgres / PostgREST internals.
  if (/^\s*(ERROR|FATAL|HINT|DETAIL):/i.test(message)) return false;
  if (/relation\s+"?\w+"?\s+does not exist/i.test(message)) return false;
  if (/column\s+"?\w+"?\s+does not exist/i.test(message)) return false;
  if (/violates\s+(unique|foreign key|check)\s+constraint/i.test(message)) {
    return false;
  }
  if (/PGRST\d+/i.test(message) && message.length < 40) return false;
  return true;
}

/**
 * Normalize any thrown value / Supabase error into a safe AppError.
 * Prefer domain mappers (eligibility) and never surface raw DB text by default.
 */
export function classifyAppError(
  error: unknown,
  options: ClassifyOptions = {},
): AppError {
  if (options.offline) {
    return {
      category: "offline",
      message: DEFAULT_MESSAGES.offline,
      retryable: true,
      raw: asMessage(error) || undefined,
    };
  }

  const message = asMessage(error);
  const code = asCode(error);
  const status = asStatus(error);
  const lower = message.toLowerCase();

  if (isBrowserOffline()) {
    return {
      category: "offline",
      message: DEFAULT_MESSAGES.offline,
      retryable: true,
      raw: message || undefined,
    };
  }

  const eligibility = message ? applyEligibilityErrorMessage(message) : null;
  if (eligibility) {
    return {
      category: "eligibility",
      message: eligibility,
      retryable: false,
      raw: message,
    };
  }

  if (looksLikeTimeout(message, code) || status === 408 || status === 504) {
    return {
      category: "timeout",
      message: DEFAULT_MESSAGES.timeout,
      retryable: true,
      raw: message || undefined,
    };
  }

  if (
    looksLikeNetworkFailure(message, code) ||
    (status != null && status >= 500) ||
    status === 0
  ) {
    return {
      category: "network",
      message:
        lower.includes("location") || options.op === "geocode"
          ? "Location lookup is temporarily unavailable."
          : DEFAULT_MESSAGES.network,
      retryable: true,
      raw: message || undefined,
    };
  }

  if (
    looksLikeAuth(message, code, status) ||
    looksLikePkceOrAuthStorage(message, code)
  ) {
    return {
      category: "auth",
      message: looksLikePkceOrAuthStorage(message, code)
        ? "Sign-in didn’t finish. Please try again."
        : DEFAULT_MESSAGES.auth,
      retryable: looksLikePkceOrAuthStorage(message, code),
      action: AUTH_ACTION,
      raw: message || undefined,
    };
  }

  if (looksLikeRateLimit(message, code, status)) {
    return {
      category: "rate_limit",
      message: isSafeUserMessage(message)
        ? message
        : DEFAULT_MESSAGES.rate_limit,
      retryable: false,
      raw: message || undefined,
    };
  }

  if (looksLikeConflict(message, code, status)) {
    return {
      category: "conflict",
      message: mapConflictMessage(message),
      retryable: false,
      raw: message || undefined,
    };
  }

  if (looksLikePermission(message, code, status)) {
    return {
      category: "permission",
      message: mapPermissionMessage(message),
      retryable: false,
      raw: message || undefined,
    };
  }

  if (looksLikeStorage(message, options.op)) {
    return {
      category: "storage",
      message: DEFAULT_MESSAGES.storage,
      retryable: true,
      raw: message || undefined,
    };
  }

  if (looksLikeDevice(message, options.op)) {
    return {
      category: "device",
      message: isSafeUserMessage(message)
        ? message
        : DEFAULT_MESSAGES.device,
      retryable: true,
      raw: message || undefined,
    };
  }

  // Client validation strings we already author — pass through.
  if (
    options.op === "validation" ||
    (message &&
      isSafeUserMessage(message) &&
      !/[A-Z_]{6,}/.test(message) &&
      !lower.includes("postgres") &&
      !lower.includes("postgrest"))
  ) {
    // Prefer unknown + safe fallback for unmapped DB text; keep short UX copy.
    if (
      message.includes("Gig title is required") ||
      message.includes("required") && message.length < 80
    ) {
      return {
        category: "validation",
        message,
        retryable: false,
        raw: message,
      };
    }
  }

  if (message && isSafeUserMessage(message) && !/^[0-9A-Z_]{8,}$/.test(message)) {
    // Short human-authored server messages (e.g. feedback cooldown) stay.
    const looksTechnical =
      lower.includes("null value") ||
      lower.includes("syntax error") ||
      lower.includes("function ") ||
      lower.includes("operator does not exist") ||
      /\b(sql|rpc|schema)\b/i.test(message);

    if (!looksTechnical) {
      return {
        category: "unknown",
        message,
        retryable: RETRYABLE.has("unknown"),
        raw: message,
      };
    }
  }

  return {
    category: "unknown",
    message: DEFAULT_MESSAGES.unknown,
    retryable: true,
    raw: message || undefined,
  };
}

export function isRetryableAppError(error: AppError | AppErrorCategory): boolean {
  const category = typeof error === "string" ? error : error.category;
  return RETRYABLE.has(category);
}

export function defaultMessageForCategory(category: AppErrorCategory): string {
  return DEFAULT_MESSAGES[category];
}

export function offlineAppError(): AppError {
  return {
    category: "offline",
    message: DEFAULT_MESSAGES.offline,
    retryable: true,
  };
}

/**
 * One bounded retry for idempotent reads / transient network failures.
 * Never retries auth, validation, permission, conflict, or rate-limit.
 */
export async function withTransientRetry<T>(
  run: () => Promise<T>,
  options: {
    retries?: number;
    delayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {},
): Promise<T> {
  const retries = options.retries ?? 1;
  const delayMs = options.delayMs ?? 500;
  const shouldRetry =
    options.shouldRetry ??
    ((error: unknown) => {
      const classified = classifyAppError(error);
      return (
        classified.category === "network" ||
        classified.category === "timeout" ||
        classified.category === "unknown"
      ) && classified.retryable;
    });

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

/**
 * True when the device reports no connectivity. The native NetInfo bridge wins
 * when present; otherwise fall back to the browser's own signal.
 */
export function isBrowserOffline(): boolean {
  const native = readNativeOnlineFlag();
  if (native !== null) return !native;
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.onLine === "boolean" && !navigator.onLine) return true;
  return false;
}

export function assertOnlineForMutation(): AppError | null {
  if (isBrowserOffline()) return offlineAppError();
  return null;
}
