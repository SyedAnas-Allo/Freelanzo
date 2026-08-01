"use client";

import { Suspense } from "react";
import NativeAuthPage from "./native-auth-client";

export default function NativeAuthRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
          Finishing sign-in…
        </div>
      }
    >
      <NativeAuthPage />
    </Suspense>
  );
}
