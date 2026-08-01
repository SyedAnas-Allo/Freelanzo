import Link from "next/link";
import { cn } from "@/lib/utils";

export function ApplicantFilterTabs({
  jobId,
  activeTab,
  tabs,
}: {
  jobId: string;
  activeTab: string;
  tabs: readonly (readonly [string, string, number])[];
}) {
  return (
    <nav
      aria-label="Filter applicants"
      className="flex gap-1.5 overflow-x-auto hide-scrollbar"
    >
      {tabs.map(([key, label, count]) => {
        const active = activeTab === key;
        return (
          <Link
            key={key}
            href={`/business/jobs/${jobId}/applicants?tab=${key}`}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground ring-1 ring-border/70",
            )}
          >
            {label}
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[10px] font-extrabold",
                active
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
