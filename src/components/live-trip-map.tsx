import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MapPoint } from "./trip-map";
import {
  createDotMarker,
  fitLatLngs,
  maplibregl,
  markerColor,
  mountMap,
  ROUTE_COLOR,
  toLngLat,
  upsertRouteLine,
  whenStyleReady,
} from "@/lib/free-map";
import { useI18n } from "@/lib/i18n";
import { fetchOsrmRoute, pointsWithCoords, type LatLng } from "@/lib/osm";

function haversineM(a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function setDashedTrail(map: maplibregl.Map, path: LatLng[]) {
  const data = {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: path.map(([lat, lng]) => [lng, lat]),
    },
  };
  const src = map.getSource("trail") as maplibregl.GeoJSONSource | undefined;
  if (src) {
    src.setData(data);
    return;
  }
  map.addSource("trail", { type: "geojson", data });
  map.addLayer({
    id: "trail-line",
    type: "line",
    source: "trail",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#64748b",
      "line-width": 3,
      "line-opacity": 0.55,
      "line-dasharray": [1.2, 1.6],
    },
  });
}

export function LiveTripMap({
  points,
  focusIndex = 0,
  live = false,
  externalPosition = null,
  trail = [],
  onPosition,
  className = "h-64 w-full",
  markerLabel = "Vehicle",
  mapOnly = false,
}: {
  points: MapPoint[];
  focusIndex?: number;
  live?: boolean;
  externalPosition?: LatLng | null;
  trail?: LatLng[];
  onPosition?: (pos: LatLng) => void;
  className?: string;
  markerLabel?: string;
  mapOnly?: boolean;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastRouteOriginRef = useRef<LatLng | null>(null);
  const lastRouteAtRef = useRef(0);
  const hasRouteRef = useRef(false);
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;

  const [ready, setReady] = useState(false);
  const [devicePos, setDevicePos] = useState<LatLng | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [navTick, setNavTick] = useState(0);
  const [navigating, setNavigating] = useState(false);

  const coords = pointsWithCoords(points);
  const hasCoords = coords.length > 0;
  const focus = coords[Math.min(focusIndex, Math.max(0, coords.length - 1))];
  const pointsKey = points.map((p) => `${p.latitude},${p.longitude},${p.point_type}`).join("|");
  const driverPos = live ? devicePos : externalPosition;
  const remaining = coords.slice(Math.min(focusIndex, coords.length));

  useEffect(() => {
    if (!hasCoords) return;
    const el = containerRef.current;
    if (!el) return;
    const map = mountMap(el);
    mapRef.current = map;
    const cancelReady = whenStyleReady(map, () => setReady(true));
    return () => {
      cancelReady();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      driverMarkerRef.current?.remove();
      driverMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [hasCoords]);

  useEffect(() => {
    if (!live || typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const next: LatLng = [pos.coords.latitude, pos.coords.longitude];
        setDevicePos(next);
        setGeoError(null);
        onPositionRef.current?.(next);
      },
      () => setGeoError(t("map.geoDenied")),
      { enableHighAccuracy: true, maximumAge: 8_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [live, t]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || coords.length === 0) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = coords.map((p, i) =>
      createDotMarker(markerColor(p.point_type), i === focusIndex)
        .setLngLat([p.longitude, p.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 28, className: "fleet-map-popup" }).setHTML(
            `<strong>${p.name}</strong>${p.address ? `<br/><span style="opacity:.75">${p.address}</span>` : ""}`,
          ),
        )
        .addTo(map),
    );

    fitLatLngs(
      map,
      coords.map((p) => [p.latitude, p.longitude]),
    );
  }, [pointsKey, focusIndex, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !driverPos) return;
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLngLat(toLngLat(driverPos));
    } else {
      driverMarkerRef.current = createDotMarker("#0284c7", true)
        .setLngLat(toLngLat(driverPos))
        .setPopup(new maplibregl.Popup({ offset: 28 }).setText(markerLabel))
        .addTo(map);
    }
  }, [driverPos, markerLabel, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (trail.length >= 2) {
      setDashedTrail(map, trail);
    }
  }, [trail.map((p) => p.join(",")).join("|"), ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || remaining.length === 0) return;
    let cancelled = false;

    const origin = driverPos;
    const waypoints: LatLng[] = origin
      ? [origin, ...remaining.map((p) => [p.latitude, p.longitude] as LatLng)]
      : remaining.map((p) => [p.latitude, p.longitude] as LatLng);

    const now = Date.now();
    const last = lastRouteOriginRef.current;
    const movedFar = !last || !origin || haversineM(last, origin) > 80;
    const timedOut = now - lastRouteAtRef.current > 18_000;
    const forceNav = navTick > 0;
    const shouldFetch = forceNav || !hasRouteRef.current || movedFar || timedOut || !origin;
    if (!shouldFetch && origin) return;

    setNavigating(true);
    void fetchOsrmRoute(waypoints).then((route) => {
      if (cancelled || !mapRef.current) {
        setNavigating(false);
        return;
      }
      const path = route.length >= 2 ? route : waypoints;
      upsertRouteLine(mapRef.current, "live-route", path, { color: ROUTE_COLOR, width: 5 });
      hasRouteRef.current = path.length >= 2;
      if (origin) {
        lastRouteOriginRef.current = origin;
        lastRouteAtRef.current = Date.now();
      }
      fitLatLngs(mapRef.current, path, 48, 15);
      setNavigating(false);
    });

    return () => {
      cancelled = true;
    };
  }, [driverPos?.[0], driverPos?.[1], focusIndex, pointsKey, navTick, ready]);

  const handleNavigate = useCallback(() => {
    lastRouteAtRef.current = 0;
    lastRouteOriginRef.current = null;
    hasRouteRef.current = false;
    setNavTick((n) => n + 1);

    if (live && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next: LatLng = [pos.coords.latitude, pos.coords.longitude];
          setDevicePos(next);
          setGeoError(null);
          onPositionRef.current?.(next);
        },
        () => setGeoError(t("map.geoNavDenied")),
        { enableHighAccuracy: true, timeout: 12_000 },
      );
    }

    const map = mapRef.current;
    if (!map || !focus) return;
    const targets: LatLng[] = [];
    if (driverPos) targets.push(driverPos);
    targets.push([focus.latitude, focus.longitude]);
    fitLatLngs(map, targets, 48, 15);
  }, [live, focus, driverPos, t]);

  if (!coords.length) {
    return (
      <div
        className={`grid place-items-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground ${className}`}
      >
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3.5" /> {t("map.noCoords")}
        </span>
      </div>
    );
  }

  const dest = focus ?? coords[coords.length - 1]!;

  const mapPane = (
    <div
      className={
        mapOnly
          ? `relative overflow-hidden bg-[#f0f0f0] ${className}`
          : `relative overflow-hidden rounded-xl border border-border/80 bg-[#f0f0f0] shadow-sm ${className}`
      }
    >
      <div ref={containerRef} className="fleet-map h-full w-full" />
      {(live || externalPosition) && (
        <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-full bg-background/95 px-2.5 py-1 text-[10px] font-medium shadow-md ring-1 ring-border/60 backdrop-blur">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-coral/70 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          <span className="truncate">{live ? t("map.liveGps") : t("map.liveTracking")}</span>
        </div>
      )}
    </div>
  );

  if (mapOnly) return mapPane;

  return (
    <div className="min-w-0 space-y-2">
      {mapPane}
      {geoError && <p className="break-words text-xs text-amber-600">{geoError}</p>}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 break-words text-xs text-muted-foreground">
          {t("map.next")} <span className="font-medium text-foreground">{dest.name}</span>
          {dest.address ? ` · ${dest.address}` : ""}
        </p>
        <Button
          size="sm"
          variant="outline"
          type="button"
          disabled={navigating}
          tooltip={t("map.navigateTip")}
          onClick={handleNavigate}
        >
          <Navigation className="size-3.5" />
          {navigating ? t("map.routing") : t("map.navigate")}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{t("map.pathwayHint")}</p>
    </div>
  );
}
