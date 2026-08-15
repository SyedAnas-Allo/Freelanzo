import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const metaPillVariants = cva(
  "inline-flex h-6 max-w-full items-center truncate rounded-md px-2.5 text-xs font-medium",
  {
    variants: {
      tone: {
        violet: "bg-violet-100 text-violet-700",
        sky: "bg-sky-100 text-sky-700",
        emerald: "bg-emerald-100 text-emerald-700",
        amber: "bg-amber-100 text-amber-800",
        rose: "bg-rose-100 text-rose-700",
        muted: "bg-secondary/80 text-secondary-foreground",
      },
    },
    defaultVariants: {
      tone: "muted",
    },
  },
);

export type MetaPillTone = NonNullable<
  VariantProps<typeof metaPillVariants>["tone"]
>;

export function MetaPill({
  children,
  tone,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
} & VariantProps<typeof metaPillVariants> &
  React.ComponentPropsWithoutRef<"span">) {
  return (
    <span className={cn(metaPillVariants({ tone }), className)} {...props}>
      {children}
    </span>
  );
}
