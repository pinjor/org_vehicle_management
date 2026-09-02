import { Link } from "@tanstack/react-router";
import { Car, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AssignmentPanel } from "@/components/assignment-panel";
import { LiveTripMap } from "@/components/live-trip-map";
import { WhenBanner, WhenStamp } from "@/components/info-blocks";
import { LookupChip } from "@/components/lookup-chip";
import { OsmRouteMap } from "@/components/osm-route-map";
import { AppShell } from "@/components/app-shell";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { EmptyState } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useLookupEntry } from "@/lib/lookups-context";
import { formatBdPhone } from "@/lib/phone";
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
  pointTone,
  trackFocusIndex,
  type RoutePoint,
  type TripLike,
} from "@/lib/ride-detail";

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
  const [deskLayout, setDeskLayout] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setDeskLayout(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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
      <AppShell title="Request" subtitle="Loading…" fillViewport backTo="/requests" backLabel="Back">
        <DetailPageSkeleton />
      </AppShell>
    );
  }

  if (!request) {
    return (
      <AppShell title="Request" subtitle="Not found" fillViewport backTo="/requests" backLabel="Back">
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
  const requesterPhone = request.requester_phone?.trim() || null;

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

  const mapEl =
    mapPoints.length > 0 ? (
      tripLive ? (
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
      )
    ) : (
      <p className="ride-detail__muted admin-req__map-empty">No coordinates to plot.</p>
    );

  return (
    <AppShell
      title="Request"
      subtitle={request.reference}
      fillViewport
      backTo="/requests"
      backLabel="Back"
    >
      <div className="admin-req">
        <div className="admin-req__status">
          <div className="admin-req__chips">
            <LookupChip group="request_status" value={request.status} pill />
            <span className="admin-req__pill">{request.passenger_count} pax</span>
            <span className="admin-req__pill">{tripType.label}</span>
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

        <div className="admin-req__desk">
          <div className="admin-req__main">
            <WhenBanner at={request.pickup_at} className="admin-req__when" />

            <section className="admin-req__who" aria-label="Requester">
              <span className="admin-req__avatar" aria-hidden>
                {requesterInitials(request.requester_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="admin-req__who-label">Requested by</p>
                {request.requester_id ? (
                  <Link
                    to="/admin/employees/$employeeId"
                    params={{ employeeId: request.requester_id }}
                    className="admin-req__who-name"
                  >
                    {request.requester_name}
                  </Link>
                ) : (
                  <p className="admin-req__who-name">{request.requester_name}</p>
                )}
                <p className="admin-req__who-meta">
                  {requesterPhone ? (
                    <span>{formatBdPhone(requesterPhone)}</span>
                  ) : (
                    <span>No phone</span>
                  )}
                  {request.expected_end_at ? (
                    <span className="inline-flex items-baseline gap-1">
                      {" "}
                      · ends <WhenStamp at={request.expected_end_at} />
                    </span>
                  ) : null}
                </p>
              </div>
            </section>

            <section className="admin-req__route" aria-label="Route">
              <p className="admin-req__section-label">Route</p>
              <div className="plan-ride__route">
                {mapPoints.length === 0 ? (
                  <p className="ride-detail__muted p-3">No route points.</p>
                ) : (
                  mapPoints.map((p, i) => (
                    <div
                      key={`${p.point_type}-${i}`}
                      className={cn(
                        "plan-ride__stop",
                        tripLive && i === focusIdx && "plan-ride__stop--focus",
                      )}
                    >
                      <span
                        className={cn("plan-ride__dot", `plan-ride__dot--${pointTone(p.point_type)}`)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="plan-ride__stop-name">
                          {p.name}
                          {tripLive && i === focusIdx ? (
                            <span className="plan-ride__stop-now"> · now</span>
                          ) : null}
                        </span>
                        {p.address ? <span className="plan-ride__stop-addr">{p.address}</span> : null}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            {(request.purpose || request.special_requirements) && (
              <div className="admin-req__facts">
                {request.purpose ? (
                  <div className="admin-req__purpose">
                    <p className="admin-req__section-label">Purpose</p>
                    <p className="admin-req__purpose-text">{request.purpose}</p>
                  </div>
                ) : null}
                {request.special_requirements ? (
                  <p className="admin-req__notes">{request.special_requirements}</p>
                ) : null}
              </div>
            )}

            {!deskLayout ? (
              <div className="admin-req__map-mobile" aria-label={tripLive ? "Live map" : "Route map"}>
                <section className="admin-req__map-card">
                  <p className="admin-req__section-label admin-req__map-label">
                    {tripLive ? "Live map" : "Route map"}
                  </p>
                  {mapEl}
                </section>
              </div>
            ) : null}

            {isAssigned ? (
              <section className="admin-req__card">
                <div className="admin-req__card-head">
                  <p className="admin-req__section-label">Vehicle & driver</p>
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
                  <div className="admin-req__party">
                    <div className="admin-req__party-row">
                      <span className="admin-req__party-icon" aria-hidden>
                        <Car className="size-4" />
                      </span>
                      <span className="min-w-0">
                        {isDispatcher && request.vehicles?.id ? (
                          <Link
                            to="/fleet/$vehicleId"
                            params={{ vehicleId: request.vehicles.id }}
                            className="admin-req__pax-name admin-req__link"
                          >
                            {request.vehicles.name ?? "—"}
                          </Link>
                        ) : (
                          <span className="admin-req__pax-name">
                            {request.vehicles?.name ?? "—"}
                          </span>
                        )}
                        <span className="admin-req__pax-miss">
                          {request.vehicles?.registration_number ?? "Vehicle"}
                        </span>
                      </span>
                    </div>
                    <div className="admin-req__party-row">
                      <span className="admin-req__party-icon" aria-hidden>
                        <User className="size-4" />
                      </span>
                      <span className="min-w-0">
                        {isDispatcher && request.drivers?.id ? (
                          <Link
                            to="/drivers/$driverId"
                            params={{ driverId: request.drivers.id }}
                            className="admin-req__pax-name admin-req__link"
                          >
                            {request.drivers.full_name ?? "—"}
                          </Link>
                        ) : (
                          <span className="admin-req__pax-name">
                            {request.drivers?.full_name ?? "—"}
                          </span>
                        )}
                        <span className="admin-req__pax-miss">
                          {request.drivers?.phone
                            ? formatBdPhone(request.drivers.phone)
                            : "Driver"}
                        </span>
                      </span>
                    </div>
                    {request.assigned_at ? (
                      <p className="admin-req__assign-meta">
                        Assigned <WhenStamp at={request.assigned_at} withRelative />
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <AssignmentPanel
                    requestId={requestId}
                    passengers={request.passenger_count}
                    expectedEnd={request.expected_end_at ?? request.pickup_at}
                    changeMode
                    initialVehicleId={request.assigned_vehicle_id ?? request.vehicles?.id}
                    initialDriverId={request.assigned_driver_id ?? request.drivers?.id}
                    onAssigned={() => setChangeAssign(false)}
                  />
                )}
              </section>
            ) : null}

            {canAssign ? (
              <section className="admin-req__card admin-req__card--assign">
                <p className="admin-req__section-label">Assign</p>
                <AssignmentPanel
                  requestId={requestId}
                  passengers={request.passenger_count}
                  expectedEnd={request.expected_end_at ?? request.pickup_at}
                  disabled={false}
                />
              </section>
            ) : null}

            {trip ? (
              <section className="admin-req__card">
                <p className="admin-req__section-label">
                  Trip progress
                  {trip.reference ? ` · ${trip.reference}` : ""}
                  {tripLive && externalPos ? (
                    <span className="admin-req__live"> · Live</span>
                  ) : null}
                </p>
                <ul className="ride-detail__history">
                  {historyRows.map((h, i, arr) => (
                    <li key={h.id} className="ride-detail__history-row">
                      <LookupChip group="trip_status" value={h.to_status} dot={false} />
                      <span className="ride-detail__history-time">
                        {i === arr.length - 1 ? <span className="mr-1">Now ·</span> : null}
                        <WhenStamp at={h.created_at} />
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

            <details className="admin-req__card admin-req__activity">
              <summary className="admin-req__activity-sum">
                Activity · {auditRows.length}
              </summary>
              <ul className="ride-detail__audit">
                {auditRows.map((a) => (
                  <li key={a.id} className="ride-detail__audit-row">
                    <p className="ride-detail__audit-action">{a.action.replace(/_/g, " ")}</p>
                    <p className="ride-detail__audit-meta">
                      {a.actor_name ?? "System"} · <WhenStamp at={a.created_at} />
                    </p>
                  </li>
                ))}
                {auditRows.length === 0 ? (
                  <li className="ride-detail__audit-row">
                    <p className="ride-detail__muted">No activity yet.</p>
                  </li>
                ) : null}
              </ul>
            </details>
          </div>

          {deskLayout ? (
            <aside className="admin-req__aside" aria-label={tripLive ? "Live map" : "Route map"}>
              <section className="admin-req__map-card">
                <div className="admin-req__map-head">
                  <p className="admin-req__section-label" style={{ padding: 0, margin: 0 }}>
                    {tripLive ? "Live map" : "Route map"}
                  </p>
                  {tripLive && request.drivers?.full_name ? (
                    <span className="admin-req__map-sub">{request.drivers.full_name}</span>
                  ) : null}
                </div>
                {mapEl}
              </section>
            </aside>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
