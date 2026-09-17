import { createFileRoute } from "@tanstack/react-router";
import { PanelSkeleton } from "@/components/loading-skeletons";
import { AppShell } from "@/components/app-shell";
import { DriverAssignmentCard } from "@/components/list-cards";
import { EmptyState, Panel } from "@/components/fleet-ui";
import {
  DualList,
  DriverTripTableRow,
  TripListTable,
} from "@/components/trip-list-table";
import { useAuth } from "@/lib/auth";
import { sortTripsList } from "@/lib/fleet";
import { useI18n } from "@/lib/i18n";
import { useDriverTrips } from "@/lib/queries";

export const Route = createFileRoute("/my-trips/")({
  head: () => ({
    meta: [
      { title: "My trips — Vehicle Management System" },
      { name: "description", content: "Driver view: pickup, drop, live map and trip progress." },
    ],
  }),
  component: MyTripsPage,
});

function MyTripsPage() {
  const { driverId, user, isDriver, isDispatcher } = useAuth();
  const { t } = useI18n();
  const { data, isLoading } = useDriverTrips(driverId ?? undefined);

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

  const sorted = sortTripsList(data ?? []);
  const trips = sorted.filter((row) => !["completed", "cancelled"].includes(row.status));
  const past = sorted.filter((row) => ["completed", "cancelled"].includes(row.status));

  return (
    <AppShell title={t("driver.trips.title")} subtitle={t("driver.trips.subtitle")}>
      <div className="role-dashboard page-stack" key={isLoading ? "loading" : "ready"}>
        {isLoading && <PanelSkeleton rows={4} />}

        {!isLoading && trips.length === 0 && (
          <EmptyState
            compact
            title={t("driver.trips.emptyTitle")}
            description={t("driver.trips.emptyDesc")}
          />
        )}

        {trips.length > 0 && (
          <section className="space-y-2">
            <p className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("driver.trips.active", { count: trips.length })}
            </p>
            <DualList
              cards={
                <ul className="space-y-2">
                  {trips.map((trip, i) => (
                    <li key={trip.id}>
                      <DriverAssignmentCard trip={trip} emphasize={i === 0} />
                    </li>
                  ))}
                </ul>
              }
              table={
                <div className="overflow-hidden rounded-lg border border-border">
                  <TripListTable
                    headers={["Time", "Passenger", "Route", "Pax", "Status", "Actions"]}
                  >
                    {trips.map((trip, i) => (
                      <DriverTripTableRow key={trip.id} trip={trip} emphasize={i === 0} />
                    ))}
                  </TripListTable>
                </div>
              }
            />
          </section>
        )}

        {past.length > 0 && (
          <Panel title={t("driver.trips.history")} tone="neutral" compact bodyClassName="p-0">
            <DualList
              cards={
                <ul className="divide-y divide-border/60">
                  {past.slice(0, 10).map((trip) => (
                    <li key={trip.id}>
                      <DriverAssignmentCard trip={trip} showStatus />
                    </li>
                  ))}
                </ul>
              }
              table={
                <TripListTable headers={["Time", "Passenger", "Route", "Pax", "Status", "Actions"]}>
                  {past.slice(0, 10).map((trip) => (
                    <DriverTripTableRow key={trip.id} trip={trip} />
                  ))}
                </TripListTable>
              }
            />
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
