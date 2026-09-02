import { useEffect, useRef, useState } from "react";
import { Clock, MapPin, Route } from "lucide-react";
import type { MapPoint } from "@/components/trip-map";
import {
  createDotMarker,
  DHAKA_CENTER,
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

/** Static map: roadmap basemap + OSRM driving path. DOM shell stays stable so MapLibre never detaches. */
export function OsmRouteMap({
  points,
  focusIndex = 0,
  className = "h-56 w-full",
  showSummary = true,
  departAt,
  framed = true,
  emptyHint = "Pick a place or set a pin — map stays here",
  drawRoute = true,
}: {
  points: MapPoint[];
  focusIndex?: number;
  className?: string;
  showSummary?: boolean;
  departAt?: string;
  framed?: boolean;
  emptyHint?: string;
  /** When false, only show markers (search preview). */
  drawRoute?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [summary, setSummary] = useState<OsrmSummary | null>(null);
  const [ready, setReady] = useState(false);

  const coords = pointsWithCoords(points);
  const hasCoords = coords.length > 0;
  const pointsKey = points
    .map((p) => `${p.latitude},${p.longitude},${p.point_type},${p.name}`)
    .join("|");

  // Mount once — never change wrapper around containerRef or MapLibre paints into a detached node
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = mountMap(el, { cooperativeGestures: false });
    mapRef.current = map;
    const cancelReady = whenStyleReady(map, () => {
      setReady(true);
      requestAnimationFrame(() => {
        try {
          map.resize();
        } catch {
          /* ignore */
        }
      });
    });

    return () => {
      cancelReady();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    const resize = () => {
      try {
        map.resize();
      } catch {
        /* ignore */
      }
    };
    resize();

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const clearRoute = () => {
      for (const id of ["route-line", "route-case"]) {
        try {
          if (map.getLayer(id)) map.removeLayer(id);
        } catch {
          /* ignore */
        }
      }
      try {
        if (map.getSource("route")) map.removeSource("route");
      } catch {
        /* ignore */
      }
    };

    if (coords.length === 0) {
      setSummary(null);
      clearRoute();
      map.easeTo({ center: DHAKA_CENTER, zoom: 12 });
      return;
    }

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
    if (!drawRoute || latlngs.length === 1) {
      setSummary(null);
      clearRoute();
      fitLatLngs(map, latlngs);
      requestAnimationFrame(resize);
      return;
    }

    void fetchOsrmRouteWithMeta(latlngs).then(({ route, summary: meta }) => {
      if (cancelled || !mapRef.current) return;
      setSummary(meta);
      const path = route.length >= 2 ? route : latlngs;
      upsertRouteLine(map, "route", path);
      fitLatLngs(map, path);
      requestAnimationFrame(resize);
    });

    return () => {
      cancelled = true;
    };
    // coords from pointsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey, focusIndex, ready, drawRoute]);

  const etaLocal =
    summary && departAt ? addMinutesToLocalInput(departAt, summary.durationMin) : null;

  return (
    <div className="min-w-0 space-y-2">
      <div
        className={cn(
          "relative overflow-hidden bg-[#f0f0f0]",
          framed && "rounded-xl border border-border/80 shadow-sm",
          className,
        )}
      >
        <div ref={containerRef} className="fleet-map h-full w-full" />
        {!hasCoords ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/45 to-transparent px-3 py-2.5">
            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-white">
              <MapPin className="size-3.5 shrink-0" />
              {emptyHint}
            </p>
          </div>
        ) : null}
      </div>
      {showSummary && summary ? (
        <div className="min-w-0 space-y-1 break-words text-xs text-muted-foreground">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Route className="size-3.5 shrink-0 text-primary" />
            <span>
              ~{summary.distanceKm} km · ~{formatOsrmDuration(summary)} drive
            </span>
            <span className="text-[10px] opacity-70">(Dhaka traffic est.)</span>
          </p>
          {etaLocal ? (
            <p className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
              <Clock className="size-3.5 shrink-0 text-primary" />
              Est. arrive ~{formatLocalClock(etaLocal)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
