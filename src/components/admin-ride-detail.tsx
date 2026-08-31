import { Link } from "@tanstack/react-router";
import { ArrowLeft, Car, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AssignmentPanel } from "@/components/assignment-panel";
import { LiveTripMap } from "@/components/live-trip-map";
import { LookupChip } from "@/components/lookup-chip";
import { OsmRouteMap } from "@/components/osm-route-map";
import { AppShell } from "@/components/app-shell";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { EmptyState } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { formatDateTime, relativeTime } from "@/lib/fleet";
import { useLookupEntry } from "@/lib/lookups-context";
import type { LatLng } from "@/lib/osm";
import {
  useAuditTrail,
  useDecideRequest,
  useRequest,
  useTripHistory,
  useTripLocation,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import {
  formatPickupLabel,
  pointTone,
  trackFocusIndex,
  type RoutePoint,
  type TripLike,
} from "@/lib/ride-detail";

type Passenger = { id: string; full_name: string; phone?: string | null };

function requesterInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function AdminRideDetail({ requestId }: { requestId: string }) {
  const { data, isLoading } = useRequest(requestId);
  const { isDispatcher, user } = useAuth();
  const decide = useDecideRequest();
  const [changeAssign, setChangeAssign] = useState(false);

  const request = data?.request;
  const tripRel = request?.trips as unknown;
  const trip = (Array.isArray(tripRel) ? tripRel[0] : tripRel) as TripLike | undefined;
  const tripLive = !!trip && !["completed", "cancelled", "breakdown"].includes(trip.status);
  const history = useTripHistory(trip?.id);
  const loc = useTripLocation(trip?.id, tripLive);
  const audit = useAuditTrail(requestId);
  const tripType = useLookupEntry("trip_type", request?.trip_type);

  if (isLoading) {
    return (
      <AppShell title="Ride details" subtitle="Loading…">
        <DetailPageSkeleton />
      </AppShell>
    );
  }

  if (!request) {
    return (
      <AppShell title="Ride details" subtitle="Not found">
        <EmptyState title="Request not found" />
      </AppShell>
    );
  }

  const canDecide = isDispatcher && request.status === "submitted";
  const canAssign =
    isDispatcher && ["approved", "submitted"].includes(request.status) && !trip;
  const isAssigned = !!(
    request.vehicles ||
    request.drivers ||
    request.assigned_driver_id ||
    request.assigned_vehicle_id
  );
  const canChangeAssign =
    isDispatcher &&
    isAssigned &&
    ["assigned", "approved", "submitted", "in_progress"].includes(request.status) &&
    (!trip || ["driver_assigned", "driver_confirmed"].includes(trip.status));

  const mapPoints: RoutePoint[] = ((data.points ?? []) as RoutePoint[]).map((p) => ({
    name: p.name,
    ...(p.address ? { address: p.address } : {}),
    latitude: p.latitude,
    longitude: p.longitude,
    point_type: p.point_type,
    ...(p.expected_at != null ? { expected_at: p.expected_at } : {}),
  }));

  const externalPos: LatLng | null =
    loc.data?.latitude != null && loc.data?.longitude != null
      ? [Number(loc.data.latitude), Number(loc.data.longitude)]
      : null;
  const trail: LatLng[] = (loc.data?.trail ?? []).map((p) => [p.lat, p.lng] as LatLng);
  const focusIdx = trip ? trackFocusIndex(trip.status, mapPoints, trip.current_stop_index ?? 0) : 0;
  const passengers = (data.passengers ?? []) as Passenger[];
  const historyRows = ((history.data ?? []) as { id: string; to_status: string; created_at: string }[]).slice(
    -4,
  );
  const auditRows = (
    (audit.data ?? []) as {
      id: string;
      action: string;
      actor_name?: string | null;
      created_at: string;
    }[]
  ).slice(0, 6);

  const mapBlock =
    mapPoints.length > 0 ? (
      <div className="ride-detail__map ride-detail__map--admin">
        {tripLive ? (
          <LiveTripMap
            mapOnly
            className="ride-detail__map-el ride-detail__map-el--admin"
            points={mapPoints}
            focusIndex={focusIdx}
            externalPosition={externalPos}
            trail={trail}
            markerLabel={request.drivers?.full_name ?? "Driver"}
          />
        ) : (
          <OsmRouteMap
            framed={false}
            showSummary={false}
            className="ride-detail__map-el ride-detail__map-el--admin"
            points={mapPoints}
            focusIndex={focusIdx}
          />
        )}
      </div>
    ) : (
      <p className="ride-detail__muted">No coordinates to plot.</p>
    );

  return (
    <AppShell title="Ride details" subtitle={request.reference} fillViewport>
      <div className="plan-ride ride-detail ride-detail--admin">
        <header className="plan-ride__top">
          <Link to="/requests" className="plan-ride__back" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="plan-ride__title">Ride details</h1>
          <span className="plan-ride__top-spacer" aria-hidden />
        </header>

        <div className="ride-detail__ref">
          <span className="ride-detail__ref-code">{request.reference}</span>
          <div className="ride-detail__admin-chips">
            <LookupChip group="priority" value={request.priority} pill />
            <LookupChip group="request_status" value={request.status} pill />
          </div>
        </div>

        <div className="plan-ride__pills ride-detail__pills-row">
          <div className="ride-detail__pills-main">
            <span className="plan-ride__pill">
              <span className="truncate">{formatPickupLabel(request.pickup_at)}</span>
            </span>
            <span className="plan-ride__pill">
              <span className="truncate">
                {request.passenger_count}{" "}
                {request.passenger_count === 1 ? "passenger" : "passengers"}
              </span>
            </span>
            <span className="plan-ride__pill">
              <span className="truncate">{tripType.label}</span>
            </span>
          </div>
          {canDecide && user ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ride-detail__reject-pill h-8 shrink-0"
              disabled={decide.isPending}
              onClick={() =>
                decide.mutate(
                  { requestId, approve: false, actorId: user.id },
                  {
                    onSuccess: () => toast.success("Request rejected"),
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              Reject
            </Button>
          ) : null}
        </div>

        <div className="ride-detail__who">
          <span className="ride-detail__who-avatar" aria-hidden>
            {requesterInitials(request.requester_name)}
          </span>
          <div className="ride-detail__who-body min-w-0 flex-1">
            <p className="ride-detail__who-label">Requested by</p>
            {request.requester_id ? (
              <Link
                to="/admin/employees/$employeeId"
                params={{ employeeId: request.requester_id }}
                className="ride-detail__who-name ride-detail__link"
              >
                {request.requester_name}
              </Link>
            ) : (
              <p className="ride-detail__who-name">{request.requester_name}</p>
            )}
            <p className="ride-detail__who-meta">
              {request.requester_phone ? (
                <a href={`tel:${request.requester_phone}`} className="ride-detail__who-phone">
                  {request.requester_phone}
                </a>
              ) : (
                <span>No phone</span>
              )}
              {request.expected_end_at ? (
                <span> · ends {formatDateTime(request.expected_end_at)}</span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="ride-detail__desk ride-detail__desk--admin">
          <div className="ride-detail__desk-info">
            <div className="plan-ride__route-wrap">
              <div className="plan-ride__route">
                {mapPoints.length === 0 ? (
                  <p className="ride-detail__muted p-3">No route points.</p>
                ) : (
                  mapPoints.map((p, i) => (
                    <div key={`${p.point_type}-${i}`} className="plan-ride__stop">
                      <span
                        className={cn("plan-ride__dot", `plan-ride__dot--${pointTone(p.point_type)}`)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="plan-ride__stop-name">{p.name}</span>
                        {p.address ? <span className="plan-ride__stop-addr">{p.address}</span> : null}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {request.purpose ? (
              <div className="ride-detail__purpose ride-detail__purpose--tight">
                <p className="ride-detail__purpose-label">Purpose</p>
                <p className="ride-detail__purpose-text">{request.purpose}</p>
              </div>
            ) : null}

            {request.special_requirements ? (
              <p className="ride-detail__notes-line">{request.special_requirements}</p>
            ) : null}

            <div className="ride-detail__map-mobile">{mapBlock}</div>

            {isAssigned ? (
              <section className="ride-detail__card ride-detail__card--tight">
                <div className="flex items-center justify-between gap-2">
                  <p className="ride-detail__card-title" style={{ marginBottom: 0 }}>
                    Vehicle & driver
                  </p>
                  {canChangeAssign ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 px-2 text-[11px]"
                      onClick={() => setChangeAssign((v) => !v)}
                      tooltip="Pick a different vehicle and/or driver"
                    >
                      {changeAssign ? "Cancel" : "Change"}
                    </Button>
                  ) : null}
                </div>
                {!changeAssign ? (
                  <div className="ride-detail__assign-grid ride-detail__assign-grid--tight mt-2">
                    <div className="ride-detail__assign-row">
                      <span className="ride-detail__assign-icon">
                        <Car className="size-4" />
                      </span>
                      <span className="min-w-0">
                        {isDispatcher && request.vehicles?.id ? (
                          <Link
                            to="/fleet/$vehicleId"
                            params={{ vehicleId: request.vehicles.id }}
                            className="ride-detail__assign-name ride-detail__link"
                          >
                            {request.vehicles.name ?? "—"}
                          </Link>
                        ) : (
                          <span className="ride-detail__assign-name">
                            {request.vehicles?.name ?? "—"}
                          </span>
                        )}
                        <span className="ride-detail__assign-sub">
                          {request.vehicles?.registration_number ?? "Vehicle"}
                        </span>
                      </span>
                    </div>
                    <div className="ride-detail__assign-row">
                      <span className="ride-detail__assign-icon">
                        <User className="size-4" />
                      </span>
                      <span className="min-w-0">
                        {isDispatcher && request.drivers?.id ? (
                          <Link
                            to="/drivers/$driverId"
                            params={{ driverId: request.drivers.id }}
                            className="ride-detail__assign-name ride-detail__link"
                          >
                            {request.drivers.full_name ?? "—"}
                          </Link>
                        ) : (
                          <span className="ride-detail__assign-name">
                            {request.drivers?.full_name ?? "—"}
                          </span>
                        )}
                        <span className="ride-detail__assign-sub">
                          {request.drivers?.phone ?? "Driver"}
                        </span>
                      </span>
                    </div>
                    {request.assigned_at ? (
                      <p className="ride-detail__assign-meta">
                        Assigned {relativeTime(request.assigned_at)}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2">
                    <AssignmentPanel
                      requestId={requestId}
                      passengers={request.passenger_count}
                      expectedEnd={request.expected_end_at ?? request.pickup_at}
                      changeMode
                      initialVehicleId={request.assigned_vehicle_id ?? request.vehicles?.id}
                      initialDriverId={request.assigned_driver_id ?? request.drivers?.id}
                      onAssigned={() => setChangeAssign(false)}
                    />
                  </div>
                )}
              </section>
            ) : canAssign ? (
              <section className="ride-detail__card ride-detail__card--tight">
                <p className="ride-detail__card-title">Assign vehicle & driver</p>
                <AssignmentPanel
                  requestId={requestId}
                  passengers={request.passenger_count}
                  expectedEnd={request.expected_end_at ?? request.pickup_at}
                  disabled={false}
                />
              </section>
            ) : null}

            {trip ? (
              <section className="ride-detail__card ride-detail__card--tight">
                <p className="ride-detail__card-title">
                  Trip progress{trip.reference ? ` · ${trip.reference}` : ""}
                </p>
                {tripLive && externalPos ? <p className="ride-detail__live">Live tracking on</p> : null}
                <ul className="ride-detail__history">
                  {historyRows.map((h, i, arr) => (
                    <li key={h.id} className="ride-detail__history-row">
                      <LookupChip group="trip_status" value={h.to_status} dot={false} />
                      <span className="ride-detail__history-time">
                        {i === arr.length - 1 ? "Now · " : ""}
                        {formatDateTime(h.created_at)}
                      </span>
                    </li>
                  ))}
                  {historyRows.length === 0 ? (
                    <li className="ride-detail__history-row">
                      <LookupChip group="trip_status" value={trip.status} dot={false} />
                      <span className="ride-detail__history-time">Current</span>
                    </li>
                  ) : null}
                </ul>
              </section>
            ) : null}

            {passengers.length > 0 ? (
              <section className="ride-detail__card ride-detail__card--tight">
                <p className="ride-detail__card-title">
                  Passengers · {passengers.length}
                </p>
                <ul className="ride-detail__pax-list">
                  {passengers.map((p) => (
                    <li key={p.id} className="ride-detail__pax-row">
                      <span className="ride-detail__assign-name">{p.full_name}</span>
                      {p.phone ? <span className="ride-detail__assign-sub">{p.phone}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="ride-detail__card ride-detail__card--tight ride-detail__card--flush">
              <p className="ride-detail__card-title ride-detail__card-title--pad">Activity</p>
              <ul className="ride-detail__audit">
                {auditRows.map((a) => (
                  <li key={a.id} className="ride-detail__audit-row">
                    <p className="ride-detail__audit-action">{a.action.replace(/_/g, " ")}</p>
                    <p className="ride-detail__audit-meta">
                      {a.actor_name ?? "System"} · {formatDateTime(a.created_at)}
                    </p>
                  </li>
                ))}
                {auditRows.length === 0 ? (
                  <li className="ride-detail__audit-row">
                    <p className="ride-detail__muted">No activity yet.</p>
                  </li>
                ) : null}
              </ul>
            </section>
          </div>

          <aside className="ride-detail__desk-map" aria-label={tripLive ? "Live map" : "Route map"}>
            <section className="ride-detail__map-panel">
              <div className="ride-detail__map-panel-head">
                <p className="ride-detail__card-title" style={{ marginBottom: 0 }}>
                  {tripLive ? "Live map" : "Route map"}
                </p>
                {tripLive && request.drivers?.full_name ? (
                  <span className="ride-detail__map-panel-sub">{request.drivers.full_name}</span>
                ) : null}
              </div>
              {mapBlock}
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
