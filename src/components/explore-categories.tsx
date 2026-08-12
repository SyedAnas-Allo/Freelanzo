"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, LayoutGrid, Package } from "lucide-react";
import {
  jobCategoryColors,
  jobCategoryIcons,
} from "@/features/jobs/components/job-category-icon";
import { CATEGORIES, cn } from "@/lib/utils";
import type { JobCategory } from "@/types/database";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type CategoryOption = (typeof CATEGORIES)[number];

/** Stable preview order — never reorders on selection. */
const PREVIEW = CATEGORIES.filter((cat) => cat.value !== "all").slice(0, 3);

function categoryIcon(value: CategoryOption["value"]) {
  if (value === "all") return Package;
  return jobCategoryIcons[value as JobCategory] ?? Package;
}

function categoryIconClass(value: CategoryOption["value"]) {
  if (value === "all") return "text-primary";
  return jobCategoryColors[value as JobCategory] ?? "text-primary";
}

function CategoryTile({
  href,
  label,
  icon: Icon,
  iconClass,
  active,
  onClick,
}: {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span
        className={cn(
          "relative flex size-12 items-center justify-center rounded-xl bg-white shadow-sm",
          active && "ring-2 ring-white ring-offset-2 ring-offset-primary",
        )}
      >
        <Icon aria-hidden className={cn("size-6", iconClass)} />
        {active ? (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-white text-primary shadow-sm">
            <Check aria-hidden className="size-2.5" strokeWidth={3} />
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "line-clamp-2 text-center text-[11px] leading-tight text-primary-foreground",
          active ? "font-bold" : "font-medium opacity-90",
        )}
      >
        {label}
      </span>
    </>
  );

  const className =
    "flex min-w-0 flex-1 flex-col items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={href!}
      aria-current={active ? "true" : undefined}
      className={className}
    >
      {inner}
    </Link>
  );
}

export function ExploreCategories({
  activeCategory,
}: {
  activeCategory?: string;
}) {
  const [open, setOpen] = useState(false);
  const active = activeCategory ?? "all";
  const activeInPreview = PREVIEW.some((cat) => cat.value === active);
  const selectedOutside =
    !activeInPreview && active !== "all"
      ? CATEGORIES.find((cat) => cat.value === active)
      : null;

  return (
    <>
      <section className="overflow-hidden rounded-xl bg-primary px-4 pb-4 pt-3.5 shadow-md shadow-primary/20">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-primary-foreground">
            Explore Categories
          </h2>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-0.5 text-sm font-medium text-primary-foreground/90 hover:text-primary-foreground"
          >
            View all
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex gap-2">
          {PREVIEW.map((cat) => (
            <CategoryTile
              key={cat.value}
              href={`/freelancer?category=${cat.value}`}
              label={cat.label}
              icon={categoryIcon(cat.value)}
              iconClass={categoryIconClass(cat.value)}
              active={cat.value === active}
            />
          ))}
          {selectedOutside ? (
            <CategoryTile
              label={selectedOutside.label}
              icon={categoryIcon(selectedOutside.value)}
              iconClass={categoryIconClass(selectedOutside.value)}
              active
              onClick={() => setOpen(true)}
            />
          ) : (
            <CategoryTile
              label="More"
              icon={LayoutGrid}
              iconClass="text-sky-600"
              onClick={() => setOpen(true)}
            />
          )}
        </div>
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-3xl"
        >
          <SheetHeader>
            <SheetTitle className="text-left text-lg font-extrabold">
              All Categories
            </SheetTitle>
          </SheetHeader>
          <div className="mt-3 grid grid-cols-3 gap-2 px-4 pb-6">
            {CATEGORIES.map((cat) => {
              const Icon = categoryIcon(cat.value);
              const isActive = active === cat.value;
              return (
                <Link
                  key={cat.value}
                  href={`/freelancer?category=${cat.value}`}
                  onClick={() => setOpen(false)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-center transition-colors",
                    isActive
                      ? "bg-secondary ring-2 ring-primary"
                      : "bg-muted/40 hover:bg-muted/70",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : cat.value === "all"
                          ? "bg-card text-secondary-foreground shadow-sm"
                          : jobCategoryColors[cat.value as JobCategory],
                    )}
                  >
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <span
                    className={cn(
                      "line-clamp-2 text-[11px] font-semibold leading-tight",
                      isActive ? "text-primary" : "text-foreground",
                    )}
                  >
                    {cat.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
