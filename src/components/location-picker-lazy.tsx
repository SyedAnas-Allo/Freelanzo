"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const LocationPickerInner = dynamic(
  () =>
    import("@/components/location-picker").then((m) => m.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border bg-muted/40 text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

export function LocationPickerLazy(
  props: ComponentProps<typeof LocationPickerInner>,
) {
  return <LocationPickerInner {...props} />;
}
