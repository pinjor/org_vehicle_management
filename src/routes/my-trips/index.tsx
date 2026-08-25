import { createFileRoute, Link } from "@tanstack/react-router";
import { PanelSkeleton } from "@/components/loading-skeletons";
import { AppShell } from "@/components/app-shell";
import { DriverTripPreview } from "@/components/driver-trip-preview";
import { EmptyState, Panel, MetaChip, ChipGroup } from "@/components/fleet-ui";
import { LookupChip } from "@/components/lookup-chip";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useDriverTrips } from "@/lib/queries";

export const Route = createFileRoute("/my-trips/")({
  head: () => ({
    meta: [
      { title: "My trips — FleetOps" },
      { name: "description", content: "Driver view: pickup, drop, live map and trip progress." },
    ],
  }),
  component: MyTripsPage,
});

function MyTripsPage() {
  const { driverId, user } = useAuth();
  const { t } = useI18n();
  const { data, isLoading } = useDriverTrips(driverId ?? undefined);

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

  const trips = (data ?? []).filter((row) => !["completed", "cancelled"].includes(row.status));
  const past = (data ?? []).filter((row) => ["completed", "cancelled"].includes(row.status));

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
            <ul className="space-y-2">
              {trips.map((trip, i) => (
                <li key={trip.id}>
                  <DriverTripPreview trip={trip} emphasize={i === 0} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {past.length > 0 && (
          <Panel title={t("driver.trips.history")} tone="neutral" compact bodyClassName="p-0">
            <ul className="divide-y divide-border/60">
              {past.slice(0, 10).map((trip) => (
                <li key={trip.id}>
                  <Link
                    to="/my-trips/$tripId"
                    params={{ tripId: trip.id }}
                    className="role-dash-list-link flex items-center justify-between gap-3 transition-colors hover:bg-muted/40"
                  >
                    <ChipGroup>
                      <MetaChip label={trip.reference} tone="primary" />
                    </ChipGroup>
                    <LookupChip group="trip_status" value={trip.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
