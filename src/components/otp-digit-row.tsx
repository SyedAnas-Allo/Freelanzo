"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ClipboardEvent,
} from "react";
import { cn } from "@/lib/utils";

export function OtpDigitDisplay({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const digits = code.padEnd(6, " ").slice(0, 6).split("");
  return (
    <div className={cn("flex justify-center gap-2", className)}>
      {digits.map((d, i) => (
        <span
          key={i}
          className="flex size-11 items-center justify-center rounded-lg border border-border/80 bg-white text-lg font-extrabold tracking-wide text-foreground shadow-sm"
        >
          {d.trim() || "·"}
        </span>
      ))}
    </div>
  );
}

export function OtpCountdown({ expiresAt }: { expiresAt: string | Date }) {
  const [left, setLeft] = useState(() => msLeft(expiresAt));

  useEffect(() => {
    const id = setInterval(() => setLeft(msLeft(expiresAt)), 250);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (left <= 0) {
    return (
      <p className="text-center text-xs font-semibold text-destructive">
        OTP expired — generate a new one
      </p>
    );
  }

  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <p className="text-center text-xs font-semibold text-destructive">
      OTP expires in {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </p>
  );
}

function msLeft(expiresAt: string | Date) {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

export function OtpDigitInput({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  function setAt(index: number, char: string) {
    const next = digits.map((d, i) => (i === index ? char : d.trim() || ""));
    const joined = next.join("").replace(/\s/g, "").slice(0, 6);
    onChange(joined);
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]?.trim()) {
        setAt(i, "");
      } else if (i > 0) {
        setAt(i - 1, "");
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      refs.current[i + 1]?.focus();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(text);
    const focusIdx = Math.min(text.length, 5);
    refs.current[focusIdx]?.focus();
  }

  return (
    <div className={cn("flex justify-center gap-2", className)}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digits[i]?.trim() ?? ""}
          aria-label={`Digit ${i + 1}`}
          className="size-11 rounded-lg border border-border/80 bg-white text-center text-lg font-extrabold shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          onChange={(e) => {
            const char = e.target.value.replace(/\D/g, "").slice(-1);
            setAt(i, char);
            if (char && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
