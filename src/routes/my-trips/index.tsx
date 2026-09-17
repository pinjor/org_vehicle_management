import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PanelSkeleton } from "@/components/loading-skeletons";
import { AppShell } from "@/components/app-shell";
import { DriverTripPanel } from "@/components/driver-trip-panel";
import { DriverAssignmentCard } from "@/components/list-cards";
import { EmptyState, Panel } from "@/components/fleet-ui";
import {
  DualList,
  DriverTripTableRow,
  TripListTable,
} from "@/components/trip-list-table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { sortTripsList, isDriverPendingTrip } from "@/lib/fleet";
import { useI18n } from "@/lib/i18n";
import { useDriverTrips, type TripRecord } from "@/lib/queries";
import { cn } from "@/lib/utils";

type MyTripsSearch = { trip?: string };
type TripTab = "pending" | "live" | "completed";

export const Route = createFileRoute("/my-trips/")({
  validateSearch: (search: Record<string, unknown>): MyTripsSearch => ({
    ...(typeof search["trip"] === "string" && search["trip"] ? { trip: search["trip"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "My trips — Vehicle Management System" },
      { name: "description", content: "Driver view: pickup, drop and trip progress." },
    ],
  }),
  component: MyTripsPage,
});

function tabCountClass(active: boolean) {
  return cn(
    "rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums",
    active ? "bg-primary/15 text-primary" : "bg-muted-foreground/15 text-muted-foreground",
  );
}

function filterBySearch(rows: TripRecord[], search: string) {
  if (!search.trim()) return rows;
  const q = search.toLowerCase();
  return rows.filter((trip) => {
    const req = trip.vehicle_requests;
    return `${req?.purpose ?? ""} ${req?.requester_name ?? ""} ${trip.vehicles?.registration_number ?? ""} ${trip.vehicles?.name ?? ""} ${trip.status}`
      .toLowerCase()
      .includes(q);
  });
}

function MyTripsPage() {
  const navigate = useNavigate();
  const { trip: detailId } = Route.useSearch();
  const { driverId, user, isDriver, isDispatcher } = useAuth();
  const { t } = useI18n();
  const { data, isLoading } = useDriverTrips(driverId ?? undefined);
  const [tab, setTab] = useState<TripTab>("pending");
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => sortTripsList(data ?? []), [data]);
  const pending = useMemo(() => {
    const open = sorted.filter((row) => !["completed", "cancelled", "breakdown"].includes(row.status));
    return filterBySearch(
      open.filter((row) => isDriverPendingTrip(row.status)),
      search,
    );
  }, [sorted, search]);
  const live = useMemo(() => {
    const open = sorted.filter((row) => !["completed", "cancelled", "breakdown"].includes(row.status));
    return filterBySearch(
      open.filter((row) => !isDriverPendingTrip(row.status)),
      search,
    );
  }, [sorted, search]);
  const completed = useMemo(() => {
    return filterBySearch(
      sorted.filter((row) => ["completed", "cancelled", "breakdown"].includes(row.status)),
      search,
    );
  }, [sorted, search]);

  const detailTrip = detailId ? (data ?? []).find((row) => row.id === detailId) : undefined;

  function closeDetail() {
    void navigate({ to: "/my-trips", search: {}, replace: true });
  }

  function renderList(
    rows: TripRecord[],
    emptyTitle: string,
    emptyDesc: string,
    emphasizeFirst: boolean,
  ) {
    if (isLoading) return <PanelSkeleton rows={4} />;
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
            {rows.map((trip, i) => (
              <li key={trip.id}>
                <DriverAssignmentCard
                  trip={trip}
                  {...(emphasizeFirst && i === 0 ? { emphasize: true } : {})}
                />
              </li>
            ))}
          </ul>
        }
        table={
          <div className="overflow-hidden rounded-lg border border-border">
            <TripListTable headers={["Time", "Passenger", "Route", "Pax", "Status", "Actions"]}>
              {rows.map((trip, i) => (
                <DriverTripTableRow
                  key={trip.id}
                  trip={trip}
                  {...(emphasizeFirst && i === 0 ? { emphasize: true } : {})}
                />
              ))}
            </TripListTable>
          </div>
        }
      />
    );
  }

  if (!isDriver || isDispatcher) {
    return (
      <AppShell title={t("driver.trips.title")} subtitle={t("driver.trips.shellSub")}>
        <EmptyState
          compact
          title="Driver only"
          description="My trips is for linked driver accounts."
        />
      </AppShell>
    );
  }

  if (!driverId || !user) {
    return (
      <AppShell title={t("driver.trips.title")} subtitle={t("driver.trips.shellSub")}>
        <EmptyState
          compact
          title={t("driver.trips.unlinkedTitle")}
          description={t("driver.trips.unlinkedDesc")}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title={t("driver.trips.title")} subtitle={t("driver.trips.subtitle")} fillViewport>
      <div className="role-dashboard page-stack page-stack--fill min-w-0 w-full max-w-full">
        <Panel
          tone="primary"
          compact
          className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col"
          bodyClassName="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden p-0"
        >
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as TripTab)}
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
              {renderList(
                pending,
                t("driver.trips.emptyTitle"),
                "Assigned and confirmed trips wait here.",
                live.length === 0,
              )}
            </TabsContent>
            <TabsContent
              value="live"
              className="mt-0 min-h-0 flex-1 overflow-auto focus-visible:outline-none data-[state=inactive]:hidden"
            >
              {renderList(live, "No live trips", "Trips underway show here.", true)}
            </TabsContent>
            <TabsContent
              value="completed"
              className="mt-0 min-h-0 flex-1 overflow-auto focus-visible:outline-none data-[state=inactive]:hidden"
            >
              {renderList(completed, "No completed trips", "Past trips show here.", false)}
            </TabsContent>
          </Tabs>
        </Panel>
      </div>

      {detailTrip ? (
        <DriverTripPanel
          trip={detailTrip}
          open
          onOpenChange={(next) => {
            if (!next) closeDetail();
          }}
        />
      ) : null}
    </AppShell>
  );
}
