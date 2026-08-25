import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MapPoint } from "./trip-map";
import { useI18n } from "@/lib/i18n";
import { fetchOsrmRoute, osmTileLayer, pointsWithCoords, type LatLng } from "@/lib/osm";

import "leaflet/dist/leaflet.css";

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

export function LiveTripMap({
  points,
  focusIndex = 0,
  live = false,
  externalPosition = null,
  trail = [],
  onPosition,
  className = "h-64 w-full",
  markerLabel = "Vehicle",
}: {
  points: MapPoint[];
  focusIndex?: number;
  /** Watch device GPS (driver). */
  live?: boolean;
  /** Shared position from server (employee / dispatch). */
  externalPosition?: LatLng | null;
  /** Past pings for grey trail. */
  trail?: LatLng[];
  /** Called when live GPS updates (driver ping). */
  onPosition?: (pos: LatLng) => void;
  className?: string;
  markerLabel?: string;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const routeLayerRef = useRef<import("leaflet").Polyline | null>(null);
  const trailLayerRef = useRef<import("leaflet").Polyline | null>(null);
  const driverMarkerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const lastRouteOriginRef = useRef<LatLng | null>(null);
  const lastRouteAtRef = useRef(0);
  const onPositionRef = useRef(onPosition);
  onPositionRef.current = onPosition;

  const [devicePos, setDevicePos] = useState<LatLng | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [navTick, setNavTick] = useState(0);
  const [navigating, setNavigating] = useState(false);

  const coords = pointsWithCoords(points);
  const focus = coords[Math.min(focusIndex, Math.max(0, coords.length - 1))];
  const pointsKey = points.map((p) => `${p.latitude},${p.longitude},${p.point_type}`).join("|");
  const driverPos = live ? devicePos : externalPosition;
  const remaining = coords.slice(Math.min(focusIndex, coords.length));

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

  // Base map + waypoint markers (rebuild when route points change)
  useEffect(() => {
    if (!containerRef.current || coords.length === 0) return;
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
        osmTileLayer(L).addTo(mapRef.current);
      }

      const map = mapRef.current;
      map.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
          map.removeLayer(layer);
        }
      });
      driverMarkerRef.current = null;

      coords.forEach((p, i) => {
        const isPickup = p.point_type === "pickup";
        const isDest = p.point_type === "destination";
        const color = isPickup ? "#16a34a" : isDest ? "#dc2626" : "#2563eb";
        L.circleMarker([p.latitude, p.longitude], {
          radius: i === focusIndex ? 10 : 8,
          color: "#fff",
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        })
          .bindPopup(`<strong>${p.name}</strong>${p.address ? `<br/>${p.address}` : ""}`)
          .addTo(map);
      });

      const seed = coords.map((p) => [p.latitude, p.longitude] as LatLng);
      map.fitBounds(L.latLngBounds(seed), { padding: [28, 28] });
      requestAnimationFrame(() => map.invalidateSize());
    });

    return () => {
      cancelled = true;
    };
  }, [pointsKey, focusIndex]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Live / shared driver marker
  useEffect(() => {
    if (!mapRef.current || !driverPos) return;
    void import("leaflet").then((L) => {
      if (!mapRef.current) return;
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng(driverPos);
      } else {
        driverMarkerRef.current = L.circleMarker(driverPos, {
          radius: 9,
          color: "#fff",
          weight: 3,
          fillColor: "#0ea5e9",
          fillOpacity: 1,
        })
          .bindPopup(markerLabel)
          .addTo(mapRef.current);
      }
    });
  }, [driverPos, markerLabel]);

  // Trail polyline
  useEffect(() => {
    if (!mapRef.current) return;
    void import("leaflet").then((L) => {
      if (!mapRef.current) return;
      if (trailLayerRef.current) {
        mapRef.current.removeLayer(trailLayerRef.current);
        trailLayerRef.current = null;
      }
      if (trail.length >= 2) {
        trailLayerRef.current = L.polyline(trail, {
          color: "#94a3b8",
          weight: 3,
          opacity: 0.55,
          dashArray: "4 6",
        }).addTo(mapRef.current);
      }
    });
  }, [trail.map((p) => p.join(",")).join("|")]);

  // Active pathway: driver → remaining waypoints (debounced)
  useEffect(() => {
    if (!mapRef.current || remaining.length === 0) return;
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
    const shouldFetch = forceNav || !routeLayerRef.current || movedFar || timedOut || !origin;

    if (!shouldFetch && origin) return;

    setNavigating(true);
    void (async () => {
      const route = await fetchOsrmRoute(waypoints);
      if (cancelled || !mapRef.current) {
        setNavigating(false);
        return;
      }
      const L = await import("leaflet");
      if (routeLayerRef.current) {
        mapRef.current.removeLayer(routeLayerRef.current);
      }
      routeLayerRef.current = L.polyline(route, {
        color: "hsl(221 83% 53%)",
        weight: 5,
        opacity: 0.85,
      }).addTo(mapRef.current);
      if (origin) {
        lastRouteOriginRef.current = origin;
        lastRouteAtRef.current = Date.now();
      }
      const bounds = L.latLngBounds(route.length ? route : waypoints);
      mapRef.current.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
      setNavigating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    driverPos?.[0],
    driverPos?.[1],
    focusIndex,
    pointsKey,
    navTick,
  ]);

  const handleNavigate = useCallback(() => {
    lastRouteAtRef.current = 0;
    lastRouteOriginRef.current = null;
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

    void import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map || !focus) return;
      const targets: LatLng[] = [];
      if (driverPos) targets.push(driverPos);
      targets.push([focus.latitude, focus.longitude]);
      if (targets.length === 1) {
        map.setView(targets[0]!, 15, { animate: true });
      } else {
        map.fitBounds(L.latLngBounds(targets), { padding: [40, 40], maxZoom: 16 });
      }
    });
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

  return (
    <div className="space-y-2">
      <div className={`relative overflow-hidden rounded-lg border border-border ${className}`}>
        <div ref={containerRef} className="h-full w-full min-h-[16rem]" />
        {(live || externalPosition) && (
          <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-medium shadow-sm backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-coral/70 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            {live ? t("map.liveGps") : t("map.liveTracking")}
          </div>
        )}
      </div>
      {geoError && <p className="text-xs text-amber-600">{geoError}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
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
