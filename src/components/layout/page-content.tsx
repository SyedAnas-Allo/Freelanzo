import { cn } from "@/lib/utils";

export function PageContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("space-y-4 px-4 py-4", className)}>{children}</main>
  );
}
