import { Link } from "@tanstack/react-router";
import { Car, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AssignmentPanel } from "@/components/assignment-panel";
import { WhenStamp, RouteFlow, formatCardDate } from "@/components/info-blocks";
import { LookupChip } from "@/components/lookup-chip";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { EmptyState } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { formatTime, formatWeekday, passengerLabel, attnClass } from "@/lib/fleet";
import { useLookupEntry } from "@/lib/lookups-context";
import { formatBdPhone } from "@/lib/phone";
import {
  useAuditTrail,
  useDecideRequest,
  useRequest,
  useTripHistory,
} from "@/lib/queries";
import { useNarrowDrawer } from "@/lib/use-narrow-drawer";
import {
  trackFocusIndex,
  type RoutePoint,
  type TripLike,
} from "@/lib/ride-detail";

/** Right-side request drawer — mount on /trips via search `request`. */
export function AdminRideDetail({
  requestId,
  open,
  onOpenChange,
}: {
  requestId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const narrow = useNarrowDrawer();
  const { data, isLoading } = useRequest(requestId);
  const { isDispatcher, user } = useAuth();
  const decide = useDecideRequest();
  const [changeAssign, setChangeAssign] = useState(false);

  useEffect(() => {
    setChangeAssign(false);
  }, [requestId]);

  const tripType = useLookupEntry("trip_type", data?.request?.trip_type);
  const request = data?.request;
  const tripRel = request?.trips as unknown;
  const trip = (Array.isArray(tripRel) ? tripRel[0] : tripRel) as TripLike | undefined;
  const tripLive = !!trip && !["completed", "cancelled", "breakdown"].includes(trip.status);
  const history = useTripHistory(trip?.id);
  const audit = useAuditTrail(requestId);

  const canReject = !!(isDispatcher && request?.status === "submitted");
  const canAssign = !!(
    isDispatcher &&
    request &&
    ["approved", "submitted"].includes(request.status) &&
    !trip
  );
  const isAssigned = !!(
    request?.vehicles ||
    request?.drivers ||
    request?.assigned_driver_id ||
    request?.assigned_vehicle_id
  );
  const canChangeAssign = !!(
    isDispatcher &&
    isAssigned &&
    request &&
    ["assigned", "approved", "submitted", "in_progress"].includes(request.status) &&
    (!trip || ["driver_assigned", "driver_confirmed"].includes(trip.status))
  );
  const requesterPhone = request?.requester_phone?.trim() || null;
  const requesterName = request?.requester_name?.trim() || "Request";

  const mapPoints: RoutePoint[] = ((data?.points ?? []) as RoutePoint[]).map((p) => ({
    name: p.name,
    ...(p.address ? { address: p.address } : {}),
    latitude: p.latitude,
    longitude: p.longitude,
    point_type: p.point_type,
    ...(p.expected_at != null ? { expected_at: p.expected_at } : {}),
  }));

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

  const whenLine = request?.pickup_at
    ? [formatWeekday(request.pickup_at), formatCardDate(request.pickup_at), formatTime(request.pickup_at)]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={narrow ? "bottom" : "right"}
        className="admin-req-drawer data-[state=open]:duration-500 data-[state=closed]:duration-300"
        overlayClassName="admin-req-drawer__overlay data-[state=open]:duration-300 data-[state=closed]:duration-200"
      >
        <SheetHeader className="admin-req-drawer__head">
          <div className="admin-req-drawer__head-top">
            <div className="admin-req-drawer__identity min-w-0">
              <SheetTitle className="admin-req-drawer__title">
                {request?.requester_id ? (
                  <Link
                    to="/admin/employees/$employeeId"
                    params={{ employeeId: request.requester_id }}
                    className="admin-req__link"
                  >
                    {requesterName}
                  </Link>
                ) : (
                  requesterName
                )}
              </SheetTitle>
              {request ? (
                <p className="admin-req-drawer__phone">
                  {requesterPhone ? (
                    formatBdPhone(requesterPhone)
                  ) : (
                    <span className={attnClass("danger")}>No phone</span>
                  )}
                </p>
              ) : null}
            </div>
            {canReject && user ? (
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
          <SheetDescription className="sr-only">Request details</SheetDescription>
          {request ? (
            <div className="admin-req-drawer__head-meta">
              <div className="admin-req__chips">
                <LookupChip group="request_status" value={request.status} pill />
                {trip ? <LookupChip group="trip_status" value={trip.status} pill /> : null}
                <span className="admin-req__pill">{passengerLabel(request.passenger_count)}</span>
                <span className="admin-req__pill">{tripType.label}</span>
                {tripLive ? <span className="admin-req__pill admin-req__pill--live">Live</span> : null}
              </div>
              {whenLine ? <p className="admin-req-drawer__when-line">{whenLine}</p> : null}
            </div>
          ) : null}
        </SheetHeader>

        {isLoading ? (
          <div className="admin-req-drawer__body">
            <DetailPageSkeleton />
          </div>
        ) : !request ? (
          <div className="admin-req-drawer__body">
            <EmptyState title="Request not found" />
          </div>
        ) : (
          <div className="admin-req admin-req--drawer">
            <div className="admin-req-drawer__scroll">
              <section className="admin-req__route" aria-label="Route">
                <p className="admin-req__section-label">Route</p>
                {mapPoints.length === 0 ? (
                  <p className="ride-detail__muted">No route points.</p>
                ) : (
                  <RouteFlow
                    points={mapPoints}
                    {...(tripLive ? { focusIndex: focusIdx } : {})}
                  />
                )}
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

              {canAssign ? (
                <section className="admin-req__card admin-req__card--assign admin-req__card--assign-hot">
                  <div className="admin-req__assign-banner">
                    <p className="admin-req__section-label">Assign driver</p>
                    <span className="admin-req__assign-cta attn attn--warn">Needs dispatch</span>
                  </div>
                  <AssignmentPanel
                    requestId={requestId}
                    passengers={request.passenger_count}
                    {...(request.journey_date ? { journeyDate: request.journey_date } : {})}
                    pickupAt={request.pickup_at}
                    expectedEnd={request.expected_end_at ?? request.pickup_at}
                    disabled={false}
                  />
                </section>
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
                    <section className="admin-req__card--assign-hot admin-req__card--assign-nested">
                      <AssignmentPanel
                        requestId={requestId}
                        passengers={request.passenger_count}
                        {...(request.journey_date ? { journeyDate: request.journey_date } : {})}
                        pickupAt={request.pickup_at}
                        expectedEnd={request.expected_end_at ?? request.pickup_at}
                        changeMode
                        initialVehicleId={request.assigned_vehicle_id ?? request.vehicles?.id}
                        initialDriverId={request.assigned_driver_id ?? request.drivers?.id}
                        onAssigned={() => setChangeAssign(false)}
                      />
                    </section>
                  )}
                </section>
              ) : null}

              {trip && historyRows.length > 0 ? (
                <section className="admin-req__card">
                  <p className="admin-req__section-label">Trip progress</p>
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
                  </ul>
                </section>
              ) : null}

              {auditRows.length > 0 ? (
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
                  </ul>
                </details>
              ) : null}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
