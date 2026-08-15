export const RADIUS_OPTIONS = [5, 10, 15, 20, 30] as const;

export type FixedSearchRadiusKm = (typeof RADIUS_OPTIONS)[number];
/** `null` means no distance limit ("All"). */
export type SearchRadiusKm = FixedSearchRadiusKm | null;

export type LocationValue = {
  area: string;
  city: string;
  lat: number | null;
  lng: number | null;
  /** `null` means no distance limit ("All"). */
  search_radius_km?: number | null;
};

export function defaultLocationValue(
  partial?: Partial<LocationValue>,
): LocationValue {
  return {
    area: partial?.area ?? "",
    city: partial?.city ?? "",
    lat: partial?.lat ?? null,
    lng: partial?.lng ?? null,
    search_radius_km:
      partial && "search_radius_km" in partial
        ? (partial.search_radius_km ?? null)
        : null,
  };
}

export function isUnlimitedRadius(
  radius: number | null | undefined,
): radius is null | undefined {
  return radius == null;
}

export function formatSearchRadius(
  radius: number | null | undefined,
): string {
  return isUnlimitedRadius(radius) ? "All" : `${radius} km`;
}

export function hasCoordinates(
  location: Pick<LocationValue, "lat" | "lng">,
): location is Pick<LocationValue, "lat" | "lng"> & {
  lat: number;
  lng: number;
} {
  return (
    location.lat !== null &&
    location.lng !== null &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng) &&
    location.lat >= -90 &&
    location.lat <= 90 &&
    location.lng >= -180 &&
    location.lng <= 180
  );
}
