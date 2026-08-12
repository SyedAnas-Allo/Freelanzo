import Link from "next/link";
import { cn } from "@/lib/utils";

const tones = {
  amber: {
    card: "bg-amber-50 text-amber-950",
    icon: "text-amber-500",
    arrow: "text-amber-400",
  },
  sky: {
    card: "bg-sky-50 text-sky-950",
    icon: "text-sky-500",
    arrow: "text-sky-400",
  },
  emerald: {
    card: "bg-emerald-50 text-emerald-950",
    icon: "text-emerald-500",
    arrow: "text-emerald-400",
  },
} as const;

export type QuickActionTone = keyof typeof tones;

export function QuickActionCard({
  href,
  title,
  subtitle,
  icon,
  tone,
  className,
}: {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: QuickActionTone;
  className?: string;
}) {
  const palette = tones[tone];

  return (
    <Link
      href={href}
      className={cn(
        "relative flex gap-1 rounded-lg px-2.5 py-2 transition-opacity active:opacity-90",
        palette.card,
        className,
      )}
    >
      <span className={cn("[&_svg]:size-6", palette.icon)}>{icon}</span>
      <div className="min-w-0 pr-3 whitespace-nowrap">
        <p className="text-[16px] font-bold leading-tight tracking-tight">
          {title}
        </p>
        <p className="mt-0.5 text-[12px] font-medium leading-tight text-current/55">
          {subtitle}
        </p>
      </div>
    </Link>
  );
}
