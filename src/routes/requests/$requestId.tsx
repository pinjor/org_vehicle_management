import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AssignmentPanel } from "@/components/assignment-panel";
import { LiveTripMap } from "@/components/live-trip-map";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { LookupChip, LookupMetaChip } from "@/components/lookup-chip";
import { DataRow, ChipGroup, EmptyState, MetaChip, Panel, RouteTimeline, StatusChip } from "@/components/fleet-ui";
import { TripMap } from "@/components/trip-map";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
  useAuditTrail,
  useCancelRequest,
  useDecideRequest,
  useRequest,
  useTripHistory,
  useTripLocation,
} from "@/lib/queries";
import { formatDateTime, relativeTime } from "@/lib/fleet";
import type { LatLng } from "@/lib/osm";

export const Route = createFileRoute("/requests/$requestId")({
  head: () => ({
    meta: [
      { title: "Request detail — FleetOps" },
      { name: "description", content: "Full request record: route, passengers, assignment, trip progress and audit trail." },
      { property: "og:title", content: "Request detail — FleetOps" },
      { property: "og:description", content: "Review, approve and dispatch an individual vehicle request." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestDetailPage,
});

type TripLike = {
  id: string;
  reference?: string;
  status: string;
  current_stop_index?: number;
};

function trackFocusIndex(status: string, points: { point_type: string }[], stopIndex = 0) {
  const pickupIdx = points.findIndex((p) => p.point_type === "pickup");
  const destIdx = points.findIndex((p) => p.point_type === "destination");
  const stopIndices = points
    .map((p, i) => (p.point_type === "stop" ? i : -1))
    .filter((i) => i >= 0);
  if (["driver_assigned", "driver_confirmed", "heading_to_pickup", "arrived_pickup"].includes(status)) {
    return Math.max(0, pickupIdx);
  }
  if (["passenger_picked_up", "in_transit", "stop_reached"].includes(status)) {
    if (stopIndex < stopIndices.length) return stopIndices[stopIndex]!;
    return Math.max(0, destIdx >= 0 ? destIdx : points.length - 1);
  }
  return Math.max(0, destIdx >= 0 ? destIdx : 0);
}

function RequestDetailPage() {
  const { requestId } = Route.useParams();
  const { data, isLoading } = useRequest(requestId);
  const { isDispatcher, user } = useAuth();
  const decide = useDecideRequest();
  const cancel = useCancelRequest();
  const [reason, setReason] = useState("");

  const request = data?.request;
  const tripRel = request?.trips as unknown;
  const trip = (Array.isArray(tripRel) ? tripRel[0] : tripRel) as TripLike | undefined;
  const tripLive =
    !!trip && !["completed", "cancelled", "breakdown"].includes(trip.status);
  const history = useTripHistory(trip?.id);
  const loc = useTripLocation(trip?.id, tripLive);
  const audit = useAuditTrail(requestId);

  if (isLoading) {
    return (
      <AppShell title="Request" subtitle="Loading…">
        <DetailPageSkeleton />
      </AppShell>
    );
  }

  if (!request) {
    return (
      <AppShell title="Request" subtitle="Not found">
        <EmptyState title="Request not found" />
      </AppShell>
    );
  }

  const canDecide = isDispatcher && ["submitted", "under_review"].includes(request.status);
  const canAssign = isDispatcher && ["approved", "submitted", "under_review"].includes(request.status) && !trip;
  const isAssigned = !!(request.vehicles || request.drivers || request.assigned_driver_id || request.assigned_vehicle_id);

  const mapPoints = (data.points ?? []).map((p: {
    name: string;
    address?: string;
    latitude: number | null;
    longitude: number | null;
    point_type: string;
    expected_at?: string | null;
  }) => ({
    name: p.name,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    point_type: p.point_type,
    expected_at: p.expected_at,
  }));

  const externalPos: LatLng | null =
    loc.data?.latitude != null && loc.data?.longitude != null
      ? [Number(loc.data.latitude), Number(loc.data.longitude)]
      : null;
  const trail: LatLng[] = (loc.data?.trail ?? []).map((p) => [p.lat, p.lng] as LatLng);
  const focusIdx = trip ? trackFocusIndex(trip.status, mapPoints, trip.current_stop_index ?? 0) : 0;

  return (
    <AppShell
      title={`${request.reference}`}
      subtitle={request.purpose}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <LookupChip group="priority" value={request.priority} />
          <LookupChip group="request_status" value={request.status} />
        </div>
      }
    >
      <div className="detail-split">
        <div>
          <Panel
            title={tripLive ? "Live route" : "Route"}
            description={
              tripLive
                ? request.drivers?.full_name
                  ? `Tracking · ${request.drivers.full_name}`
                  : "Tracking driver position"
                : undefined
            }
            tone="primary"
            compact
            bodyClassName="p-3"
          >
            {mapPoints.length ? (
              <>
                {tripLive ? (
                  <LiveTripMap
                    className="mb-3 h-52 w-full sm:h-64"
                    points={mapPoints}
                    focusIndex={focusIdx}
                    externalPosition={externalPos}
                    trail={trail}
                    markerLabel={request.drivers?.full_name ?? "Driver"}
                  />
                ) : (
                  <TripMap
                    className="mb-3 h-52 w-full sm:h-64"
                    points={mapPoints}
                  />
                )}
                <RouteTimeline
                  points={mapPoints.map((p) => ({
                    name: p.name,
                    address: p.address,
                    point_type: p.point_type,
                    expected_at: p.expected_at,
                  }))}
                  activeIndex={trip?.current_stop_index ?? -1}
                />
              </>
            ) : (
              <EmptyState compact title="No route points" description="This request was created without stop details." />
            )}
          </Panel>

          {isDispatcher && canAssign && (
            <Panel
              title="Recommended vehicle and driver"
              description="Ranked by the matching engine"
              tone="info"
              compact
              bodyClassName="p-3"
            >
              <AssignmentPanel
                requestId={requestId}
                passengers={request.passenger_count}
                expectedEnd={request.expected_end_at}
                disabled={false}
              />
            </Panel>
          )}

          {trip && (
            <Panel title="Trip progress" description={trip.reference} tone="success" compact bodyClassName="p-3">
              {tripLive && externalPos && (
                <div className="mb-2">
                  <MetaChip label="Live tracking" tone="info" />
                </div>
              )}
              <ul className="space-y-2 text-sm">
                {((history.data ?? []) as { id: string; to_status: string; created_at: string }[]).map((h, i, arr) => (
                  <li key={h.id} className="flex items-center justify-between gap-3">
                    <LookupChip group="trip_status" value={h.to_status} dot={false} />
                    <span className="text-xs text-muted-foreground">
                      {i === arr.length - 1 ? "Now · " : ""}
                      {formatDateTime(h.created_at)}
                    </span>
                  </li>
                ))}
                {(history.data ?? []).length === 0 && (
                  <li className="flex items-center justify-between gap-3">
                    <LookupChip group="trip_status" value={trip.status} dot={false} />
                    <span className="text-xs text-muted-foreground">Current</span>
                  </li>
                )}
              </ul>
            </Panel>
          )}
        </div>

        <div>
          <Panel title="Summary" tone="neutral" compact bodyClassName="p-3">
            <DataRow label="Requester" value={request.requester_name} />
            <DataRow
              label="Department"
              value={request.departments?.name ? <MetaChip label={request.departments.name} tone="info" /> : "—"}
            />
            <DataRow label="Cost center" value={request.cost_center ? <MetaChip label={request.cost_center} tone="neutral" /> : "—"} />
            <DataRow
              label="Trip type"
              value={<LookupMetaChip group="trip_type" value={request.trip_type} />}
            />
            <DataRow
              label="Pickup"
              value={
                <ChipGroup>
                  <MetaChip label={formatDateTime(request.pickup_at)} tone="primary" />
                  <MetaChip label={relativeTime(request.pickup_at)} tone="info" />
                </ChipGroup>
              }
            />
            <DataRow label="Expected end" value={<MetaChip label={formatDateTime(request.expected_end_at)} tone="neutral" />} />
            <DataRow label="Passengers" value={<MetaChip label={`${request.passenger_count} pax`} tone="info" />} />
            <DataRow
              label="Category"
              value={<LookupMetaChip group="vehicle_category" value={request.requested_category} fallback="Any category" />}
            />
            <DataRow
              label="AC required"
              value={<StatusChip label={request.requires_ac ? "Yes" : "No"} tone={request.requires_ac ? "success" : "neutral"} />}
            />
            {request.special_requirements && (
              <DataRow label="Special" value={<MetaChip label={request.special_requirements} tone="warning" />} />
            )}
          </Panel>

          {/* Employees: only after assign. Dispatchers: always (empty = waiting / assign from recommendations). */}
          {(isAssigned || isDispatcher) && (
            <Panel title="Assignment" tone="primary" compact bodyClassName={isAssigned ? "p-3" : "p-2.5"}>
              {isAssigned ? (
                <>
                  <div className="space-y-3 border-b border-border/60 pb-3">
                    <p className="text-xs font-medium text-muted-foreground">Vehicle</p>
                    {isDispatcher && request.vehicles?.id ? (
                      <Link
                        to="/fleet/$vehicleId"
                        params={{ vehicleId: request.vehicles.id }}
                        className="block rounded-lg border border-border bg-surface-2/50 px-4 py-3 transition-colors hover:bg-surface-2"
                      >
                        <p className="text-sm font-medium">{request.vehicles.name}</p>
                        <p className="text-xs text-muted-foreground">{request.vehicles.registration_number}</p>
                      </Link>
                    ) : (
                      <div className="rounded-lg border border-border bg-surface-2/50 px-4 py-3">
                        <p className="text-sm font-medium">{request.vehicles?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{request.vehicles?.registration_number}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 border-b border-border/60 py-3">
                    <p className="text-xs font-medium text-muted-foreground">Driver</p>
                    {isDispatcher && request.drivers?.id ? (
                      <Link
                        to="/drivers/$driverId"
                        params={{ driverId: request.drivers.id }}
                        className="block rounded-lg border border-border bg-surface-2/50 px-4 py-3 transition-colors hover:bg-surface-2"
                      >
                        <p className="text-sm font-medium">{request.drivers.full_name}</p>
                        <p className="text-xs text-muted-foreground">{request.drivers.phone ?? "No phone"}</p>
                      </Link>
                    ) : (
                      <div className="rounded-lg border border-border bg-surface-2/50 px-4 py-3">
                        <p className="text-sm font-medium">{request.drivers?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{request.drivers?.phone ?? "No phone"}</p>
                      </div>
                    )}
                  </div>
                  <DataRow label="Assigned at" value={formatDateTime(request.assigned_at)} />
                </>
              ) : (
                <EmptyState
                  compact
                  title="Not assigned yet"
                  description="Use recommendations above to assign a vehicle and driver."
                />
              )}
            </Panel>
          )}

          {!isAssigned && !isDispatcher && (
            <Panel title="Assignment" tone="primary" compact bodyClassName="p-2.5">
              <EmptyState
                compact
                title="Waiting for dispatch"
                description="You’ll see vehicle and driver details here once admin assigns your ride."
              />
            </Panel>
          )}

          {data.passengers.length > 0 && (
            <Panel title="Passengers" tone="info" compact bodyClassName="p-3">
              <ul className="space-y-2 text-sm">
                {data.passengers.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <MetaChip label={p.full_name} tone="primary" />
                    {p.phone && <MetaChip label={p.phone} tone="neutral" />}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {canDecide && user && (
            <Panel title="Decision" compact bodyClassName="p-3">
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Optional note or rejection reason"
              />
              <div className="mt-3 flex gap-2">
                <Button
                  className="flex-1"
                  disabled={decide.isPending}
                  tooltip="Approve this request — it moves to dispatch for vehicle assignment"
                  onClick={() =>
                    decide.mutate(
                      { requestId, approve: true, reason, actorId: user.id },
                      { onSuccess: () => toast.success("Request approved"), onError: (e) => toast.error(e.message) },
                    )
                  }
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={decide.isPending}
                  tooltip="Reject this request — add an optional reason above"
                  onClick={() =>
                    decide.mutate(
                      { requestId, approve: false, reason, actorId: user.id },
                      { onSuccess: () => toast.success("Request rejected"), onError: (e) => toast.error(e.message) },
                    )
                  }
                >
                  Reject
                </Button>
              </div>
            </Panel>
          )}

          {!isDispatcher && !["completed", "cancelled"].includes(request.status) && (
            <Button
              variant="outline"
              className="w-full"
              disabled={cancel.isPending}
              tooltip="Withdraw this request — only possible before the trip starts"
              onClick={() =>
                cancel.mutate(requestId, {
                  onSuccess: () => toast.success("Request cancelled"),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              Cancel request
            </Button>
          )}

          <Panel title="Audit trail" compact bodyClassName="p-0">
            <ul className="max-h-64 divide-y divide-border overflow-y-auto">
              {(audit.data ?? []).map((a) => (
                <li key={a.id} className="px-4 py-2 text-xs">
                  <p className="font-medium">{a.action.replace(/_/g, " ")}</p>
                  <p className="text-muted-foreground">
                    {a.actor_name ?? "System"} · {formatDateTime(a.created_at)}
                  </p>
                </li>
              ))}
              {(audit.data ?? []).length === 0 && (
                <li className="px-4 py-3 text-xs text-muted-foreground">No activity recorded.</li>
              )}
            </ul>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
