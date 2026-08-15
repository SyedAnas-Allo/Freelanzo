"use client";

import { useEffect } from "react";

/**
 * Root failure boundary — must render its own html/body.
 * Keep this self-contained (no app providers) per Next.js error contract.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: "#f4f4f5",
          color: "#18181b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#71717a", marginTop: 8 }}>
            Freelanzo hit an unexpected error. Check your connection and try
            again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              border: 0,
              borderRadius: 12,
              background: "#0f766e",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              padding: "12px 18px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
