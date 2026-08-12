"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter as useNextRouter } from "next/navigation";
// nextjs-toploader depends on nprogress; no @types in this repo.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const NProgress = require("nprogress") as {
  start: () => void;
  done: () => void;
};

type AppRouter = ReturnType<typeof useNextRouter>;

/**
 * Drop-in useRouter that triggers the global top loader on push/replace.
 * Prefer this over next/navigation for any in-app redirects.
 *
 * Do NOT re-export nextjs-toploader/app's useRouter: it spreads Next's router
 * into a fresh object every render. Listing that value in effect / useCallback
 * deps re-fires fetches forever (jobs list, notifications, profile, etc.).
 *
 * This wrapper keeps a referentially stable router via refs.
 */
export function useRouter(): AppRouter {
  const router = useNextRouter();
  const pathname = usePathname();
  const routerRef = useRef(router);
  const pathnameRef = useRef(pathname);
  routerRef.current = router;
  pathnameRef.current = pathname;

  useEffect(() => {
    NProgress.done();
  }, [pathname]);

  const push = useCallback<AppRouter["push"]>((href, options) => {
    if (href !== pathnameRef.current) NProgress.start();
    routerRef.current.push(href, options);
  }, []);

  const replace = useCallback<AppRouter["replace"]>((href, options) => {
    if (href !== pathnameRef.current) NProgress.start();
    routerRef.current.replace(href, options);
  }, []);

  const prefetch = useCallback<AppRouter["prefetch"]>((href, options) => {
    routerRef.current.prefetch(href, options);
  }, []);

  const back = useCallback<AppRouter["back"]>(() => {
    routerRef.current.back();
  }, []);

  const forward = useCallback<AppRouter["forward"]>(() => {
    routerRef.current.forward();
  }, []);

  const refresh = useCallback<AppRouter["refresh"]>(() => {
    routerRef.current.refresh();
  }, []);

  return useMemo(
    () => ({ push, replace, prefetch, back, forward, refresh }),
    [push, replace, prefetch, back, forward, refresh],
  );
}
