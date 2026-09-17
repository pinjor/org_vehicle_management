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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { sortRequestsList } from "@/lib/fleet";
import { useLookupOptions } from "@/lib/lookups-context";
import { useRequests } from "@/lib/queries";
import { cn } from "@/lib/utils";

type RequestsSearch = { request?: string };
type RideTab = "pending" | "live" | "completed";

const PENDING_STATUSES = new Set(["submitted", "under_review", "approved"]);
const LIVE_STATUSES = new Set(["assigned", "in_progress"]);
const DONE_STATUSES = new Set(["completed", "cancelled", "rejected"]);

export const Route = createFileRoute("/requests/")({
  validateSearch: (search: Record<string, unknown>): RequestsSearch => ({
    ...(typeof search["request"] === "string" && search["request"]
      ? { request: search["request"] }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Vehicle requests — Vehicle Management System" },
      {
        name: "description",
        content:
          "Track every vehicle request from submission through approval, dispatch and completion.",
      },
    ],
  }),
  component: RequestsPage,
});

function tabCountClass(active: boolean) {
  return cn(
    "rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums",
    active ? "bg-primary/15 text-primary" : "bg-muted-foreground/15 text-muted-foreground",
  );
}

function RequestsPage() {
  const navigate = useNavigate();
  const { request: detailId } = Route.useSearch();
  const { isDispatcher, isDriver, isEmployee, user } = useAuth();
  const employeeView = isEmployee && !isDispatcher && !isDriver;
  const { data, isLoading } = useRequests(
    isDispatcher || !user ? undefined : { requesterId: user.id },
  );
  const statusOptions = useLookupOptions("request_status");
  const [tab, setTab] = useState<RideTab>("pending");
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const allRows = data ?? [];

  const pending = useMemo(() => {
    const rows = sortRequestsList(allRows.filter((r) => PENDING_STATUSES.has(r.status)));
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      `${r.reference} ${r.purpose} ${r.requester_name}`.toLowerCase().includes(q),
    );
  }, [allRows, search]);

  const live = useMemo(() => {
    const rows = sortRequestsList(allRows.filter((r) => LIVE_STATUSES.has(r.status)));
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      `${r.reference} ${r.purpose} ${r.requester_name} ${r.drivers?.full_name ?? ""}`.toLowerCase().includes(q),
    );
  }, [allRows, search]);

  const completed = useMemo(() => {
    const rows = sortRequestsList(allRows.filter((r) => DONE_STATUSES.has(r.status)));
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      `${r.reference} ${r.purpose} ${r.requester_name}`.toLowerCase().includes(q),
    );
  }, [allRows, search]);

  const adminRows = useMemo(() => {
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

  function renderList(rows: typeof allRows, emptyTitle: string, emptyDesc: string) {
    if (isLoading) return <RequestListSkeleton />;
    if (rows.length === 0) {
      return (
        <div className="p-3">
          <EmptyState compact title={emptyTitle} description={emptyDesc} />
        </div>
      );
    }
    return (
      <DualList
        fill={false}
        cards={
          <ul key={`${tab}-${search}-m`} className="list-stagger space-y-2 p-3">
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
    );
  }

  return (
    <AppShell
      title={isDispatcher ? "Vehicle requests" : "My rides"}
      subtitle={
        isDispatcher ? "Every journey request and its current stage" : "Pending, live, and past rides"
      }
      fillViewport
      {...(employeeView
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
          {employeeView ? (
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as RideTab)}
              className="flex min-h-0 min-w-0 flex-1 flex-col"
            >
              <div className="list-toolbar shrink-0 border-b border-border p-3 sm:p-3.5">
                <TabsList className="list-toolbar__tabs">
                  <TabsTrigger value="pending" className="gap-1.5 px-3 py-1.5">
                    Pending
                    <span className={tabCountClass(tab === "pending")}>{pending.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="live" className="gap-1.5 px-3 py-1.5">
                    Live
                    <span className={tabCountClass(tab === "live")}>{live.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="gap-1.5 px-3 py-1.5">
                    Completed
                    <span className={tabCountClass(tab === "completed")}>{completed.length}</span>
                  </TabsTrigger>
                </TabsList>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="list-toolbar__search"
                />
              </div>

              <TabsContent
                value="pending"
                className="mt-0 min-h-0 flex-1 overflow-auto focus-visible:outline-none data-[state=inactive]:hidden"
              >
                {renderList(pending, "Nothing pending", "New requests show here until assigned.")}
              </TabsContent>
              <TabsContent
                value="live"
                className="mt-0 min-h-0 flex-1 overflow-auto focus-visible:outline-none data-[state=inactive]:hidden"
              >
                {renderList(live, "No live rides", "Assigned and active trips show here.")}
              </TabsContent>
              <TabsContent
                value="completed"
                className="mt-0 min-h-0 flex-1 overflow-auto focus-visible:outline-none data-[state=inactive]:hidden"
              >
                {renderList(completed, "No completed rides", "Finished and cancelled rides show here.")}
              </TabsContent>
            </Tabs>
          ) : (
            <>
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
              ) : adminRows.length === 0 ? (
                <div className="p-3">
                  <EmptyState
                    compact
                    title="No requests match"
                    description="Try a different filter or raise a new request."
                  />
                </div>
              ) : (
                <DualList
                  cards={
                    <ul key={`${filter}-${search}-m`} className="list-stagger space-y-2 p-3">
                      {adminRows.map((r) => (
                        <li key={r.id}>
                          <AdminRequestCard request={r} />
                        </li>
                      ))}
                    </ul>
                  }
                  table={
                    <TripListTable
                      fill
                      headers={["Time", "Employee", "Route", "Pax / Vehicle", "Status", "Actions"]}
                    >
                      {adminRows.map((r) => (
                        <RequestTableRow key={r.id} request={r} mode="admin" />
                      ))}
                    </TripListTable>
                  }
                />
              )}
            </>
          )}
        </Panel>
      </div>

      {detailId && employeeView ? (
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
