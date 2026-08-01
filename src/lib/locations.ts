export const RADIUS_OPTIONS = [5, 10, 15, 20, 30] as const;

export type LocationValue = {
  area: string;
  city: string;
  lat: number | null;
  lng: number | null;
  search_radius_km?: number;
};

export function defaultLocationValue(
  partial?: Partial<LocationValue>,
): LocationValue {
  return {
    area: partial?.area ?? "",
    city: partial?.city ?? "",
    lat: partial?.lat ?? null,
    lng: partial?.lng ?? null,
    search_radius_km: partial?.search_radius_km ?? 10,
  };
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
