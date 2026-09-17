import type { ReactNode } from "react";
import {
  DriverTripMirrorCard,
  RequestMirrorCard,
  TripMirrorCard,
} from "@/components/trip-mirror-card";
import type { RoutePointLike } from "@/lib/route-summary";
import type { RequestRow, TripRecord } from "@/lib/queries";

/** Driver trip card — aligned with table row cells. */
export function DriverAssignmentCard({
  trip,
  emphasize,
}: {
  trip: TripRecord;
  emphasize?: boolean;
  showStatus?: boolean;
}) {
  return <DriverTripMirrorCard trip={trip} {...(emphasize ? { emphasize: true } : {})} />;
}

/** Employee request card — aligned with table row cells. */
export function EmployeeRequestCard({
  request,
}: {
  request: RequestRow & { request_route_points?: RoutePointLike[] };
}) {
  return <RequestMirrorCard request={request} mode="employee" />;
}

/** Admin request card — aligned with table row cells. */
export function AdminRequestCard({
  request,
  trailing,
  className,
}: {
  request: RequestRow & { request_route_points?: RoutePointLike[] };
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <RequestMirrorCard
      request={request}
      mode="admin"
      {...(trailing != null ? { actions: trailing } : {})}
      {...(className ? { className } : {})}
    />
  );
}

/** Admin trip card — aligned with table row cells. */
export function LiveTripCard({ trip }: { trip: TripRecord }) {
  return <TripMirrorCard trip={trip} />;
}
