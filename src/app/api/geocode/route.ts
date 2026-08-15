import { NextResponse } from "next/server";

const DEFAULT_GEOCODER_URL = "https://nominatim.openstreetmap.org";
/** Freelanzo operates in India — bias Nominatim search away from US/global matches. */
const DEFAULT_COUNTRY_CODES = "in";
const CACHE_SECONDS = 60 * 60 * 24 * 30;

type NominatimAddress = Record<string, string | undefined>;

type NominatimResult = {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
};

export type GeocodeResult = {
  lat: number;
  lng: number;
  area: string;
  city: string;
  label: string;
};

function first(address: NominatimAddress, keys: string[]) {
  for (const key of keys) {
    const value = address[key]?.trim();
    if (value) return value;
  }
  return "";
}

function normalize(result: NominatimResult): GeocodeResult | null {
  const lat = Number(result.lat);
  const lng = Number(result.lon);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  const address = result.address ?? {};
  const city = first(address, [
    "city",
    "town",
    "village",
    "municipality",
    "county",
    "state_district",
    "state",
  ]);
  const area =
    first(address, [
      "neighbourhood",
      "suburb",
      "city_district",
      "borough",
      "quarter",
      "hamlet",
      "road",
    ]) ||
    result.name?.trim() ||
    result.display_name?.split(",")[0]?.trim() ||
    `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  return {
    lat,
    lng,
    area,
    city: city === area ? "" : city,
    label: result.display_name?.trim() || [area, city].filter(Boolean).join(", "),
  };
}

async function queryNominatim(url: URL, request: Request) {
  const origin = new URL(request.url).origin;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language":
        request.headers.get("accept-language") || "en-IN,en",
      "User-Agent":
        process.env.NOMINATIM_USER_AGENT ||
        `Freelanzo/0.1 (location picker; ${origin})`,
    },
    next: { revalidate: CACHE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Geocoder returned ${response.status}`);
  }
  return response.json() as Promise<NominatimResult | NominatimResult[]>;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim();
  const rawLat = params.get("lat");
  const rawLng = params.get("lng");
  const isSearch = Boolean(query);
  const isReverse = rawLat !== null && rawLng !== null;

  if (isSearch === isReverse) {
    return NextResponse.json(
      { error: "Provide either a search query or coordinates." },
      { status: 400 },
    );
  }

  const baseUrl = process.env.NOMINATIM_BASE_URL || DEFAULT_GEOCODER_URL;
  const upstream = new URL(isSearch ? "/search" : "/reverse", baseUrl);
  upstream.searchParams.set("format", "jsonv2");
  upstream.searchParams.set("addressdetails", "1");

  if (query) {
    if (query.length < 2 || query.length > 200) {
      return NextResponse.json(
        { error: "Search must be between 2 and 200 characters." },
        { status: 400 },
      );
    }
    upstream.searchParams.set("q", query);
    upstream.searchParams.set("limit", "5");
    upstream.searchParams.set("layer", "address");
    upstream.searchParams.set(
      "countrycodes",
      process.env.NOMINATIM_COUNTRY_CODES || DEFAULT_COUNTRY_CODES,
    );
  } else {
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return NextResponse.json(
        { error: "Invalid coordinates." },
        { status: 400 },
      );
    }
    upstream.searchParams.set("lat", String(lat));
    upstream.searchParams.set("lon", String(lng));
    upstream.searchParams.set("zoom", "16");
    upstream.searchParams.set("layer", "address");
  }

  try {
    const payload = await queryNominatim(upstream, request);
    const source = Array.isArray(payload) ? payload : [payload];
    const results = source
      .map(normalize)
      .filter((result): result is GeocodeResult => result !== null);

    return NextResponse.json(
      { results },
      {
        headers: {
          "Cache-Control": `public, max-age=0, s-maxage=${CACHE_SECONDS}`,
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Location lookup is temporarily unavailable." },
      { status: 502 },
    );
  }
}
