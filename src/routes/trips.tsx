import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RequestListSkeleton } from "@/components/loading-skeletons";
import { LookupChip } from "@/components/lookup-chip";
import { ChipGroup, EmptyState, FilterBar, MetaChip, Panel } from "@/components/fleet-ui";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { formatDateTime, relativeTime } from "@/lib/fleet";
import { useFleetTrips } from "@/lib/queries";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [
      { title: "Trips — FleetOps" },
      { name: "description", content: "Browse completed and historical fleet trips." },
    ],
  }),
  component: TripsPage,
});

type TripFilter = "completed" | "active" | "cancelled" | "all";

function TripsPage() {
  const { isDispatcher } = useAuth();
  const [filter, setFilter] = useState<TripFilter>("completed");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useFleetTrips(filter);

  const rows = useMemo(() => {
    const all = data ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((t) =>
      `${t.reference} ${t.vehicle_requests?.purpose ?? ""} ${t.vehicle_requests?.requester_name ?? ""} ${t.drivers?.full_name ?? ""} ${t.vehicles?.registration_number ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [data, search]);

  if (!isDispatcher) {
    return (
      <AppShell title="Trips" subtitle="Dispatch only">
        <EmptyState compact title="Not available" description="Trip history is for dispatch and admin." />
      </AppShell>
    );
  }

  const filterOptions = [
    { value: "completed", label: "Completed", tone: "success" as const },
    { value: "active", label: "Live", tone: "info" as const },
    { value: "cancelled", label: "Cancelled", tone: "danger" as const },
    { value: "all", label: "All", tone: "neutral" as const },
  ];

  return (
    <AppShell title="Trips" subtitle="Completed and historical assignments">
      <div className="role-dashboard page-stack min-w-0 w-full max-w-full">
        <Panel tone="primary" compact className="min-w-0 max-w-full" bodyClassName="p-0 min-w-0 max-w-full overflow-hidden">
          <div className="min-w-0 max-w-full space-y-2.5 overflow-hidden border-b border-border p-3 sm:p-3.5">
            <FilterBar
              value={filter}
              onChange={(v) => setFilter(v as TripFilter)}
              options={filterOptions}
              label="Filter trips"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, driver, vehicle, requester…"
              className="h-9 min-w-0 w-full"
            />
          </div>

          {isLoading ? (
            <RequestListSkeleton />
          ) : rows.length === 0 ? (
            <div className="p-3">
              <EmptyState
                compact
                title="No trips match"
                description={
                  filter === "completed"
                    ? "Completed trips will appear here after drivers finish assignments."
                    : "Try a different filter."
                }
              />
            </div>
          ) : (
            <ul key={`${filter}-${search}`} className="list-stagger space-y-2 p-3">
              {rows.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/requests/$requestId"
                    params={{ requestId: t.request_id }}
                    className="block rounded-xl border border-border bg-surface px-3 py-3 transition-colors hover:bg-muted/40 sm:px-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {t.reference}
                          {t.vehicle_requests?.purpose ? ` · ${t.vehicle_requests.purpose}` : ""}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {t.vehicle_requests?.requester_name ?? "—"}
                          {t.drivers?.full_name ? ` · ${t.drivers.full_name}` : ""}
                        </p>
                      </div>
                      <LookupChip group="trip_status" value={t.status} />
                    </div>
                    <ChipGroup className="mt-2">
                      {t.vehicles?.registration_number && (
                        <MetaChip label={t.vehicles.registration_number} tone="primary" />
                      )}
                      {t.vehicles?.name && !t.vehicles.registration_number && (
                        <MetaChip label={t.vehicles.name} tone="primary" />
                      )}
                      {t.vehicle_requests?.reference && (
                        <MetaChip label={t.vehicle_requests.reference} tone="neutral" />
                      )}
                    </ChipGroup>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {t.completed_at
                        ? `Completed ${formatDateTime(t.completed_at)} · ${relativeTime(t.completed_at)}`
                        : `Created ${formatDateTime(t.created_at)} · ${relativeTime(t.created_at)}`}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
