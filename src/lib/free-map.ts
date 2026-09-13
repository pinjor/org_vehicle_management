import * as maplibregl from "maplibre-gl";
import type {
  GeoJSONSource,
  LineLayerSpecification,
  LngLatBoundsLike,
  Map as MapLibreMap,
  Marker,
  StyleSpecification,
} from "maplibre-gl";
import type { LatLng } from "@/lib/osm";

import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Stable no-key basemap — do not change without verifying tiles load in-browser.
 *
 * Rules:
 * - Inline raster style only (no remote style URL).
 * - One host family per style (never mix OSM.fr + OSM.de etc.).
 * - Never use CARTO basemaps.cartocdn.com (watermarks "API KEY REQUIRED").
 * - Never use tile.openstreetmap.org (blocks non-browser / heavy use).
 *
 * Primary: OSM.fr. Fallback: Esri World Street Map (maxzoom 16).
 */
function rasterStyle(
  name: string,
  tiles: string[],
  attribution: string,
  maxzoom: number,
): StyleSpecification {
  return {
    version: 8,
    name,
    sources: {
      streets: {
        type: "raster",
        tiles,
        tileSize: 256,
        attribution,
        minzoom: 0,
        maxzoom,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#dce6ef" },
      },
      { id: "streets", type: "raster", source: "streets" },
    ],
  };
}

export const FREE_MAP_STYLE: StyleSpecification = rasterStyle(
  "FleetOps OSM.fr",
  [
    "https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
    "https://b.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
    "https://c.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
  ],
  "© OpenStreetMap",
  18,
);

const FREE_MAP_STYLE_ESRI: StyleSpecification = rasterStyle(
  "FleetOps Esri",
  [
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  ],
  "© Esri · © OpenStreetMap",
  16,
);

export const DHAKA_CENTER: [number, number] = [90.4125, 23.8103]; // lng, lat

export const ROUTE_COLOR = "#0d9488";
export const ROUTE_CASE = "#ffffff";

export function toLngLat([lat, lng]: LatLng): [number, number] {
  return [lng, lat];
}

export function lineFeature(path: LatLng[]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: path.map(toLngLat),
    },
  };
}

export function fitLatLngs(map: MapLibreMap, points: LatLng[], padding = 56, maxZoom = 15) {
  if (!points.length) return;
  if (points.length === 1) {
    map.easeTo({ center: toLngLat(points[0]!), zoom: Math.min(15, maxZoom) });
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  points.forEach((p) => bounds.extend(toLngLat(p)));
  map.fitBounds(bounds as LngLatBoundsLike, { padding, maxZoom, duration: 500 });
}

export function markerColor(pointType?: string) {
  if (pointType === "pickup") return "#059669";
  if (pointType === "destination") return "#e11d48";
  return "#2563eb";
}

/** Teardrop pin — rideshare-style, anchors at tip. */
export function createDotMarker(color: string, large = false) {
  const wrap = document.createElement("div");
  const w = large ? 28 : 22;
  const h = large ? 40 : 32;
  wrap.style.cssText = `width:${w}px;height:${h}px;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));`;
  wrap.innerHTML = `
    <svg width="${w}" height="${h}" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.2 0 11.6C0 20.4 12 36 12 36S24 20.4 24 11.6C24 5.2 18.6 0 12 0Z" fill="${color}"/>
      <circle cx="12" cy="11.5" r="5.2" fill="#fff"/>
    </svg>`;
  return new maplibregl.Marker({ element: wrap, anchor: "bottom" });
}

/** Driving route with white casing (reads over any basemap). */
export function upsertRouteLine(
  map: MapLibreMap,
  sourceId: string,
  path: LatLng[],
  opts?: { color?: string; width?: number },
) {
  if (!map.isStyleLoaded()) return;
  const color = opts?.color ?? ROUTE_COLOR;
  const width = opts?.width ?? 5;
  const data = lineFeature(path);
  const src = map.getSource(sourceId) as GeoJSONSource | undefined;
  if (src) {
    src.setData(data);
    return;
  }
  map.addSource(sourceId, { type: "geojson", data });
  map.addLayer({
    id: `${sourceId}-case`,
    type: "line",
    source: sourceId,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ROUTE_CASE,
      "line-width": width + 4,
      "line-opacity": 0.9,
    },
  });
  map.addLayer({
    id: `${sourceId}-line`,
    type: "line",
    source: sourceId,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": color,
      "line-width": width,
      "line-opacity": 1,
    },
  });
}

/** Fire when style is usable. Prefer style.load; do not race with a short timeout. */
export function whenStyleReady(map: MapLibreMap, cb: () => void) {
  let done = false;
  const fire = () => {
    if (done) return;
    if (!map.isStyleLoaded()) return;
    done = true;
    cb();
  };
  if (map.isStyleLoaded()) {
    fire();
    return () => {
      done = true;
    };
  }
  map.on("load", fire);
  map.on("style.load", fire);
  // Last resort only — remote/network stalls
  const t = window.setTimeout(() => {
    if (!done && map.isStyleLoaded()) fire();
    else if (!done) {
      done = true;
      cb();
    }
  }, 4000);
  return () => {
    done = true;
    window.clearTimeout(t);
    map.off("load", fire);
    map.off("style.load", fire);
  };
}

/** Ensure MapLibre paints after layout — blank maps often = 0×0 container at init. */
export function mountMap(
  container: HTMLElement,
  opts?: {
    center?: [number, number];
    zoom?: number;
    /** Default true so one-finger page scroll works on mobile ride detail. */
    cooperativeGestures?: boolean;
  },
) {
  container.style.width = "100%";
  container.style.height = "100%";
  if (!container.style.minHeight && container.clientHeight < 8) {
    container.style.minHeight = "10rem";
  }

  const map = new maplibregl.Map({
    container,
    style: FREE_MAP_STYLE,
    center: opts?.center ?? DHAKA_CENTER,
    zoom: opts?.zoom ?? 12,
    minZoom: 2,
    maxZoom: 18,
    attributionControl: { compact: true },
    fadeDuration: 0,
    pitchWithRotate: false,
    renderWorldCopies: false,
    cooperativeGestures: opts?.cooperativeGestures ?? true,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");

  let fellBack = false;
  let tileErrors = 0;
  map.on("error", (e) => {
    if (fellBack) return;
    const err = (e as { error?: { message?: string; status?: number } }).error;
    const msg = String(err?.message ?? "");
    // Only fall back on real tile HTTP failures — not every MapLibre "style" noise
    const tileFail =
      /Failed to fetch|AJAXError|status (403|404|500|502|503)/i.test(msg) ||
      (typeof err?.status === "number" && err.status >= 400);
    if (!tileFail) return;
    tileErrors += 1;
    if (tileErrors < 3) return;
    fellBack = true;
    try {
      map.setStyle(FREE_MAP_STYLE_ESRI);
    } catch {
      /* ignore */
    }
  });

  const resize = () => {
    try {
      map.resize();
    } catch {
      /* map removed */
    }
  };

  whenStyleReady(map, resize);
  requestAnimationFrame(() => {
    resize();
    requestAnimationFrame(resize);
  });
  setTimeout(resize, 80);
  setTimeout(resize, 250);
  setTimeout(resize, 600);

  const ro = new ResizeObserver(() => resize());
  ro.observe(container);
  if (container.parentElement) ro.observe(container.parentElement);

  const originalRemove = map.remove.bind(map);
  map.remove = () => {
    ro.disconnect();
    originalRemove();
  };

  return map;
}

export type { GeoJSONSource, LineLayerSpecification, MapLibreMap, Marker };
export { maplibregl };
