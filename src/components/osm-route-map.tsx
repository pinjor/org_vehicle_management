import { useEffect, useRef, useState } from "react";
import { Clock, MapPin, Route } from "lucide-react";
import type { MapPoint } from "@/components/trip-map";
import {
  createDotMarker,
  fitLatLngs,
  maplibregl,
  markerColor,
  mountMap,
  upsertRouteLine,
  whenStyleReady,
} from "@/lib/free-map";
import {
  addMinutesToLocalInput,
  fetchOsrmRouteWithMeta,
  formatLocalClock,
  formatOsrmDuration,
  pointsWithCoords,
  type LatLng,
  type OsrmSummary,
} from "@/lib/osm";
import { cn } from "@/lib/utils";

/** Static map: roadmap basemap + OSRM driving path. */
export function OsmRouteMap({
  points,
  focusIndex = 0,
  className = "h-56 w-full",
  showSummary = true,
  departAt,
  framed = true,
}: {
  points: MapPoint[];
  focusIndex?: number;
  className?: string;
  showSummary?: boolean;
  departAt?: string;
  framed?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [summary, setSummary] = useState<OsrmSummary | null>(null);
  const [ready, setReady] = useState(false);

  const coords = pointsWithCoords(points);
  const hasCoords = coords.length > 0;
  const pointsKey = points.map((p) => `${p.latitude},${p.longitude},${p.point_type}`).join("|");

  // Remount when coords appear (container was absent on first paint).
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
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [hasCoords]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || coords.length === 0) return;
    let cancelled = false;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    coords.forEach((p, i) => {
      const marker = createDotMarker(markerColor(p.point_type), i === focusIndex)
        .setLngLat([p.longitude, p.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 28, className: "fleet-map-popup" }).setHTML(
            `<strong>${p.name}</strong>${p.address ? `<br/><span style="opacity:.75">${p.address}</span>` : ""}`,
          ),
        )
        .addTo(map);
      markersRef.current.push(marker);
    });

    const latlngs: LatLng[] = coords.map((p) => [p.latitude, p.longitude]);
    void fetchOsrmRouteWithMeta(latlngs).then(({ route, summary: meta }) => {
      if (cancelled || !mapRef.current) return;
      setSummary(meta);
      const path = route.length >= 2 ? route : latlngs;
      upsertRouteLine(map, "route", path);
      fitLatLngs(map, path);
    });

    return () => {
      cancelled = true;
    };
  }, [pointsKey, focusIndex, ready]);

  const etaLocal =
    summary && departAt ? addMinutesToLocalInput(departAt, summary.durationMin) : null;

  if (!hasCoords) {
    return (
      <div
        className={cn(
          "grid place-items-center bg-muted/30 text-xs text-muted-foreground",
          framed && "rounded-lg border border-dashed border-border",
          className,
        )}
      >
        <span className="flex items-center gap-1.5 px-3 text-center">
          <MapPin className="size-3.5 shrink-0" /> No map coordinates yet — pick saved places
        </span>
      </div>
    );
  }

  const mapPane = (
    <div
      className={cn(
        "relative overflow-hidden bg-[#e8f0e9]",
        framed && "rounded-xl border border-border/80 shadow-sm",
        className,
      )}
    >
      <div ref={containerRef} className="fleet-map h-full w-full" />
    </div>
  );

  if (!showSummary) return mapPane;

  return (
    <div className="min-w-0 space-y-2">
      {mapPane}
      {summary && (
        <div className="min-w-0 space-y-1 break-words text-xs text-muted-foreground">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Route className="size-3.5 shrink-0 text-primary" />
            <span>
              ~{summary.distanceKm} km · ~{formatOsrmDuration(summary)} drive
            </span>
            <span className="text-[10px] opacity-70">(Dhaka traffic est.)</span>
          </p>
          {etaLocal && (
            <p className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
              <Clock className="size-3.5 shrink-0 text-primary" />
              Est. arrive ~{formatLocalClock(etaLocal)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
