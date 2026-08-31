import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, ClipboardList, Clock, Plus, Users, Navigation } from "lucide-react";
import { DriverHomeIllustration } from "@/components/employee-home-illustration";
import { EmployeeRideHome } from "@/components/employee-ride-home";
import { AppShell } from "@/components/app-shell";
import { DriverTripPreview } from "@/components/driver-trip-preview";
import { PanelSkeleton } from "@/components/loading-skeletons";
import { LookupChip, LookupMetaChip } from "@/components/lookup-chip";
import {
  KpiCard,
  KpiGrid,
  Panel,
  ChipGroup,
  MetaChip,
  EmptyState,
} from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useDriverTrips, useDrivers, useRequests, useVehicles } from "@/lib/queries";
import { formatDateTime, relativeTime } from "@/lib/fleet";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FleetOps" },
      { name: "description", content: "Your FleetOps workspace — requests, trips, or fleet overview." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { isDispatcher, isDriver, isEmployee, user, driverId } = useAuth();

  if (isDriver && !isDispatcher) return <DriverDashboard driverId={driverId} userId={user?.id} />;
  if (isEmployee && !isDispatcher) return <EmployeeDashboard />;
  return <DispatcherDashboard />;
}

function EmployeeDashboard() {
  return (
    <AppShell title="FleetOps" subtitle="Book a vehicle">
      <EmployeeRideHome />
    </AppShell>
  );
}

function DriverDashboard({ driverId, userId }: { driverId: string | null; userId?: string }) {
  const { profile } = useAuth();
  const { t } = useI18n();
  const { data, isLoading } = useDriverTrips(driverId ?? undefined);
  const firstName = profile?.full_name?.split(" ")[0] ?? t("driver.home.fallbackName");

  if (!driverId || !userId) {
    return (
      <AppShell title={t("driver.home.unlinkedShellTitle")} subtitle={t("driver.home.unlinkedShellSub")}>
        <EmptyState
          compact
          title={t("driver.home.unlinkedTitle")}
          description={t("driver.home.unlinkedDesc")}
        />
      </AppShell>
    );
  }

  const trips = (data ?? []).filter((t) => !["completed", "cancelled"].includes(t.status));
  const incoming = trips[0];
  const queued = trips.slice(1);

  return (
    <AppShell
      title={t("driver.home.title", { name: firstName })}
      subtitle={t("driver.home.subtitle")}
    >
      <div className="role-dashboard page-stack emp-home-dash">
        <section className="role-dash-cta">
          <div className="role-dash-cta__copy min-w-0">
            <p className="role-dash-cta__title">{t("driver.home.ctaTitle")}</p>
            <p className="role-dash-cta__desc">{t("driver.home.ctaDesc")}</p>
          </div>
          <div className="role-dash-cta__actions">
            <Button asChild size="sm" className="min-h-9 flex-1 sm:flex-none" tooltip={t("driver.home.myTripsTip")}>
              <Link to="/my-trips">
                <Navigation className="size-3.5" /> {t("driver.home.myTrips")}
              </Link>
            </Button>
          </div>
        </section>

        {isLoading && <PanelSkeleton rows={3} />}

        {!isLoading && incoming && (
          <section className="space-y-2">
            <p className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("driver.home.incoming")}
            </p>
            <DriverTripPreview trip={incoming} emphasize showStatus={false} />
          </section>
        )}

        {!isLoading && !incoming && (
          <p className="px-1 text-center text-xs text-muted-foreground">{t("driver.home.empty")}</p>
        )}

        {queued.length > 0 && (
          <section className="space-y-2">
            <p className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("driver.home.upNext", { count: queued.length })}
            </p>
            <ul className="space-y-2">
              {queued.map((trip) => (
                <li key={trip.id}>
                  <DriverTripPreview trip={trip} showStatus={false} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <DriverHomeIllustration />
      </div>
    </AppShell>
  );
}

function DispatcherDashboard() {
  const requests = useRequests();
  const vehicles = useVehicles();
  const drivers = useDrivers();

  const rows = requests.data ?? [];
  const incoming = [...rows]
    .filter((r) => ["submitted", "approved"].includes(r.status))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const availableVehicles = (vehicles.data ?? []).filter((v) => v.operational_status === "available");
  const availableDrivers = (drivers.data ?? []).filter((d) => d.current_status === "available");

  return (
    <AppShell title="Operations" subtitle="Incoming requests — open one to review, assign, or reject">
      <div className="role-dashboard page-stack">
        <KpiGrid fit="auto">
          <KpiCard label="Incoming" value={incoming.length} hint="Needs action" tone="warning" icon={<Clock />} />
          <KpiCard
            label="Vehicles free"
            value={availableVehicles.length}
            hint="Ready to assign"
            tone="success"
            icon={<Car />}
          />
          <KpiCard
            label="Drivers free"
            value={availableDrivers.length}
            hint="On duty / available"
            tone="primary"
            icon={<Users />}
          />
        </KpiGrid>

        <Panel
          title="Incoming requests"
          description="Click a request to open full details"
          tone="primary"
          compact
          bodyClassName="p-0"
        >
          {requests.isLoading ? (
            <PanelSkeleton rows={6} />
          ) : incoming.length === 0 ? (
            <div className="p-3">
              <EmptyState compact title="No incoming requests" description="New employee requests show up here." />
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {incoming.map((r) => (
                <li key={r.id}>
                  <Link
                    to="/requests/$requestId"
                    params={{ requestId: r.id }}
                    className="role-dash-list-link flex w-full flex-col gap-1 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{r.reference}</p>
                      <LookupChip group="request_status" value={r.status} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.requester_name} · {r.purpose}
                    </p>
                    <ChipGroup className="mt-0.5">
                      <LookupMetaChip group="trip_type" value={r.trip_type} />
                      <MetaChip label={`${r.passenger_count} pax`} tone="neutral" />
                    </ChipGroup>
                    <p className="text-[11px] text-muted-foreground">
                      Pickup {formatDateTime(r.pickup_at)} · {relativeTime(r.pickup_at)}
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
