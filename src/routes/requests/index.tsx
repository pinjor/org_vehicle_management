import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AdminRequestCard, EmployeeRequestCard } from "@/components/list-cards";
import { RequestListSkeleton } from "@/components/loading-skeletons";
import { EmptyState, FilterBar, Panel } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { sortRequestsList } from "@/lib/fleet";
import { useLookupOptions } from "@/lib/lookups-context";
import { useRequests } from "@/lib/queries";

export const Route = createFileRoute("/requests/")({
  head: () => ({
    meta: [
      { title: "Vehicle requests — Vehicle Management System" },
      { name: "description", content: "Track every vehicle request from submission through approval, dispatch and completion." },
      { property: "og:title", content: "Vehicle requests — Vehicle Management System" },
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
  const rows = useMemo(() => {
    const filtered = allRows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return `${r.reference} ${r.purpose} ${r.requester_name}`.toLowerCase().includes(q);
    });
    return sortRequestsList(filtered);
  }, [allRows, filter, search]);

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
          <ul key={`${filter}-${search}`} className="list-stagger space-y-2 p-3">
            {rows.map((r) => (
              <li key={r.id}>
                {isDispatcher ? (
                  <AdminRequestCard request={r} />
                ) : (
                  <EmployeeRequestCard request={r} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      </div>
    </AppShell>
  );
}
