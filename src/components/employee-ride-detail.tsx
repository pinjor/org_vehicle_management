import { Link } from "@tanstack/react-router";
import { ArrowLeft, Car, User } from "lucide-react";
import { toast } from "sonner";
import { LiveTripMap } from "@/components/live-trip-map";
import { LookupChip } from "@/components/lookup-chip";
import { OsmRouteMap } from "@/components/osm-route-map";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { formatDateTime, relativeTime } from "@/lib/fleet";
import { useLookupEntry } from "@/lib/lookups-context";
import type { LatLng } from "@/lib/osm";
import {
  formatPickupLabel,
  pointTone,
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
import { cn } from "@/lib/utils";

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
      <div className="plan-ride ride-detail">
        <header className="plan-ride__top">
          <Link to="/requests" className="plan-ride__back" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="plan-ride__title">Ride details</h1>
          <span className="plan-ride__top-spacer" aria-hidden />
        </header>
        <p className="ride-detail__muted">Loading…</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="plan-ride ride-detail">
        <header className="plan-ride__top">
          <Link to="/requests" className="plan-ride__back" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="plan-ride__title">Ride details</h1>
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
  const canCancel = !!user && !["completed", "cancelled"].includes(request.status);

  return (
    <div className="plan-ride ride-detail">
      <header className="plan-ride__top">
        <Link to="/requests" className="plan-ride__back" aria-label="Back">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="plan-ride__title">Ride details</h1>
        <span className="plan-ride__top-spacer" aria-hidden />
      </header>

      <div className="ride-detail__ref">
        <span className="ride-detail__ref-code">{request.reference}</span>
        <LookupChip group="request_status" value={request.status} pill />
      </div>

      <div className="plan-ride__pills">
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

      <div className="plan-ride__route-wrap">
        <div className="plan-ride__route">
          {mapPoints.length === 0 ? (
            <p className="ride-detail__muted p-3">No route points.</p>
          ) : (
            mapPoints.map((p, i) => (
              <div key={`${p.point_type}-${i}`} className="plan-ride__stop">
                <span className={cn("plan-ride__dot", `plan-ride__dot--${pointTone(p.point_type)}`)} />
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
        <div className="ride-detail__purpose">
          <p className="ride-detail__purpose-label">Purpose</p>
          <p className="ride-detail__purpose-text">{request.purpose}</p>
        </div>
      ) : null}

      {mapPoints.length > 0 ? (
        <section className="ride-detail__map">
          {tripLive ? (
            <LiveTripMap
              mapOnly
              className="ride-detail__map-el"
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
              className="ride-detail__map-el"
              points={mapPoints}
              focusIndex={focusIdx}
            />
          )}
        </section>
      ) : null}

      <section className="ride-detail__card">
        <p className="ride-detail__card-title">Assignment</p>
        {isAssigned ? (
          <div className="ride-detail__assign-grid">
            <div className="ride-detail__assign-row">
              <span className="ride-detail__assign-icon">
                <Car className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="ride-detail__assign-name">{request.vehicles?.name ?? "—"}</span>
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
                <span className="ride-detail__assign-name">{request.drivers?.full_name ?? "—"}</span>
                <span className="ride-detail__assign-sub">{request.drivers?.phone ?? "Driver"}</span>
              </span>
            </div>
            {request.assigned_at ? (
              <p className="ride-detail__assign-meta">
                Assigned {formatDateTime(request.assigned_at)} · {relativeTime(request.assigned_at)}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="ride-detail__muted">
            Waiting for dispatch — vehicle and driver show up here once assigned.
          </p>
        )}
      </section>

      {trip ? (
        <section className="ride-detail__card">
          <p className="ride-detail__card-title">
            Trip progress{trip.reference ? ` · ${trip.reference}` : ""}
          </p>
          {tripLive && externalPos ? <p className="ride-detail__live">Live tracking on</p> : null}
          <ul className="ride-detail__history">
            {((history.data ?? []) as { id: string; to_status: string; created_at: string }[]).map(
              (h, i, arr) => (
                <li key={h.id} className="ride-detail__history-row">
                  <LookupChip group="trip_status" value={h.to_status} dot={false} />
                  <span className="ride-detail__history-time">
                    {i === arr.length - 1 ? "Now · " : ""}
                    {formatDateTime(h.created_at)}
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
        <div className="plan-ride__footer">
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
  );
}
