"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const THRESHOLD = 72;
const MAX_PULL = 120;
const RESISTANCE = 0.48;

function canPullFrom(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  let node: Element | null = target;
  while (node && node !== document.body) {
    if (node instanceof HTMLElement) {
      const style = window.getComputedStyle(node);
      const oy = style.overflowY;
      const scrollable =
        (oy === "auto" || oy === "scroll" || oy === "overlay") &&
        node.scrollHeight > node.clientHeight + 1;
      if (scrollable && node.scrollTop > 0) return false;
      // Don’t fight maps / sheets / dialogs.
      if (
        node.getAttribute("data-no-pull-refresh") != null ||
        node.classList.contains("leaflet-container") ||
        node.getAttribute("role") === "dialog"
      ) {
        return false;
      }
    }
    node = node.parentElement;
  }
  return window.scrollY <= 0 && document.documentElement.scrollTop <= 0;
}

function PullIndicator({
  pull,
  refreshing,
}: {
  pull: number;
  refreshing: boolean;
}) {
  const progress = Math.min(1, pull / THRESHOLD);
  const size = 36;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * progress;
  const ready = progress >= 1;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center"
      style={{
        height: Math.max(pull, refreshing ? 56 : 0),
        opacity: pull > 4 || refreshing ? 1 : 0,
        transition: refreshing ? "height 180ms ease" : undefined,
      }}
      aria-hidden
    >
      <div
        className={cn(
          "mt-2 flex size-10 items-center justify-center rounded-full border border-primary/15 bg-card/95 shadow-[0_8px_24px_rgba(142,48,255,0.18)] backdrop-blur-md",
          refreshing && "ptr-spin-soft",
        )}
        style={{
          transform: `scale(${0.82 + progress * 0.18})`,
        }}
      >
        {refreshing ? (
          <span className="ptr-spinner size-5 rounded-full border-2 border-primary/25 border-t-primary" />
        ) : (
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="color-mix(in oklch, var(--primary) 18%, transparent)"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
              className={cn(ready && "drop-shadow-[0_0_6px_rgba(142,48,255,0.45)]")}
            />
          </svg>
        )}
      </div>
    </div>
  );
}

/**
 * Touch pull-to-refresh for the app shell (WebView + mobile browsers).
 * At top of page only; skips nested scrollers, maps, and dialogs.
 */
export function PullToRefresh({
  children,
  onRefresh,
  className,
  disabled = false,
}: {
  children: ReactNode;
  onRefresh: () => void | Promise<void>;
  className?: string;
  disabled?: boolean;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  const setPullBoth = useCallback((value: number) => {
    pullRef.current = value;
    setPull(value);
  }, []);

  useEffect(() => {
    if (disabled) return;

    function onTouchStart(e: TouchEvent) {
      if (refreshingRef.current) return;
      if (e.touches.length !== 1) return;
      if (!canPullFrom(e.target)) {
        pulling.current = false;
        return;
      }
      pulling.current = true;
      startY.current = e.touches[0]!.clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling.current || refreshingRef.current) return;
      const y = e.touches[0]!.clientY;
      const raw = y - startY.current;
      if (raw <= 0) {
        if (pullRef.current > 0) {
          setPullBoth(0);
          setDragging(false);
        }
        return;
      }
      if (!canPullFrom(e.target) && pullRef.current === 0) {
        pulling.current = false;
        return;
      }
      const next = Math.min(MAX_PULL, raw * RESISTANCE);
      setDragging(true);
      setPullBoth(next);
      if (next > 8 && e.cancelable) e.preventDefault();
    }

    async function finish() {
      if (!pulling.current) return;
      pulling.current = false;
      setDragging(false);
      const distance = pullRef.current;
      if (distance < THRESHOLD || refreshingRef.current) {
        setPullBoth(0);
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);
      setPullBoth(THRESHOLD);
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(10);
        }
        await onRefresh();
      } finally {
        const hold = reducedMotion.current ? 0 : 280;
        window.setTimeout(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          setPullBoth(0);
        }, hold);
      }
    }

    function onTouchEnd() {
      void finish();
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, onRefresh, setPullBoth]);

  const shift = refreshing ? Math.max(pull, 56) : pull;

  return (
    <div className={cn("relative", className)}>
      <PullIndicator pull={shift} refreshing={refreshing} />
      <div
        style={{
          transform: shift > 0 ? `translate3d(0, ${shift}px, 0)` : undefined,
          transition:
            dragging || refreshing
              ? undefined
              : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
