import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertOnlineForMutation,
  classifyAppError,
  clearNativeOnlineFlag,
  defaultMessageForCategory,
  isBrowserOffline,
  isNativeNetworkBridgeActive,
  isRetryableAppError,
  offlineAppError,
  readNativeOnlineFlag,
  setNativeOnlineFlag,
  withTransientRetry,
} from "@/lib/app-errors";

/** Pretend the browser reports a connectivity state, then restore it. */
function withNavigatorOnline(online: boolean, run: () => void) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: online },
    configurable: true,
    writable: true,
  });
  try {
    run();
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete (globalThis as { navigator?: unknown }).navigator;
  }
}

describe("classifyAppError", () => {
  it("maps offline option and navigator-offline style network text", () => {
    const offline = classifyAppError(new Error("Failed to fetch"), {
      offline: true,
    });
    assert.equal(offline.category, "offline");
    assert.equal(offline.retryable, true);
    assert.match(offline.message, /offline/i);
  });

  it("maps network and timeout failures without leaking internals", () => {
    const network = classifyAppError(new Error("Failed to fetch"));
    assert.equal(network.category, "network");
    assert.equal(network.retryable, true);

    const timeout = classifyAppError(new Error("Request timed out"));
    assert.equal(timeout.category, "timeout");
    assert.equal(timeout.retryable, true);
  });

  it("maps auth failures to sign-in messaging", () => {
    const auth = classifyAppError(new Error("Not authenticated"));
    assert.equal(auth.category, "auth");
    assert.equal(auth.retryable, false);
    assert.equal(auth.action?.href, "/login");
    assert.match(auth.message, /sign in/i);
  });

  it("maps eligibility via APPLICATION_ELIGIBILITY prefix", () => {
    const eligibility = classifyAppError(
      new Error("APPLICATION_ELIGIBILITY: You must be 18 or older to apply"),
    );
    assert.equal(eligibility.category, "eligibility");
    assert.equal(eligibility.retryable, false);
    assert.match(eligibility.message, /18 or older/i);
  });

  it("maps overlap / duplicate conflicts", () => {
    const overlap = classifyAppError(
      new Error("Application overlaps another application"),
    );
    assert.equal(overlap.category, "conflict");
    assert.match(overlap.message, /overlapping gig/i);

    const duplicate = classifyAppError({
      message: "duplicate key value",
      code: "23505",
    });
    assert.equal(duplicate.category, "conflict");
    assert.equal(duplicate.retryable, false);
  });

  it("maps permission and rate-limit failures", () => {
    const permission = classifyAppError(
      new Error("Only the business owner can update this gig"),
    );
    assert.equal(permission.category, "permission");
    assert.equal(permission.retryable, false);

    const rate = classifyAppError(
      new Error("You can only send feedback once every 24 hours"),
    );
    assert.equal(rate.category, "rate_limit");
    assert.match(rate.message, /24 hours/);
  });

  it("maps storage and device ops", () => {
    const storage = classifyAppError(new Error("Upload failed"), {
      op: "upload",
    });
    assert.equal(storage.category, "storage");
    assert.equal(storage.retryable, true);

    const camera = classifyAppError(new Error("NotAllowedError"), {
      op: "camera",
    });
    assert.equal(camera.category, "device");
  });

  it("does not treat PKCE auth storage errors as file uploads", () => {
    const pkce = classifyAppError(
      new Error(
        "PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared.",
      ),
    );
    assert.equal(pkce.category, "auth");
    assert.match(pkce.message, /sign-in/i);
    assert.doesNotMatch(pkce.message, /upload/i);

    const coded = classifyAppError({
      message: "PKCE code verifier not found in storage",
      code: "pkce_code_verifier_not_found",
    });
    assert.equal(coded.category, "auth");
    assert.equal(coded.retryable, true);
  });

  it("never surfaces raw Postgres exception text", () => {
    const raw = classifyAppError(
      new Error(
        'ERROR: relation "foo" does not exist DETAIL: schema cache miss',
      ),
    );
    assert.equal(raw.category, "unknown");
    assert.equal(raw.message, defaultMessageForCategory("unknown"));
    assert.ok(raw.raw?.includes("relation"));
  });

  it("maps geocode network failures to location copy", () => {
    const geo = classifyAppError(new Error("Failed to fetch"), {
      op: "geocode",
    });
    assert.equal(geo.category, "network");
    assert.match(geo.message, /location lookup/i);
  });
});

describe("retry helpers", () => {
  it("marks network/offline/timeout retryable and auth not", () => {
    assert.equal(isRetryableAppError("network"), true);
    assert.equal(isRetryableAppError("offline"), true);
    assert.equal(isRetryableAppError("auth"), false);
    assert.equal(isRetryableAppError("validation"), false);
  });

  it("retries transient failures once then succeeds", async () => {
    let attempts = 0;
    const value = await withTransientRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("Failed to fetch");
        return "ok";
      },
      { delayMs: 1 },
    );
    assert.equal(value, "ok");
    assert.equal(attempts, 2);
  });

  it("does not retry auth failures", async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        withTransientRetry(async () => {
          attempts += 1;
          throw new Error("Not authenticated");
        }),
      /Not authenticated/,
    );
    assert.equal(attempts, 1);
  });
});

describe("offline mutation guard", () => {
  it("returns offline AppError shape from helper", () => {
    const err = offlineAppError();
    assert.equal(err.category, "offline");
    assert.equal(err.retryable, true);
  });

  it("assertOnlineForMutation returns null when online or SSR", () => {
    // In node test runner navigator may be undefined.
    const result = assertOnlineForMutation();
    assert.equal(result, null);
  });
});

describe("native network bridge", () => {
  it("is inactive until the shell reports a state", () => {
    clearNativeOnlineFlag();
    assert.equal(readNativeOnlineFlag(), null);
    assert.equal(isNativeNetworkBridgeActive(), false);
    assert.equal(assertOnlineForMutation(), null);
  });

  it("blocks mutations while native reports offline", () => {
    setNativeOnlineFlag(false);
    try {
      assert.equal(isNativeNetworkBridgeActive(), true);
      assert.equal(isBrowserOffline(), true);
      assert.equal(assertOnlineForMutation()?.category, "offline");
      assert.equal(classifyAppError(new Error("boom")).category, "offline");
    } finally {
      clearNativeOnlineFlag();
    }
  });

  it("outranks a stale navigator.onLine in both directions", () => {
    withNavigatorOnline(true, () => {
      setNativeOnlineFlag(false);
      assert.equal(isBrowserOffline(), true);
    });
    withNavigatorOnline(false, () => {
      setNativeOnlineFlag(true);
      assert.equal(isBrowserOffline(), false);
      assert.equal(assertOnlineForMutation(), null);
    });
    clearNativeOnlineFlag();
  });

  it("falls back to the browser signal once the flag is cleared", () => {
    withNavigatorOnline(false, () => {
      setNativeOnlineFlag(true);
      clearNativeOnlineFlag();
      assert.equal(isBrowserOffline(), true);
      assert.equal(assertOnlineForMutation()?.category, "offline");
    });
  });
});
