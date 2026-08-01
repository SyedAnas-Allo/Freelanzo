import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

/** Soft profile-shaped placeholder used while client pages load. */
export function PageLoading({
  label = "Loading…",
  variant = "page",
}: {
  label?: string;
  variant?: "page" | "profile" | "form";
}) {
  return (
    <div
      className="flex flex-1 flex-col px-4 py-5"
      aria-busy="true"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>

      {variant === "profile" ? (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Bone className="size-16 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <Bone className="h-5 w-2/3" />
              <Bone className="h-3.5 w-2/5" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Bone className="h-16 rounded-xl" />
            <Bone className="h-16 rounded-xl" />
            <Bone className="h-16 rounded-xl" />
          </div>
          <Bone className="h-28 rounded-2xl" />
          <div className="space-y-2">
            <Bone className="h-12 rounded-xl" />
            <Bone className="h-12 rounded-xl" />
            <Bone className="h-12 rounded-xl" />
            <Bone className="h-12 rounded-xl" />
          </div>
        </div>
      ) : variant === "form" ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <Bone className="h-7 w-1/2" />
            <Bone className="h-3.5 w-3/4" />
          </div>
          <div className="flex justify-center py-2">
            <Bone className="size-20 rounded-full" />
          </div>
          <div className="space-y-3">
            <Bone className="h-11 w-full rounded-xl" />
            <Bone className="h-11 w-full rounded-xl" />
            <Bone className="h-11 w-full rounded-xl" />
            <Bone className="h-24 w-full rounded-xl" />
          </div>
          <Bone className="mt-2 h-12 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Bone className="h-7 w-[42%]" />
            <Bone className="h-3.5 w-[68%]" />
          </div>
          <Bone className="h-28 rounded-2xl" />
          <Bone className="h-24 rounded-2xl" />
          <Bone className="h-24 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Bone className="h-20 rounded-xl" />
            <Bone className="h-20 rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
