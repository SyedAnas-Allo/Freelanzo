import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Hierarchical “up” control — always goes to a known parent, never browser history. */
export function PageBack({
  href,
  label = "Back",
  iconOnly = false,
  className,
}: {
  href: string;
  label?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn("-ml-1", className)}
        asChild
      >
        <Link href={href} aria-label={label}>
          <ArrowLeft className="size-5" />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-2 rounded-md", className)}
      asChild
    >
      <Link href={href}>
        <ArrowLeft className="size-4" />
        {label}
      </Link>
    </Button>
  );
}
