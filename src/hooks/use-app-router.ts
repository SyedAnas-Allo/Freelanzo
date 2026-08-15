"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { useRouter as useNextRouter } from "next/navigation";

type AppRouter = ReturnType<typeof useNextRouter>;

/**
 * Drop-in useRouter with a referentially stable return value.
 * Prefer this over next/navigation for any in-app redirects.
 *
 * Next's router identity can change across renders. Listing that value in
 * effect / useCallback deps re-fires fetches forever (jobs list,
 * notifications, profile, etc.). This wrapper keeps a stable object via refs.
 */
export function useRouter(): AppRouter {
  const router = useNextRouter();
  const routerRef = useRef(router);

  useLayoutEffect(() => {
    routerRef.current = router;
  }, [router]);

  const push = useCallback<AppRouter["push"]>((href, options) => {
    routerRef.current.push(href, options);
  }, []);

  const replace = useCallback<AppRouter["replace"]>((href, options) => {
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
