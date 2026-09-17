import { Car, User } from "lucide-react";
import { toast } from "sonner";
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
import { formatTime, formatWeekday, passengerLabel } from "@/lib/fleet";
import { useLookupEntry } from "@/lib/lookups-context";
import { formatBdPhone } from "@/lib/phone";
import { useCancelRequest, useRequest, useTripHistory } from "@/lib/queries";
import {
  trackFocusIndex,
  type RoutePoint,
  type TripLike,
} from "@/lib/ride-detail";
import { useNarrowDrawer } from "@/lib/use-narrow-drawer";

/** Employee request drawer — mount on /requests via search `request`. */
export function EmployeeRideDetail({
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
  const cancel = useCancelRequest();
  const { user } = useAuth();

  const request = data?.request;
  const tripRel = request?.trips as unknown;
  const trip = (Array.isArray(tripRel) ? tripRel[0] : tripRel) as TripLike | undefined;
  const tripLive = !!trip && !["completed", "cancelled", "breakdown"].includes(trip.status);
  const history = useTripHistory(trip?.id);
  const tripType = useLookupEntry("trip_type", request?.trip_type);

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

  const isAssigned = !!(
    request?.vehicles ||
    request?.drivers ||
    request?.assigned_driver_id ||
    request?.assigned_vehicle_id
  );
  const ended = !!request && ["completed", "cancelled"].includes(request.status);
  const canCancel = !!user && !!request && !ended;
  const waiting = !!request && ["submitted", "approved"].includes(request.status) && !isAssigned;
  const driverPhone = request?.drivers?.phone?.trim() || null;
  const vehicleLabel = request?.vehicles?.name ?? "—";
  const plate = request?.vehicles?.registration_number;
  const driverName = request?.drivers?.full_name ?? "—";

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
              <SheetTitle className="admin-req-drawer__title">Your ride</SheetTitle>
              {whenLine ? <p className="admin-req-drawer__when-line">{whenLine}</p> : null}
            </div>
            {canCancel ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ride-detail__reject-pill admin-req-drawer__cancel h-8 shrink-0"
                disabled={cancel.isPending}
                onClick={() =>
                  cancel.mutate(requestId, {
                    onSuccess: () => {
                      toast.success("Request cancelled");
                      onOpenChange(false);
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }
              >
                {cancel.isPending ? "…" : "Cancel"}
              </Button>
            ) : null}
          </div>
          <SheetDescription className="sr-only">Your vehicle request details</SheetDescription>
          {request ? (
            <div className="admin-req-drawer__head-meta">
              <div className="admin-req__chips">
                <LookupChip group="request_status" value={request.status} pill />
                {trip ? <LookupChip group="trip_status" value={trip.status} pill /> : null}
                <span className="admin-req__pill">{passengerLabel(request.passenger_count)}</span>
                <span className="admin-req__pill">{tripType.label}</span>
                {tripLive ? <span className="admin-req__pill admin-req__pill--live">Live</span> : null}
              </div>
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
              <section className="admin-req__card" aria-label={isAssigned ? "Your car" : "Assignment"}>
                <p className="admin-req__section-label">
                  {isAssigned ? "Your car" : "Assignment"}
                </p>
                {isAssigned ? (
                  <div className="admin-req__party">
                    <div className="admin-req__party-row">
                      <span className="admin-req__party-icon" aria-hidden>
                        <User className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="admin-req__pax-name">{driverName}</span>
                        <span className="admin-req__pax-miss">
                          {driverPhone ? formatBdPhone(driverPhone) : "Driver"}
                        </span>
                      </span>
                    </div>
                    <div className="admin-req__party-row">
                      <span className="admin-req__party-icon" aria-hidden>
                        <Car className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="admin-req__pax-name">{vehicleLabel}</span>
                        <span className="admin-req__pax-miss">{plate ?? "Vehicle"}</span>
                      </span>
                    </div>
                    {request.assigned_at ? (
                      <p className="admin-req__assign-meta">
                        Assigned <WhenStamp at={request.assigned_at} withRelative />
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="employee-ride__waiting">
                    {waiting ? "Waiting — we'll update you soon." : "Waiting."}
                  </p>
                )}
              </section>

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

              {request.purpose?.trim() ? (
                <div className="admin-req__facts">
                  <div className="admin-req__purpose">
                    <p className="admin-req__section-label">Purpose</p>
                    <p className="admin-req__purpose-text">{request.purpose}</p>
                  </div>
                </div>
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
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
