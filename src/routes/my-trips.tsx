import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Panel, RouteTimeline, StatusChip } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useAdvanceTrip, useDriverTrips, useReportVehicleIssue } from "@/lib/queries";
import { TRIP_STATUS, formatDateTime, nextDriverActions, relativeTime } from "@/lib/fleet";

export const Route = createFileRoute("/my-trips")({
  head: () => ({
    meta: [
      { title: "My trips — FleetOps" },
      { name: "description", content: "Driver view: confirm assignments, move through each trip stage and report vehicle issues." },
      { property: "og:title", content: "My trips — FleetOps" },
      { property: "og:description", content: "Step through assigned journeys and report problems from the road." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyTripsPage,
});

function MyTripsPage() {
  const { driverId, user } = useAuth();
  const { data, isLoading } = useDriverTrips(driverId ?? undefined);
  const advance = useAdvanceTrip();
  const report = useReportVehicleIssue();
  const [issue, setIssue] = useState<Record<string, string>>({});

  if (!driverId) {
    return (
      <AppShell title="My trips" subtitle="Driver interface">
        <EmptyState
          title="No driver profile linked"
          description="This account is not linked to a driver record, so no trips are assigned to it."
        />
      </AppShell>
    );
  }

  const trips = (data ?? []).filter((t) => !["completed", "cancelled"].includes(t.status));
  const past = (data ?? []).filter((t) => ["completed", "cancelled"].includes(t.status));

  return (
    <AppShell title="My trips" subtitle="Confirm, progress and close out your journeys">
      {isLoading && <p className="text-sm text-muted-foreground">Loading trips…</p>}
      {!isLoading && trips.length === 0 && (
        <EmptyState title="No active trips" description="New assignments will appear here immediately." />
      )}

      <div className="space-y-4">
        {trips.map((t) => {
          const request = t.vehicle_requests;
          const points = (request?.request_route_points ?? []).slice().sort((a, b) => a.sequence - b.sequence);
          const actions = nextDriverActions(t.status, points.length > 2, request?.is_round_trip ?? false);
          return (
            <Panel
              key={t.id}
              title={`${t.reference} · ${request?.purpose ?? ""}`}
              description={`${formatDateTime(request?.pickup_at)} · ${relativeTime(request?.pickup_at)}`}
              action={<StatusChip label={TRIP_STATUS[t.status]?.label ?? t.status} tone={TRIP_STATUS[t.status]?.tone} />}
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {t.vehicles?.name} · {t.vehicles?.registration_number} · {request?.passenger_count} passengers
                  </p>
                  {points.length ? (
                    <RouteTimeline
                      points={points.map((p) => ({
                        name: p.name,
                        address: p.address,
                        point_type: p.point_type,
                        expected_at: p.expected_at,
                      }))}
                      activeIndex={t.current_stop_index}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No route points recorded.</p>
                  )}
                  {(request?.request_passengers ?? []).length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {(request?.request_passengers ?? []).map((p) => (
                        <li key={p.id}>
                          {p.full_name} {p.phone ? `· ${p.phone}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {actions.map((a) => (
                      <Button
                        key={a.action}
                        variant={a.primary ? "default" : "outline"}
                        disabled={advance.isPending}
                        onClick={() =>
                          advance.mutate(
                            { tripId: t.id, action: a.action },
                            {
                              onSuccess: () => toast.success(a.label),
                              onError: (e) => toast.error(e.message),
                            },
                          )
                        }
                      >
                        {a.label}
                      </Button>
                    ))}
                    {actions.length === 0 && (
                      <p className="text-sm text-muted-foreground">Waiting for the next stage.</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-dashed border-border p-3">
                    <p className="text-xs font-medium">Report a vehicle problem</p>
                    <Textarea
                      rows={2}
                      className="mt-2"
                      placeholder="Describe the issue"
                      value={issue[t.id] ?? ""}
                      onChange={(e) => setIssue((s) => ({ ...s, [t.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={report.isPending || !user}
                      onClick={() =>
                        report.mutate(
                          {
                            vehicleId: t.vehicle_id,
                            driverId,
                            tripId: t.id,
                            reason: "breakdown",
                            description: issue[t.id] ?? "",
                            severity: "high",
                            actorId: user!.id,
                          },
                          {
                            onSuccess: () => {
                              toast.success("Reported to the transport desk");
                              setIssue((s) => ({ ...s, [t.id]: "" }));
                            },
                            onError: (e) => toast.error(e.message),
                          },
                        )
                      }
                    >
                      Send report
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      {past.length > 0 && (
        <Panel className="mt-4" title="Recent history" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {past.slice(0, 10).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm">{t.reference}</span>
                <StatusChip label={TRIP_STATUS[t.status]?.label ?? t.status} tone={TRIP_STATUS[t.status]?.tone} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </AppShell>
  );
}
