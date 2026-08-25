import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RequestListSkeleton } from "@/components/loading-skeletons";
import { LookupChip, LookupMetaChip } from "@/components/lookup-chip";
import { EmptyState, FilterBar, ChipGroup, MetaChip, Panel } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useLookupOptions } from "@/lib/lookups-context";
import { useRequests } from "@/lib/queries";
import { formatDateTime, relativeTime } from "@/lib/fleet";

export const Route = createFileRoute("/requests/")({
  head: () => ({
    meta: [
      { title: "Vehicle requests — FleetOps" },
      { name: "description", content: "Track every vehicle request from submission through approval, dispatch and completion." },
      { property: "og:title", content: "Vehicle requests — FleetOps" },
      { property: "og:description", content: "Browse, filter and open vehicle requests across departments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestsPage,
});

function RequestsPage() {
  const { isDispatcher, isDriver, isEmployee, user } = useAuth();
  const { data, isLoading } = useRequests(isDispatcher || !user ? undefined : { requesterId: user.id });
  const statusOptions = useLookupOptions("request_status");
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const allRows = data ?? [];
  const rows = allRows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return `${r.reference} ${r.purpose} ${r.requester_name}`.toLowerCase().includes(q);
  });

  const filterOptions = useMemo(() => {
    const counts = Object.fromEntries(
      ["all", ...statusOptions.map((o) => o.value_key)].map((f) => [
        f,
        f === "all" ? allRows.length : allRows.filter((r) => r.status === f).length,
      ]),
    );
    return [
      { value: "all", label: "All", tone: "neutral" as const, count: counts.all ?? 0 },
      ...statusOptions.map((o) => ({
        value: o.value_key,
        label: o.label,
        tone: o.tone,
        count: counts[o.value_key] ?? 0,
      })),
    ];
  }, [statusOptions, allRows]);

  return (
    <AppShell
      title={isDispatcher ? "Vehicle requests" : "My requests"}
      subtitle={isDispatcher ? "Every journey request and its current stage" : "Track your vehicle requests"}
      actions={
        isEmployee && !isDispatcher && !isDriver ? (
          <Button asChild size="sm" tooltip="Start a new vehicle request form">
            <Link to="/requests/new">
              <Plus className="size-4" /> New request
            </Link>
          </Button>
        ) : undefined
      }
    >
      <div className="role-dashboard page-stack min-w-0 w-full max-w-full">
      <Panel tone="primary" compact className="min-w-0 max-w-full" bodyClassName="p-0 min-w-0 max-w-full overflow-hidden">
        <div className="min-w-0 max-w-full space-y-2.5 overflow-hidden border-b border-border p-3 sm:p-3.5">
          <FilterBar value={filter} onChange={setFilter} options={filterOptions} label="Filter by status" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, purpose…"
            className="h-9 min-w-0 w-full"
          />
        </div>

        {isLoading ? (
          <RequestListSkeleton />
        ) : rows.length === 0 ? (
          <div className="p-3">
            <EmptyState compact title="No requests match" description="Try a different filter or raise a new request." />
          </div>
        ) : (
          <ul key={`${filter}-${search}`} className="list-stagger divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  to="/requests/$requestId"
                  params={{ requestId: r.id }}
                  className="role-dash-list-link flex flex-col gap-1.5 transition-colors active:bg-accent/50 hover:bg-primary/5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.reference} · {r.purpose}
                    </p>
                    <ChipGroup className="mt-1">
                      <MetaChip label={r.requester_name} tone="info" />
                      {r.departments?.code && <MetaChip label={r.departments.code} tone="neutral" />}
                    </ChipGroup>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(r.pickup_at)} · {relativeTime(r.pickup_at)}
                    </p>
                  </div>
                  <ChipGroup>
                    <LookupMetaChip group="trip_type" value={r.trip_type} />
                    <MetaChip label={`${r.passenger_count} pax`} tone="neutral" />
                    <LookupMetaChip group="vehicle_category" value={r.requested_category} fallback="Any category" />
                    <LookupChip group="priority" value={r.priority} />
                    <LookupChip group="request_status" value={r.status} />
                  </ChipGroup>
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
