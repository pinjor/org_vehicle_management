import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AssignmentPanel } from "@/components/assignment-panel";
import { EmptyState, KpiCard, Panel, StatusChip } from "@/components/fleet-ui";
import { useActiveTrips, useRequests } from "@/lib/queries";
import { PRIORITY, REQUEST_STATUS, TRIP_STATUS, formatDateTime, relativeTime } from "@/lib/fleet";

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "Dispatch console — FleetOps" },
      { name: "description", content: "Assign vehicles and drivers to approved requests using ranked recommendations, and watch live trips." },
      { property: "og:title", content: "Dispatch console — FleetOps" },
      { property: "og:description", content: "Ranked vehicle and driver matching with live trip monitoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DispatchPage,
});

function DispatchPage() {
  const { data } = useRequests();
  const trips = useActiveTrips();
  const queue = (data ?? []).filter((r) => ["submitted", "under_review", "approved"].includes(r.status));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = queue.find((r) => r.id === selectedId) ?? queue[0];

  return (
    <AppShell title="Dispatch console" subtitle="Match the queue to available vehicles and drivers">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Dispatch queue" value={queue.length} hint="Waiting for a vehicle" tone="warning" />
        <KpiCard label="Live trips" value={(trips.data ?? []).length} hint="Currently on the road" tone="success" />
        <KpiCard
          label="Emergency / VIP"
          value={queue.filter((r) => ["emergency", "vip"].includes(r.priority)).length}
          hint="Priority handling"
          tone="danger"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Panel title="Queue" description="Sorted by pickup time" bodyClassName="p-0">
          {queue.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Queue is clear" description="Every request has a vehicle and driver." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {queue.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className={
                      "w-full px-4 py-3 text-left hover:bg-accent/50 " +
                      (selected?.id === r.id ? "bg-accent/60" : "")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{r.reference}</p>
                      <StatusChip label={PRIORITY[r.priority]?.label ?? r.priority} tone={PRIORITY[r.priority]?.tone} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{r.purpose}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(r.pickup_at)} · {relativeTime(r.pickup_at)} · {r.passenger_count} pax ·{" "}
                      {REQUEST_STATUS[r.status]?.label}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel
            title={selected ? `Recommendations · ${selected.reference}` : "Recommendations"}
            {...(selected?.purpose ? { description: selected.purpose } : {})}
            action={
              selected && (
                <Link
                  to="/requests/$requestId"
                  params={{ requestId: selected.id }}
                  className="text-xs text-primary hover:underline"
                >
                  Open request
                </Link>
              )
            }
          >
            {selected ? (
              <AssignmentPanel
                requestId={selected.id}
                passengers={selected.passenger_count}
                expectedEnd={selected.expected_end_at}
              />
            ) : (
              <EmptyState title="Nothing selected" description="Pick a request from the queue." />
            )}
          </Panel>

          <Panel title="Live trips" bodyClassName="p-0">
            {(trips.data ?? []).length === 0 ? (
              <div className="p-4">
                <EmptyState title="No live trips" description="Assigned journeys appear here once dispatched." />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {(trips.data ?? []).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.reference}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.vehicles?.registration_number} · {t.drivers?.full_name} · {t.drivers?.phone}
                      </p>
                    </div>
                    <StatusChip label={TRIP_STATUS[t.status]?.label ?? t.status} tone={TRIP_STATUS[t.status]?.tone} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
