import { cn } from "@/lib/utils";

/** Red circular badge with SOS lettering — used as the emergency icon. */
export function SosBadge({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-red-600 font-extrabold tracking-wide text-white shadow-sm shadow-red-600/35",
        size === "sm" && "size-9 text-[9px]",
        size === "md" && "size-11 text-[11px]",
        size === "lg" && "size-14 text-sm",
        className,
      )}
      aria-hidden
    >
      SOS
    </span>
  );
}
