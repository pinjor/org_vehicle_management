import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { KpiCard, Panel, StatusChip, EmptyState } from "@/components/fleet-ui";
import { useAuth } from "@/lib/auth";
import { useActiveTrips, useDrivers, useRequests, useVehicles } from "@/lib/queries";
import { REQUEST_STATUS, TRIP_STATUS, formatDateTime, relativeTime } from "@/lib/fleet";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Operations overview — FleetOps" },
      {
        name: "description",
        content: "Live view of pending vehicle requests, fleet availability and trips in progress.",
      },
      { property: "og:title", content: "Operations overview — FleetOps" },
      {
        property: "og:description",
        content: "Pending requests, vehicle and driver availability, and journeys in progress.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { isDispatcher, user } = useAuth();
  const requests = useRequests(isDispatcher || !user ? undefined : { requesterId: user.id });
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const trips = useActiveTrips();

  const rows = requests.data ?? [];
  const pending = rows.filter((r) => ["submitted", "under_review"].includes(r.status));
  const approved = rows.filter((r) => r.status === "approved");
  const availableVehicles = (vehicles.data ?? []).filter((v) => v.operational_status === "available");
  const availableDrivers = (drivers.data ?? []).filter((d) => d.current_status === "available");

  return (
    <AppShell
      title="Operations overview"
      subtitle="Requests, availability and journeys happening right now"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Awaiting action" value={pending.length} hint="Submitted or under review" tone="warning" />
        <KpiCard label="Approved, unassigned" value={approved.length} hint="Ready for dispatch" tone="info" />
        <KpiCard
          label="Vehicles available"
          value={`${availableVehicles.length}/${vehicles.data?.length ?? 0}`}
          hint="Across all branches"
          tone="success"
        />
        <KpiCard
          label="Drivers available"
          value={`${availableDrivers.length}/${drivers.data?.length ?? 0}`}
          hint="On duty and unassigned"
          tone="primary"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Upcoming journeys" description="Next requests by pickup time" bodyClassName="p-0">
          {rows.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No requests yet" description="Raise your first vehicle request to get started." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.slice(0, 8).map((r) => (
                <li key={r.id}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {r.reference} · {r.purpose}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(r.pickup_at)} · {relativeTime(r.pickup_at)} · {r.passenger_count} pax
                      </p>
                    </div>
                    <StatusChip
                      label={REQUEST_STATUS[r.status]?.label ?? r.status}
                      tone={REQUEST_STATUS[r.status]?.tone}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Trips in progress" bodyClassName="p-0">
          {(trips.data ?? []).length === 0 ? (
            <div className="p-4">
              <EmptyState title="No live trips" description="Assigned journeys will appear here as they start." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(trips.data ?? []).slice(0, 8).map((t) => (
                <li key={t.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{t.reference}</p>
                    <StatusChip label={TRIP_STATUS[t.status]?.label ?? t.status} tone={TRIP_STATUS[t.status]?.tone} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.vehicles?.registration_number} · {t.drivers?.full_name}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}