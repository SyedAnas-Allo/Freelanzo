"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { Crosshair, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { classifyAppError } from "@/lib/app-errors";
import {
  formatSearchRadius,
  hasCoordinates,
  isUnlimitedRadius,
  RADIUS_OPTIONS,
  type LocationValue,
} from "@/lib/locations";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

export type { LocationValue };

const INITIAL_MAP_CENTER: [number, number] = [20.5937, 78.9629];

type GeocodeResult = {
  lat: number;
  lng: number;
  area: string;
  city: string;
  label: string;
};

const pinIcon = L.divIcon({
  className: "freelanzo-pin",
  html: `<div style="
    width:28px;height:28px;border-radius:9999px;
    background:#8E30FF;border:3px solid #fff;
    box-shadow:0 4px 14px rgba(142,48,255,0.45);
    transform:translate(-50%,-50%);
  "></div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

function MapController({
  center,
  radiusKm,
  hasLocation,
}: {
  center: [number, number];
  radiusKm: number | null;
  hasLocation: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    const zoom = !hasLocation
      ? 5
      : isUnlimitedRadius(radiusKm)
        ? 11
        : Math.max(12, 14 - Math.log2(Math.max(radiusKm, 1) / 5));
    map.setView(center, zoom);
  }, [map, center, radiusKm, hasLocation]);
  return null;
}

function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPicker({
  value,
  onChange,
  showRadius = true,
  className,
  height = 220,
}: {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  showRadius?: boolean;
  className?: string;
  height?: number;
}) {
  const selectedLabel = useMemo(
    () => [value.area, value.city].filter(Boolean).join(", "),
    [value.area, value.city],
  );
  const [query, setQuery] = useState(selectedLabel);
  const [syncedLabel, setSyncedLabel] = useState(selectedLabel);
  const [geoLoading, setGeoLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const reverseController = useRef<AbortController | null>(null);
  const searchController = useRef<AbortController | null>(null);
  const radius = value.search_radius_km ?? null;
  const hasLocation = hasCoordinates(value);
  const unlimited = isUnlimitedRadius(radius);
  const center = useMemo(
    () =>
      hasLocation
        ? ([value.lat, value.lng] as [number, number])
        : INITIAL_MAP_CENTER,
    [hasLocation, value.lat, value.lng],
  );

  if (selectedLabel !== syncedLabel) {
    setSyncedLabel(selectedLabel);
    setQuery(selectedLabel);
    setResults([]);
  }

  useEffect(
    () => () => {
      reverseController.current?.abort();
      searchController.current?.abort();
    },
    [],
  );

  function selectLocation(result: GeocodeResult) {
    onChange({
      ...value,
      lat: result.lat,
      lng: result.lng,
      area: result.area,
      city: result.city,
      search_radius_km: showRadius ? radius : value.search_radius_km,
    });
    setQuery([result.area, result.city].filter(Boolean).join(", "));
    setResults([]);
    setLocationError("");
  }

  async function reversePick(lat: number, lng: number) {
    reverseController.current?.abort();
    const controller = new AbortController();
    reverseController.current = controller;
    setGeoLoading(true);
    setLocationError("");

    try {
      const response = await fetch(
        `/api/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
        { signal: controller.signal },
      );
      const payload = (await response.json()) as {
        results?: GeocodeResult[];
        error?: string;
      };
      if (!response.ok || !payload.results?.[0]) {
        throw new Error(payload.error || "No address was found here.");
      }
      selectLocation({ ...payload.results[0], lat, lng });
    } catch (error) {
      if (controller.signal.aborted) return;
      const coordinateLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      selectLocation({
        lat,
        lng,
        area: coordinateLabel,
        city: "",
        label: coordinateLabel,
      });
      const classified = classifyAppError(error, { op: "geocode" });
      setLocationError(
        `${classified.message} Exact coordinates were selected instead.`,
      );
    } finally {
      if (!controller.signal.aborted) setGeoLoading(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError("Location services are not supported by this browser.");
      return;
    }
    setGeoLoading(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void reversePick(pos.coords.latitude, pos.coords.longitude);
      },
      (error) => {
        setGeoLoading(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Search or drop the pin instead."
            : "Your current location could not be determined. Try again or search.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setLocationError("Enter at least 2 characters.");
      return;
    }

    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setSearchLoading(true);
    setLocationError("");
    setResults([]);
    try {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(normalizedQuery)}`,
        { signal: controller.signal },
      );
      const payload = (await response.json()) as {
        results?: GeocodeResult[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Location search failed.");
      }
      const nextResults = payload.results ?? [];
      setResults(nextResults);
      if (nextResults.length === 0) {
        setLocationError("No matching locations found. Try a more specific search.");
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      const classified = classifyAppError(error, { op: "geocode" });
      setLocationError(classified.message);
    } finally {
      if (!controller.signal.aborted) setSearchLoading(false);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <form className="flex gap-2" onSubmit={search}>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 rounded-xl pl-9"
            placeholder="Search an area or address"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setResults([]);
            }}
          />
        </div>
        <Button type="submit" variant="outline" disabled={searchLoading}>
          {searchLoading ? "Searching…" : "Search"}
        </Button>
      </form>

      {results.length > 0 ? (
        <div className="max-h-36 overflow-y-auto rounded-xl border bg-card">
          {results.map((result) => (
            <button
              key={`${result.lat},${result.lng}`}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/60"
              onClick={() => selectLocation(result)}
            >
              <MapPin className="size-3.5 shrink-0 text-primary" />
              <span className="line-clamp-2">{result.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {locationError ? (
        <p role="status" className="text-xs text-destructive">
          {locationError}
        </p>
      ) : null}

      <div
        className="relative overflow-hidden rounded-2xl border"
        style={{ height }}
      >
        <MapContainer
          center={center}
          zoom={hasLocation ? 13 : 5}
          className="h-full w-full"
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController
            center={center}
            radiusKm={radius}
            hasLocation={hasLocation}
          />
          <MapClickHandler
            onPick={(lat, lng) => void reversePick(lat, lng)}
          />
          {hasLocation ? (
            <Marker
              position={center}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const marker = event.target as L.Marker;
                  const { lat, lng } = marker.getLatLng();
                  void reversePick(lat, lng);
                },
              }}
            />
          ) : null}
          {showRadius && hasLocation && !unlimited ? (
            <Circle
              center={center}
              radius={radius * 1000}
              pathOptions={{
                color: "#8E30FF",
                fillColor: "#8E30FF",
                fillOpacity: 0.12,
                weight: 2,
              }}
            />
          ) : null}
        </MapContainer>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute bottom-3 left-3 z-[1000] rounded-full shadow-md"
          onClick={useCurrentLocation}
          disabled={geoLoading || searchLoading}
        >
          <Crosshair className="size-3.5" />
          {geoLoading ? "Locating…" : "Use Current Location"}
        </Button>
      </div>

      <div className="flex items-start justify-between gap-3 rounded-2xl border bg-card p-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Selected Location
          </p>
          <p className="truncate text-sm">
            {hasLocation ? (
              <>
                <span className="font-bold">{value.area}</span>
                {value.city ? (
                  <span className="font-light text-muted-foreground">
                    , {value.city}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">Not selected</span>
            )}
          </p>
          {showRadius && hasLocation ? (
            <p className="mt-0.5 text-xs font-light text-muted-foreground">
              Radius · {formatSearchRadius(radius)}
            </p>
          ) : null}
        </div>
        <MapPin className="mt-1 size-4 shrink-0 text-primary" />
      </div>

      {showRadius && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={unlimited ? "default" : "outline"}
            className="rounded-full"
            onClick={() => onChange({ ...value, search_radius_km: null })}
          >
            All
          </Button>
          {RADIUS_OPTIONS.map((km) => (
            <Button
              key={km}
              type="button"
              size="sm"
              variant={radius === km ? "default" : "outline"}
              className="rounded-full"
              onClick={() =>
                onChange({ ...value, search_radius_km: km })
              }
            >
              {km} km
            </Button>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Location search data ©{" "}
        <a
          className="underline"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}
