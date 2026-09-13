import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, ClipboardList, Clock, Plus, Users, Navigation } from "lucide-react";
import { DriverHomeIllustration } from "@/components/employee-home-illustration";
import { EmployeeRideHome } from "@/components/employee-ride-home";
import { AppShell } from "@/components/app-shell";
import { AdminRequestCard } from "@/components/list-cards";
import { DriverTripPreview } from "@/components/driver-trip-preview";
import { PanelSkeleton } from "@/components/loading-skeletons";
import {
  KpiCard,
  KpiGrid,
  Panel,
  EmptyState,
} from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { sortDispatchQueue } from "@/lib/fleet";
import { useI18n } from "@/lib/i18n";
import { useDriverTrips, useDrivers, useRequests, useVehicles } from "@/lib/queries";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Vehicle Management System" },
      { name: "description", content: "Your Vehicle Management System workspace — requests, trips, or fleet overview." },
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
    <AppShell title="Vehicle Management System" subtitle="Book a vehicle">
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
        {!incoming ? (
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
        ) : null}

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
  const incoming = sortDispatchQueue(
    [...rows].filter((r) => ["submitted", "approved"].includes(r.status)),
  );

  const availableVehicles = (vehicles.data ?? []).filter((v) => v.operational_status === "available");
  const availableDrivers = (drivers.data ?? []).filter((d) => d.current_status === "available");

  return (
    <AppShell title="Home" subtitle="Review and assign">
      <div className="role-dashboard page-stack">
        <KpiGrid fit="auto">
          <KpiCard label="Pending" value={incoming.length} hint="To handle" tone="warning" icon={<Clock />} />
          <KpiCard
            label="Vehicles free"
            value={availableVehicles.length}
            hint="Free now"
            tone="success"
            icon={<Car />}
          />
          <KpiCard
            label="Drivers free"
            value={availableDrivers.length}
            hint="Free now"
            tone="primary"
            icon={<Users />}
          />
        </KpiGrid>

        <Panel
          title="Pending"
          description="Assign a driver to open requests"
          tone="primary"
          compact
          bodyClassName="p-0"
        >
          {requests.isLoading ? (
            <PanelSkeleton rows={6} />
          ) : incoming.length === 0 ? (
            <div className="p-3">
              <EmptyState compact title="Nothing pending" description="New requests show here." />
            </div>
          ) : (
            <ul className="list-stagger space-y-2.5 p-3 sm:space-y-3">
              {incoming.map((r) => (
                <li key={r.id}>
                  <AdminRequestCard request={r} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
