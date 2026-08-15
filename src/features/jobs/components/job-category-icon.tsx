import {
  Box,
  Briefcase,
  ConciergeBell,
  HardHat,
  Megaphone,
  Mic2,
  Package,
  Shield,
  ShoppingBag,
  Sparkles,
  SprayCan,
  Trophy,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobCategory } from "@/types/database";

export const jobCategoryIcons: Record<
  JobCategory,
  React.ComponentType<{ className?: string }>
> = {
  hospitality: ConciergeBell,
  event: Sparkles,
  promoter: Megaphone,
  delivery: Truck,
  warehouse: Box,
  security: Shield,
  catering: UtensilsCrossed,
  retail: ShoppingBag,
  corporate: Briefcase,
  sports: Trophy,
  talent: Mic2,
  labour: HardHat,
  cleaning: SprayCan,
  other: Package,
};

export const jobCategoryColors: Record<JobCategory, string> = {
  hospitality: "bg-orange-100 text-orange-700",
  event: "bg-pink-100 text-pink-700",
  promoter: "bg-blue-100 text-blue-700",
  delivery: "bg-cyan-100 text-cyan-700",
  warehouse: "bg-amber-100 text-amber-700",
  security: "bg-slate-200 text-slate-700",
  catering: "bg-rose-100 text-rose-700",
  retail: "bg-violet-100 text-violet-700",
  corporate: "bg-sky-100 text-sky-700",
  sports: "bg-lime-100 text-lime-700",
  talent: "bg-fuchsia-100 text-fuchsia-700",
  labour: "bg-yellow-100 text-yellow-800",
  cleaning: "bg-teal-100 text-teal-700",
  other: "bg-secondary text-primary",
};

export function JobCategoryIcon({
  category,
  className,
  iconClassName,
}: {
  category: JobCategory;
  className?: string;
  iconClassName?: string;
}) {
  const Icon = jobCategoryIcons[category] ?? Package;

  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl",
        jobCategoryColors[category],
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn("size-5", iconClassName)} />
    </span>
  );
}
