"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { cn } from "@/lib/utils";

/**
 * Contained app scrollport with weighted Lenis physics.
 * Feels closer to native lists: slower finger travel, shorter fling, fixed chrome.
 */
export function AppScrollPort({
  children,
  className,
  disabled = false,
  resetKey,
}: {
  children: ReactNode;
  className?: string;
  /** When true (e.g. chat), skip Lenis and let nested panes own scroll. */
  disabled?: boolean;
  /** Reset to top when this changes (usually pathname). */
  resetKey?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content || disabled) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) return;

    const lenis = new Lenis({
      wrapper,
      content,
      eventsTarget: wrapper,
      autoRaf: true,
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      syncTouch: true,
      // Heavier / slower than default browser fling.
      lerp: 0.085,
      wheelMultiplier: 0.62,
      touchMultiplier: 0.68,
      syncTouchLerp: 0.055,
      touchInertiaExponent: 2.15,
      allowNestedScroll: true,
      overscroll: false,
      stopInertiaOnNavigate: true,
      respectReducedMotion: true,
      prevent: (node) => {
        if (!(node instanceof Element)) return false;
        return Boolean(
          node.closest(
            '[data-lenis-prevent], [data-no-pull-refresh], [role="dialog"], .leaflet-container, input, textarea, select, [contenteditable="true"]',
          ),
        );
      },
    });

    wrapper.setAttribute("data-lenis-active", "true");

    return () => {
      wrapper.removeAttribute("data-lenis-active");
      lenis.destroy();
    };
  }, [disabled]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.scrollTop = 0;
  }, [resetKey, disabled]);

  return (
    <div
      ref={wrapperRef}
      data-app-scroll
      className={cn(
        "app-scrollport min-h-0 flex-1",
        disabled ? "flex flex-col overflow-hidden" : "overflow-y-auto overscroll-y-contain",
        className,
      )}
    >
      <div
        ref={contentRef}
        className={cn(disabled && "flex min-h-0 flex-1 flex-col")}
      >
        {children}
      </div>
    </div>
  );
}
