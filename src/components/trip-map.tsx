import { MapPin } from "lucide-react";
import { OsmRouteMap } from "@/components/osm-route-map";
import { pointsWithCoords } from "@/lib/osm";

export type MapPoint = {
  name: string;
  address?: string;
  latitude: number | null;
  longitude: number | null;
  point_type?: string;
};

/** Request / trip map — OpenStreetMap tiles + OSRM driving path (in-app only). */
export function TripMap({
  points,
  focusIndex = 0,
  className = "h-56 w-full",
}: {
  points: MapPoint[];
  focusIndex?: number;
  className?: string;
}) {
  const withCoords = pointsWithCoords(points);
  const focus = withCoords[Math.min(focusIndex, Math.max(0, withCoords.length - 1))];

  return (
    <div className="space-y-2">
      <OsmRouteMap points={points} focusIndex={focusIndex} className={className} />
      {focus && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <span className="font-medium text-foreground">{focus.name}</span>
            {focus.address ? ` · ${focus.address}` : ""}
          </span>
        </p>
      )}
    </div>
  );
}
