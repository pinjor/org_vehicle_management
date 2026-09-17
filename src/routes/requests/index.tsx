import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmployeeRideDetail } from "@/components/employee-ride-detail";
import { AdminRequestCard, EmployeeRequestCard } from "@/components/list-cards";
import { RequestListSkeleton } from "@/components/loading-skeletons";
import { EmptyState, FilterBar, Panel } from "@/components/fleet-ui";
import {
  DualList,
  RequestTableRow,
  TripListTable,
} from "@/components/trip-list-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { sortRequestsList } from "@/lib/fleet";
import { useLookupOptions } from "@/lib/lookups-context";
import { useRequests } from "@/lib/queries";

type RequestsSearch = { request?: string };

export const Route = createFileRoute("/requests/")({
  validateSearch: (search: Record<string, unknown>): RequestsSearch => ({
    ...(typeof search["request"] === "string" && search["request"]
      ? { request: search["request"] }
      : {}),
  }),
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
  const navigate = useNavigate();
  const { request: detailId } = Route.useSearch();
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
      { value: "all", label: "All", tone: "neutral" as const, count: counts["all"] ?? 0 },
      ...statusOptions.map((o) => ({
        value: o.value_key,
        label: o.label,
        tone: o.tone,
        count: counts[o.value_key] ?? 0,
      })),
    ];
  }, [statusOptions, allRows]);

  function closeDetail() {
    void navigate({ to: "/requests", search: {}, replace: true });
  }

  return (
    <AppShell
      title={isDispatcher ? "Vehicle requests" : "My requests"}
      subtitle={isDispatcher ? "Every journey request and its current stage" : "Track your vehicle requests"}
      fillViewport
      {...(isEmployee && !isDispatcher && !isDriver
        ? {
            actions: (
              <Button asChild size="sm" tooltip="Start a new vehicle request form">
                <Link to="/requests/new">
                  <Plus className="size-4" /> New request
                </Link>
              </Button>
            ),
          }
        : {})}
    >
      <div className="role-dashboard page-stack page-stack--fill min-w-0 w-full max-w-full">
        <Panel
          tone="primary"
          compact
          className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col"
          bodyClassName="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden p-0"
        >
          <div className="list-toolbar shrink-0 overflow-hidden border-b border-border p-3 sm:p-3.5">
            <FilterBar
              value={filter}
              onChange={setFilter}
              options={filterOptions}
              label="Filter by status"
              className="list-toolbar__tabs flex-nowrap overflow-x-auto"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search purpose, name…"
              className="list-toolbar__search"
            />
          </div>

          {isLoading ? (
            <RequestListSkeleton />
          ) : rows.length === 0 ? (
            <div className="p-3">
              <EmptyState compact title="No requests match" description="Try a different filter or raise a new request." />
            </div>
          ) : (
            <DualList
              cards={
                <ul key={`${filter}-${search}-m`} className="list-stagger space-y-2 p-3">
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
              }
              table={
                <TripListTable
                  fill
                  headers={
                    isDispatcher
                      ? ["Time", "Employee", "Route", "Pax / Vehicle", "Status", "Actions"]
                      : ["Time", "Driver", "Route", "Passengers", "Status", "Actions"]
                  }
                >
                  {rows.map((r) => (
                    <RequestTableRow
                      key={r.id}
                      request={r}
                      mode={isDispatcher ? "admin" : "employee"}
                    />
                  ))}
                </TripListTable>
              }
            />
          )}
        </Panel>
      </div>

      {detailId && isEmployee && !isDispatcher ? (
        <EmployeeRideDetail
          requestId={detailId}
          open
          onOpenChange={(next) => {
            if (!next) closeDetail();
          }}
        />
      ) : null}
    </AppShell>
  );
}
