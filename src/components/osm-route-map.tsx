import { useEffect, useRef, useState } from "react";
import { Clock, MapPin, Route } from "lucide-react";
import type { MapPoint } from "@/components/trip-map";
import {
  addMinutesToLocalInput,
  fetchOsrmRouteWithMeta,
  formatLocalClock,
  formatOsrmDuration,
  osmTileLayer,
  pointsWithCoords,
  type LatLng,
  type OsrmSummary,
} from "@/lib/osm";
import { cn } from "@/lib/utils";

import "leaflet/dist/leaflet.css";

/** Static OSM map: stop markers + OSRM driving path. */
export function OsmRouteMap({
  points,
  focusIndex = 0,
  className = "h-56 w-full",
  showSummary = true,
  /** Pickup local datetime `YYYY-MM-DDTHH:mm` — used for ETA. */
  departAt,
}: {
  points: MapPoint[];
  focusIndex?: number;
  className?: string;
  showSummary?: boolean;
  departAt?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const [summary, setSummary] = useState<OsrmSummary | null>(null);

  const coords = pointsWithCoords(points);
  const pointsKey = points.map((p) => `${p.latitude},${p.longitude},${p.point_type}`).join("|");

  useEffect(() => {
    if (!containerRef.current || coords.length === 0) return;
    let cancelled = false;

    void import("leaflet").then(async (L) => {
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
        osmTileLayer(L).addTo(mapRef.current);
      }

      const map = mapRef.current;
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.CircleMarker || layer instanceof L.Polyline) {
          map.removeLayer(layer);
        }
      });

      const latlngs: LatLng[] = coords.map((p) => [p.latitude, p.longitude]);
      const { route, summary: meta } = await fetchOsrmRouteWithMeta(latlngs);
      if (cancelled) return;
      setSummary(meta);

      L.polyline(route, {
        color: "#2563eb",
        weight: 5,
        opacity: 0.85,
      }).addTo(map);

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

      map.fitBounds(L.latLngBounds(route.length ? route : latlngs), { padding: [28, 28] });
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

  const etaLocal =
    summary && departAt ? addMinutesToLocalInput(departAt, summary.durationMin) : null;

  if (!coords.length) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground",
          className,
        )}
      >
        <span className="flex items-center gap-1.5 px-3 text-center">
          <MapPin className="size-3.5 shrink-0" /> No map coordinates yet — pick saved places
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={cn("relative overflow-hidden rounded-lg border border-border", className)}>
        <div ref={containerRef} className="h-full w-full min-h-[14rem]" />
      </div>
      {showSummary && summary && (
        <div className="space-y-1 text-xs text-muted-foreground">
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
