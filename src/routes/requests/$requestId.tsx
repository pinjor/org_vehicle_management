import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AssignmentPanel } from "@/components/assignment-panel";
import { DataRow, EmptyState, Panel, RouteTimeline, StatusChip } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useAuditTrail, useCancelRequest, useDecideRequest, useRequest, useTripHistory } from "@/lib/queries";
import { PRIORITY, REQUEST_STATUS, TRIP_STATUS, formatDateTime, relativeTime } from "@/lib/fleet";

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

function RequestDetailPage() {
  const { requestId } = Route.useParams();
  const { data, isLoading } = useRequest(requestId);
  const { isDispatcher, user } = useAuth();
  const decide = useDecideRequest();
  const cancel = useCancelRequest();
  const [reason, setReason] = useState("");

  const request = data?.request;
  const tripRel = request?.trips as unknown;
  const trip = (Array.isArray(tripRel) ? tripRel[0] : tripRel) as
    | (NonNullable<typeof request>["trips"] extends Array<infer T> ? T : NonNullable<typeof request>["trips"])
    | undefined;
  const history = useTripHistory(trip?.id);
  const audit = useAuditTrail(requestId);

  if (isLoading || !request) {
    return (
      <AppShell title="Request" subtitle="Loading…">
        <p className="text-sm text-muted-foreground">Loading request…</p>
      </AppShell>
    );
  }

  const canDecide = isDispatcher && ["submitted", "under_review"].includes(request.status);
  const canAssign = isDispatcher && ["approved", "submitted", "under_review"].includes(request.status) && !trip;

  return (
    <AppShell
      title={`${request.reference}`}
      subtitle={request.purpose}
      actions={
        <div className="flex items-center gap-2">
          <StatusChip label={PRIORITY[request.priority]?.label ?? request.priority} tone={PRIORITY[request.priority]?.tone} />
          <StatusChip label={REQUEST_STATUS[request.status]?.label ?? request.status} tone={REQUEST_STATUS[request.status]?.tone} />
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <Panel title="Route">
            {data.points.length ? (
              <RouteTimeline
                points={data.points.map((p) => ({
                  name: p.name,
                  address: p.address,
                  point_type: p.point_type,
                  expected_at: p.expected_at,
                }))}
                activeIndex={trip?.current_stop_index ?? -1}
              />
            ) : (
              <EmptyState title="No route points" description="This request was created without stop details." />
            )}
          </Panel>

          {isDispatcher && (
            <Panel title="Recommended vehicle and driver" description="Ranked by the matching engine">
              <AssignmentPanel
                requestId={requestId}
                passengers={request.passenger_count}
                expectedEnd={request.expected_end_at}
                disabled={!canAssign}
              />
            </Panel>
          )}

          {trip && (
            <Panel title="Trip progress" description={trip.reference}>
              <div className="mb-3">
                <StatusChip label={TRIP_STATUS[trip.status]?.label ?? trip.status} tone={TRIP_STATUS[trip.status]?.tone} />
              </div>
              <ul className="space-y-2 text-sm">
                {(history.data ?? []).map((h) => (
                  <li key={h.id} className="flex justify-between gap-3">
                    <span>{TRIP_STATUS[h.to_status]?.label ?? h.to_status}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>
                  </li>
                ))}
                {(history.data ?? []).length === 0 && (
                  <li className="text-xs text-muted-foreground">No status changes recorded yet.</li>
                )}
              </ul>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Summary">
            <DataRow label="Requester" value={request.requester_name} />
            <DataRow label="Department" value={request.departments?.name ?? "—"} />
            <DataRow label="Cost center" value={request.cost_center || "—"} />
            <DataRow label="Trip type" value={request.trip_type.replace(/_/g, " ")} />
            <DataRow label="Pickup" value={`${formatDateTime(request.pickup_at)} · ${relativeTime(request.pickup_at)}`} />
            <DataRow label="Expected end" value={formatDateTime(request.expected_end_at)} />
            <DataRow label="Passengers" value={request.passenger_count} />
            <DataRow label="Category" value={request.requested_category ?? "Any"} />
            <DataRow label="AC required" value={request.requires_ac ? "Yes" : "No"} />
            {request.special_requirements && <DataRow label="Special" value={request.special_requirements} />}
          </Panel>

          <Panel title="Assignment">
            {request.vehicles || request.drivers ? (
              <>
                <DataRow label="Vehicle" value={`${request.vehicles?.name ?? "—"} · ${request.vehicles?.registration_number ?? ""}`} />
                <DataRow label="Driver" value={request.drivers?.full_name ?? "—"} />
                <DataRow label="Driver phone" value={request.drivers?.phone ?? "—"} />
                <DataRow label="Assigned at" value={formatDateTime(request.assigned_at)} />
              </>
            ) : (
              <EmptyState title="Not assigned yet" description="Pick a recommended pair to dispatch this request." />
            )}
          </Panel>

          {data.passengers.length > 0 && (
            <Panel title="Passengers">
              <ul className="space-y-1 text-sm">
                {data.passengers.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span>{p.full_name}</span>
                    <span className="text-xs text-muted-foreground">{p.phone ?? ""}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {canDecide && user && (
            <Panel title="Decision">
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

          {!["completed", "cancelled"].includes(request.status) && (
            <Button
              variant="outline"
              className="w-full"
              disabled={cancel.isPending}
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

          <Panel title="Audit trail" bodyClassName="p-0">
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
