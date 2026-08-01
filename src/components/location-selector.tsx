"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LocationPickerLazy } from "@/components/location-picker-lazy";
import { createClient } from "@/lib/supabase/client";
import {
  defaultLocationValue,
  hasCoordinates,
  type LocationValue,
} from "@/lib/locations";

export function LocationSelector({
  area,
  city,
  lat,
  lng,
  searchRadiusKm,
  compact = false,
}: {
  area: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  searchRadiusKm: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<LocationValue>(
    defaultLocationValue({
      area: area ?? undefined,
      city: city ?? undefined,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      search_radius_km: searchRadiusKm,
    }),
  );
  const locationLabel = [area, city].filter(Boolean).join(", ");

  function resetValue() {
    setValue(
      defaultLocationValue({
        area: area ?? undefined,
        city: city ?? undefined,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        search_radius_km: searchRadiusKm,
      }),
    );
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) resetValue();
  }

  async function save() {
    if (!hasCoordinates(value)) {
      toast.error("Choose your current location or search for an area");
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in again");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        area: value.area,
        city: value.city,
        lat: value.lat,
        lng: value.lng,
        search_radius_km: value.search_radius_km ?? 10,
      })
      .eq("id", user.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Location updated");
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex max-w-[48%] items-center gap-1 rounded-md bg-secondary/80 px-2.5 py-1 text-left"
            : "mb-1.5 flex items-center gap-1.5 text-left"
        }
      >
        <MapPin
          className={
            compact
              ? "size-3.5 shrink-0 text-secondary-foreground"
              : "size-4 shrink-0 text-primary"
          }
        />
        <span
          className={
            compact
              ? "truncate text-xs font-medium text-secondary-foreground"
              : "text-sm"
          }
        >
          {compact ? (
            locationLabel || "Set location"
          ) : (
            <>
              <span className="font-semibold text-foreground">
                {locationLabel || "Set location"}
              </span>
            </>
          )}
        </span>
        <ChevronDown
          className={
            compact
              ? "size-3 shrink-0 text-secondary-foreground/70"
              : "size-3.5 shrink-0 text-muted-foreground"
          }
        />
      </button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-left text-lg font-extrabold">
              Select your location
            </SheetTitle>
            <p className="text-left text-sm font-light text-muted-foreground">
              Drop a pin to see gigs within your search radius.
            </p>
          </SheetHeader>
          <div className="mt-4 px-1 pb-6">
            <LocationPickerLazy value={value} onChange={setValue} />
            <Button
              className="mt-4 h-12 w-full rounded-xl"
              disabled={pending}
              onClick={save}
            >
              {pending ? "Saving…" : "Show gigs near here"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
