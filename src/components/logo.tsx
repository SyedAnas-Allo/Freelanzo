import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
  size = "md",
  markOnly = false,
}: {
  className?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
  /** Show only the F mark */
  markOnly?: boolean;
}) {
  const mark = size === "lg" ? 32 : size === "sm" ? 22 : 26;
  const wordH = size === "lg" ? 16 : size === "sm" ? 12 : 14;
  const wordW = Math.round(wordH * (500 / 79));

  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-1.5", className)}
      aria-label="Freelanzo"
    >
      {/* Brand assets need exact CSS sizing; next/image height:auto inflated the wordmark */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt=""
        width={mark}
        height={mark}
        className="shrink-0 object-contain"
        style={{ width: mark, height: mark }}
      />
      {markOnly ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/freelanzo-wordmark.png"
          alt="Freelanzo"
          width={wordW}
          height={wordH}
          className="shrink-0 object-contain"
          style={{ width: wordW, height: wordH }}
        />
      )}
    </Link>
  );
}
