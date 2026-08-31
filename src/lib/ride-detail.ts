export type TripLike = {
  id: string;
  reference?: string;
  status: string;
  current_stop_index?: number;
};

export type RoutePoint = {
  name: string;
  address?: string;
  latitude: number | null;
  longitude: number | null;
  point_type: string;
  expected_at?: string | null;
};

export function trackFocusIndex(status: string, points: { point_type: string }[], stopIndex = 0) {
  const pickupIdx = points.findIndex((p) => p.point_type === "pickup");
  const destIdx = points.findIndex((p) => p.point_type === "destination");
  const stopIndices = points
    .map((p, i) => (p.point_type === "stop" ? i : -1))
    .filter((i) => i >= 0);
  if (["driver_assigned", "driver_confirmed", "heading_to_pickup", "arrived_pickup"].includes(status)) {
    return Math.max(0, pickupIdx);
  }
  if (status === "return_in_transit" || status === "return_pending") {
    return Math.max(0, pickupIdx >= 0 ? pickupIdx : points.length - 1);
  }
  if (["passenger_picked_up", "in_transit", "stop_reached"].includes(status)) {
    if (stopIndex < stopIndices.length) return stopIndices[stopIndex]!;
    return Math.max(0, destIdx >= 0 ? destIdx : points.length - 1);
  }
  if (["destination_reached", "passenger_dropped"].includes(status)) {
    return Math.max(0, destIdx >= 0 ? destIdx : points.length - 1);
  }
  return Math.max(0, destIdx >= 0 ? destIdx : 0);
}

export function pointTone(type: string): "pickup" | "stop" | "drop" {
  if (type === "pickup") return "pickup";
  if (type === "destination") return "drop";
  return "stop";
}

export function formatPickupLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
