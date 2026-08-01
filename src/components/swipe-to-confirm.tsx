"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const THUMB = 36;
const END_PAD = 4;
const THRESHOLD = 0.82;

export function SwipeToConfirm({
  label,
  confirmLabel = "Confirmed",
  disabled = false,
  loading = false,
  onConfirm,
  className,
}: {
  label: string;
  confirmLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const maxX = useRef(0);
  const offsetRef = useRef(0);
  const confirmedRef = useRef(false);
  const sawLoading = useRef(false);
  const [offset, setOffset] = useState(0);
  const [max, setMax] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const locked = disabled || loading || confirmed;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    function measure() {
      if (!el) return;
      const next = Math.max(0, el.clientWidth - THUMB - END_PAD * 2);
      maxX.current = next;
      setMax(next);
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (loading) {
      sawLoading.current = true;
      return;
    }
    if (!sawLoading.current || !confirmedRef.current) return;
    sawLoading.current = false;
    confirmedRef.current = false;
    setConfirmed(false);
    offsetRef.current = 0;
    setAnimating(true);
    setOffset(0);
  }, [loading]);

  function setPos(x: number, withTransition: boolean) {
    offsetRef.current = x;
    setAnimating(withTransition);
    setOffset(x);
  }

  function finish(success: boolean) {
    dragging.current = false;
    if (success && !confirmedRef.current) {
      confirmedRef.current = true;
      setConfirmed(true);
      setPos(maxX.current, true);
      onConfirm();
      return;
    }
    setPos(0, true);
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (locked || maxX.current <= 0) return;
    dragging.current = true;
    startX.current = e.clientX - offsetRef.current;
    setAnimating(false);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging.current) return;
    const next = Math.min(
      maxX.current,
      Math.max(0, e.clientX - startX.current),
    );
    setPos(next, false);
  }

  function onPointerUp() {
    if (!dragging.current) return;
    const ratio = maxX.current > 0 ? offsetRef.current / maxX.current : 0;
    finish(ratio >= THRESHOLD);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (locked) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      finish(true);
    }
  }

  const progress = max > 0 ? offset / max : 0;
  const showCheck = confirmed || progress >= THRESHOLD;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-valuetext={loading ? "Verifying" : confirmed ? confirmLabel : label}
      aria-disabled={locked || undefined}
      aria-label={label}
      tabIndex={locked ? -1 : 0}
      onKeyDown={onKeyDown}
      className={cn(
        "relative h-11 touch-none select-none overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.08] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        locked && !loading && "opacity-50",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 bg-primary/20"
        style={{
          width: offset + THUMB / 2 + END_PAD,
          transition: animating
            ? "width 280ms cubic-bezier(0.22, 1, 0.36, 1)"
            : "none",
        }}
      />

      <p
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center gap-1 px-12 text-sm font-bold tracking-tight text-primary transition-opacity duration-200",
          progress > 0.15 && "opacity-0",
        )}
      >
        {loading ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Verifying…
          </>
        ) : confirmed ? (
          confirmLabel
        ) : (
          <>
            {label}
            <span className="ml-0.5 inline-flex animate-swipe-hint text-primary/70">
              <ChevronRight className="size-3.5" />
              <ChevronRight className="-ml-2 size-3.5 opacity-50" />
            </span>
          </>
        )}
      </p>

      <button
        type="button"
        disabled={locked}
        aria-hidden
        tabIndex={-1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          "absolute top-1 left-1 z-10 flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(142,48,255,0.3)]",
          "touch-none disabled:cursor-not-allowed",
        )}
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: animating
            ? "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)"
            : "none",
        }}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : showCheck ? (
          <Check className="size-4 stroke-[2.5]" />
        ) : (
          <ChevronRight className="size-4 stroke-[2.5]" />
        )}
      </button>
    </div>
  );
}
