import type { MapPoint } from "@/components/trip-map";

export type LatLng = [number, number];

export const OSM_DHAKA: LatLng = [23.8103, 90.4125];

export function pointsWithCoords(points: MapPoint[]) {
  return points
    .map((p) => {
      const latitude = Number(p.latitude);
      const longitude = Number(p.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return { ...p, latitude, longitude };
    })
    .filter((p): p is MapPoint & { latitude: number; longitude: number } => p != null);
}

/** Driving path via public OSRM (OpenStreetMap routing). Falls back to straight lines. */
export async function fetchOsrmRoute(coords: LatLng[]): Promise<LatLng[]> {
  if (coords.length < 2) return coords;
  const path = coords.map(([lat, lng]) => `${lng},${lat}`).join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`,
    );
    if (!res.ok) return coords;
    const data = (await res.json()) as {
      routes?: { geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number }[];
    };
    const line = data.routes?.[0]?.geometry?.coordinates;
    if (!line?.length) return coords;
    return line.map(([lng, lat]: [number, number]) => [lat, lng] as LatLng);
  } catch {
    return coords;
  }
}

export type OsrmSummary = {
  distanceKm: number;
  /** Drive time in whole minutes (traffic-adjusted when factor applied). */
  durationMin: number;
  /** Raw OSRM free-flow seconds before traffic factor. */
  durationSec: number;
};

/** Dhaka urban: OSRM free-flow is ~3× too fast; also floor by slow city avg speed. */
const BD_TRAFFIC_FACTOR = 2.9;
/** Congested city average (km/h) — used as minimum time floor from distance. */
const BD_AVG_SPEED_KMH = 16;

function estimateDriveMinutes(distanceM: number, osrmDurationSec: number): {
  durationMin: number;
  durationSec: number;
} {
  const distanceKm = distanceM / 1000;
  const fromOsrmMin = (osrmDurationSec * BD_TRAFFIC_FACTOR) / 60;
  const fromSpeedFloorMin = distanceKm > 0 ? (distanceKm / BD_AVG_SPEED_KMH) * 60 : 0;
  // Short hops still need signal / access time
  const minFloor = distanceKm <= 3 ? 12 : distanceKm <= 8 ? 20 : 25;
  const durationMin = Math.max(minFloor, Math.round(Math.max(fromOsrmMin, fromSpeedFloorMin)));
  return { durationMin, durationSec: durationMin * 60 };
}

function formatDriveMinutes(totalMin: number): string {
  const m = Math.max(1, Math.round(totalMin));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export function formatOsrmDuration(summary: OsrmSummary): string {
  return formatDriveMinutes(summary.durationMin);
}

/** Add minutes to `YYYY-MM-DDTHH:mm` local input; returns same format. */
export function addMinutesToLocalInput(localInput: string, minutes: number): string | null {
  if (!localInput || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(localInput)) return null;
  const [datePart, timePart] = localInput.split("T");
  const [y, mo, d] = datePart!.split("-").map(Number);
  const [hh, mm] = timePart!.slice(0, 5).split(":").map(Number);
  if (![y, mo, d, hh, mm].every((n) => Number.isFinite(n))) return null;
  const dt = new Date(y!, mo! - 1, d!, hh!, mm!, 0, 0);
  dt.setMinutes(dt.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function formatLocalClock(localInput: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(localInput)) return localInput;
  const [datePart, timePart] = localInput.split("T");
  const [y, mo, d] = datePart!.split("-").map(Number);
  const [hh, mm] = timePart!.slice(0, 5).split(":").map(Number);
  const dt = new Date(y!, mo! - 1, d!, hh!, mm!);
  return dt.toLocaleString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export async function fetchOsrmRouteWithMeta(
  coords: LatLng[],
): Promise<{ route: LatLng[]; summary: OsrmSummary | null }> {
  if (coords.length < 2) return { route: coords, summary: null };
  const path = coords.map(([lat, lng]) => `${lng},${lat}`).join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`,
    );
    if (!res.ok) return { route: coords, summary: null };
    const data = (await res.json()) as {
      code?: string;
      routes?: {
        geometry?: { coordinates?: [number, number][] };
        distance?: number;
        duration?: number;
        legs?: { duration?: number; distance?: number }[];
      }[];
    };
    if (data.code && data.code !== "Ok") return { route: coords, summary: null };
    const r = data.routes?.[0];
    const line = r?.geometry?.coordinates;
    if (!line?.length) return { route: coords, summary: null };

    const rawSec =
      typeof r?.duration === "number"
        ? r.duration
        : (r?.legs ?? []).reduce((sum, leg) => sum + (leg.duration ?? 0), 0);
    const distanceM = r?.distance ?? 0;
    const { durationMin, durationSec } = estimateDriveMinutes(distanceM, rawSec);

    return {
      route: line.map(([lng, lat]) => [lat, lng] as LatLng),
      summary: {
        distanceKm: Math.round((distanceM / 1000) * 10) / 10,
        durationMin,
        durationSec,
      },
    };
  } catch {
    return { route: coords, summary: null };
  }
}

export type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

/** Reverse geocode — via server proxy (Nominatim). */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/geocode/reverse?${new URLSearchParams({ lat: String(lat), lng: String(lng) })}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string | null };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}

export async function searchPlaces(query: string, limit = 6): Promise<NominatimResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const res = await fetch(
      `/api/geocode/search?${new URLSearchParams({ q, limit: String(limit) })}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    return (await res.json()) as NominatimResult[];
  } catch {
    return [];
  }
}

/** Free street basemap — Esri World Street Map (no API key). */
export function osmTileLayer(L: typeof import("leaflet")) {
  return L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      attribution:
        "Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom",
      maxZoom: 19,
    },
  );
}
