import { Link } from "@tanstack/react-router";
import { ArrowLeft, Car, User } from "lucide-react";
import { toast } from "sonner";
import { LiveTripMap } from "@/components/live-trip-map";
import { WhenBanner, WhenStamp, RouteFlow } from "@/components/info-blocks";
import { LookupChip } from "@/components/lookup-chip";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useLookupEntry } from "@/lib/lookups-context";
import { formatBdPhone } from "@/lib/phone";
import type { LatLng } from "@/lib/osm";
import {
  trackFocusIndex,
  type RoutePoint,
  type TripLike,
} from "@/lib/ride-detail";
import {
  useCancelRequest,
  useRequest,
  useTripHistory,
  useTripLocation,
} from "@/lib/queries";

export function EmployeeRideDetail({ requestId }: { requestId: string }) {
  const { data, isLoading } = useRequest(requestId);
  const cancel = useCancelRequest();
  const { user } = useAuth();

  const request = data?.request;
  const tripRel = request?.trips as unknown;
  const trip = (Array.isArray(tripRel) ? tripRel[0] : tripRel) as TripLike | undefined;
  const tripLive = !!trip && !["completed", "cancelled", "breakdown"].includes(trip.status);
  const history = useTripHistory(trip?.id);
  const loc = useTripLocation(trip?.id, tripLive);

  const tripType = useLookupEntry("trip_type", request?.trip_type);

  if (isLoading) {
    return (
      <div className="plan-ride ride-detail employee-ride">
        <header className="plan-ride__top">
          <Link to="/requests" className="plan-ride__back" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="plan-ride__title">Your ride</h1>
          <span className="plan-ride__top-spacer" aria-hidden />
        </header>
        <p className="ride-detail__muted">Loading…</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="plan-ride ride-detail employee-ride">
        <header className="plan-ride__top">
          <Link to="/requests" className="plan-ride__back" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="plan-ride__title">Your ride</h1>
          <span className="plan-ride__top-spacer" aria-hidden />
        </header>
        <p className="ride-detail__muted">Request not found.</p>
      </div>
    );
  }

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

  const isAssigned = !!(
    request.vehicles ||
    request.drivers ||
    request.assigned_driver_id ||
    request.assigned_vehicle_id
  );
  const ended = ["completed", "cancelled"].includes(request.status);
  const canCancel = !!user && !ended;
  const driverPhone = request.drivers?.phone?.trim() || null;
  const waiting = ["submitted", "approved"].includes(request.status) && !isAssigned;
  const vehicleLabel = request.vehicles?.name ?? "—";
  const plate = request.vehicles?.registration_number;
  const driverName = request.drivers?.full_name ?? "—";

  const metaBits = [
    request.purpose?.trim() || null,
    `${request.passenger_count} ${request.passenger_count === 1 ? "passenger" : "passengers"}`,
    tripType.label,
  ].filter(Boolean);

  return (
    <div className="plan-ride ride-detail employee-ride">
      <header className="plan-ride__top">
        <Link to="/requests" className="plan-ride__back" aria-label="Back">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="plan-ride__title">Your ride</h1>
        <span className="plan-ride__top-spacer" aria-hidden />
      </header>

      <div className="employee-ride__status-row">
        <LookupChip group="request_status" value={request.status} pill />
        <span className="employee-ride__ref">{request.reference}</span>
      </div>

      <div className="ride-detail__desk employee-ride__desk">
        <div className="ride-detail__desk-main employee-ride__main">
          <WhenBanner at={request.pickup_at} className="employee-ride__when" />

          <section className="employee-ride__people" aria-label={isAssigned ? "Your car" : "Assignment"}>
            <div className="employee-ride__people-head">
              <p className="employee-ride__section-label">
                {isAssigned ? "Your car" : "Assignment"}
              </p>
              {isAssigned && request.assigned_at ? (
                <p className="employee-ride__assign-meta">
                  Assigned <WhenStamp at={request.assigned_at} withRelative />
                </p>
              ) : null}
            </div>
            {isAssigned ? (
              <>
                <ul className="employee-ride__party-list">
                  <li className="employee-ride__party">
                    <span className="employee-ride__party-icon" aria-hidden>
                      <User className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="employee-ride__party-name">{driverName}</span>
                      {driverPhone ? (
                        <span className="employee-ride__party-phone">
                          {formatBdPhone(driverPhone)}
                        </span>
                      ) : (
                        <span className="employee-ride__party-role">Driver</span>
                      )}
                    </span>
                  </li>
                  <li className="employee-ride__party">
                    <span className="employee-ride__party-icon" aria-hidden>
                      <Car className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="employee-ride__party-name">{vehicleLabel}</span>
                      <span className="employee-ride__party-role">
                        {plate ?? "Vehicle"}
                      </span>
                    </span>
                  </li>
                </ul>
              </>
            ) : (
              <p className="employee-ride__waiting">
                {waiting
                  ? "Waiting — we'll update you soon."
                  : "Waiting."}
              </p>
            )}
          </section>

          <section className="employee-ride__route" aria-label="Route">
            <p className="employee-ride__section-label">Route</p>
            {mapPoints.length === 0 ? (
              <p className="ride-detail__muted employee-ride__route-empty">No route points.</p>
            ) : (
              <RouteFlow
                points={mapPoints}
                {...(tripLive ? { focusIndex: focusIdx } : {})}
              />
            )}
          </section>

          {metaBits.length > 0 ? (
            <p className="employee-ride__meta">{metaBits.join(" · ")}</p>
          ) : null}

          {trip ? (
            <section className="employee-ride__progress">
              <p className="employee-ride__section-label">
                Trip progress
                {tripLive && externalPos ? (
                  <span className="employee-ride__live"> · Live</span>
                ) : null}
              </p>
              <ul className="ride-detail__history">
                {((history.data ?? []) as { id: string; to_status: string; created_at: string }[]).map(
                  (h, i, arr) => (
                    <li key={h.id} className="ride-detail__history-row">
                      <LookupChip group="trip_status" value={h.to_status} dot={false} />
                      <span className="ride-detail__history-time">
                        {i === arr.length - 1 ? <span className="mr-1">Now ·</span> : null}
                        <WhenStamp at={h.created_at} />
                      </span>
                    </li>
                  ),
                )}
                {(history.data ?? []).length === 0 ? (
                  <li className="ride-detail__history-row">
                    <LookupChip group="trip_status" value={trip.status} dot={false} />
                    <span className="ride-detail__history-time">Current</span>
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}

          {canCancel ? (
            <div className="plan-ride__footer ride-detail__footer employee-ride__footer">
              <Button
                type="button"
                variant="outline"
                className="ride-detail__cancel"
                disabled={cancel.isPending}
                onClick={() =>
                  cancel.mutate(requestId, {
                    onSuccess: () => toast.success("Request cancelled"),
                    onError: (e) => toast.error(e.message),
                  })
                }
              >
                {cancel.isPending ? "Cancelling…" : "Cancel request"}
              </Button>
            </div>
          ) : null}
        </div>

        {tripLive && mapPoints.length > 0 ? (
          <aside className="ride-detail__desk-aside employee-ride__aside" aria-label="Live map">
            <section className="ride-detail__map employee-ride__map">
              <p className="employee-ride__map-label">Live map</p>
              <LiveTripMap
                mapOnly
                className="ride-detail__map-el employee-ride__map-el"
                points={mapPoints}
                focusIndex={focusIdx}
                externalPosition={externalPos}
                trail={trail}
                markerLabel={request.drivers?.full_name ?? "Driver"}
              />
            </section>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
