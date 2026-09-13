export type RoutePointLike = {
  name: string;
  point_type: string;
  sequence?: number;
  address?: string | null;
};

export function sortRoutePoints<T extends RoutePointLike>(points: T[]): T[] {
  return [...points].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
}

export function routeEndpoints(points: RoutePointLike[] | undefined | null) {
  const sorted = sortRoutePoints(points ?? []);
  const pickup = sorted.find((p) => p.point_type === "pickup");
  const drop = sorted.find((p) => p.point_type === "destination");
  return { pickup, drop, sorted };
}

export function routeLine(points: RoutePointLike[] | undefined | null): string | null {
  const sorted = sortRoutePoints(points ?? []).filter((p) => p.name?.trim());
  if (sorted.length >= 2) return sorted.map((p) => p.name.trim()).join(" → ");
  if (sorted.length === 1) return sorted[0]!.name.trim();
  const { pickup, drop } = routeEndpoints(points);
  if (pickup?.name && drop?.name) return `${pickup.name} → ${drop.name}`;
  if (pickup?.name) return pickup.name;
  if (drop?.name) return drop.name;
  return null;
}

/** Card / list: keep short when many stops so layout doesn't blow out. */
export function routeLineCompact(
  points: RoutePointLike[] | undefined | null,
  maxPoints = 4,
): string | null {
  const sorted = sortRoutePoints(points ?? []).filter((p) => p.name?.trim());
  if (sorted.length === 0) return routeLine(points);
  if (sorted.length <= maxPoints) return routeLine(sorted);
  const first = sorted[0]!.name.trim();
  const last = sorted[sorted.length - 1]!.name.trim();
  const mid = sorted.length - 2;
  return `${first} → ${mid} stop${mid === 1 ? "" : "s"} → ${last}`;
}

export type PassengerLike = {
  full_name?: string | null;
  phone?: string | null;
  is_primary?: boolean | null;
};

export function primaryContact(input: {
  requester_name?: string | null;
  requester_phone?: string | null;
  request_passengers?: PassengerLike[] | null;
}) {
  const passengers = (input.request_passengers ?? []).filter((p) => p.full_name?.trim());
  const primary =
    passengers.find((p) => p.is_primary) ??
    passengers[0] ??
    (input.requester_name
      ? { full_name: input.requester_name, phone: input.requester_phone ?? null, is_primary: true }
      : null);
  return primary
    ? { name: primary.full_name!.trim(), phone: primary.phone?.trim() || input.requester_phone?.trim() || null }
    : null;
}
