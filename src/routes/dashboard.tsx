import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Car,
  Clock,
  Navigation,
  Users,
  Wrench,
  FileWarning,
  Radar,
} from "lucide-react";
import { DriverHomeIllustration } from "@/components/employee-home-illustration";
import { EmployeeRideHome } from "@/components/employee-ride-home";
import { AppShell } from "@/components/app-shell";
import { DriverTripPreview } from "@/components/driver-trip-preview";
import { PanelSkeleton } from "@/components/loading-skeletons";
import {
  DashQuickActions,
  GlanceModule,
  LiveTripsModule,
  PendingQueueModule,
  greetingForNow,
  todayLabel,
  type GlanceTip,
} from "@/components/ops-home-modules";
import { ReportVehicleIssueDialog } from "@/components/report-vehicle-issue-dialog";
import {
  KpiCard,
  KpiGrid,
  EmptyState,
} from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { sortDispatchQueue, sortTripsList, isDriverPendingTrip } from "@/lib/fleet";
import { useI18n } from "@/lib/i18n";
import {
  useActiveTrips,
  useDriverTrips,
  useDrivers,
  useRequests,
  useUnavailabilityRequests,
  useVehicles,
} from "@/lib/queries";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Vehicle Management System" },
      {
        name: "description",
        content: "Your Vehicle Management System workspace — requests, trips, or fleet overview.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { isDispatcher, isDriver, isEmployee, user, driverId } = useAuth();

  if (isDriver && !isDispatcher) {
    return (
      <DriverDashboard
        driverId={driverId}
        {...(user?.id ? { userId: user.id } : {})}
      />
    );
  }
  if (isEmployee && !isDispatcher) return <EmployeeDashboard />;
  return <DispatcherDashboard />;
}

function EmployeeDashboard() {
  return (
    <AppShell title="Ride" subtitle="Book a vehicle">
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

  const open = sortTripsList(data ?? []).filter(
    (t) => !["completed", "cancelled", "breakdown"].includes(t.status),
  );
  const pending = open.filter((t) => isDriverPendingTrip(t.status));
  const live = open.filter((t) => !isDriverPendingTrip(t.status));
  const nowTrip = live[0];
  const hasAny = open.length > 0;

  return (
    <AppShell
      title={t("driver.home.title", { name: firstName })}
      subtitle={t("driver.home.subtitle")}
    >
      <div className="role-dashboard page-stack emp-home-dash">
        {!hasAny && !isLoading ? (
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

        {!isLoading && nowTrip ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("driver.home.incoming")}
              </p>
              {live.length > 1 ? (
                <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Link to="/my-trips">{t("driver.home.upNext", { count: live.length - 1 })}</Link>
                </Button>
              ) : null}
            </div>
            <DriverTripPreview trip={nowTrip} emphasize />
          </section>
        ) : null}

        {!isLoading && pending.length > 0 ? (
          <section className="space-y-2">
            <div className="px-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("driver.home.pending")}
                <span className="ml-1.5 font-bold text-warning-foreground tabular-nums">
                  ({pending.length})
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{t("driver.home.pendingHint")}</p>
            </div>
            <ul className="space-y-2">
              {pending.map((trip, i) => (
                <li key={trip.id}>
                  <DriverTripPreview trip={trip} emphasize={!nowTrip && i === 0} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!isLoading && !hasAny ? (
          <p className="px-1 text-center text-xs text-muted-foreground">{t("driver.home.empty")}</p>
        ) : null}

        <DriverHomeIllustration />
      </div>
    </AppShell>
  );
}

/** Classic ops desk: KPIs → Pending | Live → alerts. Capacity lives in KPI strip. */
function DispatcherDashboard() {
  const { profile } = useAuth();
  const requests = useRequests();
  const trips = useActiveTrips();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const unavailability = useUnavailabilityRequests();
  const [logOpen, setLogOpen] = useState(false);

  const firstName = profile?.full_name?.split(" ")[0] || "Admin";

  const rows = requests.data ?? [];
  const fleet = vehicles.data ?? [];
  const driverRows = drivers.data ?? [];
  const maintRows = unavailability.data ?? [];

  const incoming = useMemo(
    () =>
      sortDispatchQueue([...rows].filter((r) => ["submitted", "approved"].includes(r.status))),
    [rows],
  );
  const preview = incoming.slice(0, 6);

  const liveTrips = useMemo(
    () =>
      (trips.data ?? []).filter((t) => !["completed", "cancelled", "breakdown"].includes(t.status)),
    [trips.data],
  );
  const livePreview = liveTrips.slice(0, 6);

  const availableVehicles = fleet.filter((v) => v.operational_status === "available");
  const maintenanceVehicles = fleet.filter((v) => v.operational_status === "under_maintenance");
  const availableDrivers = driverRows.filter((d) => d.current_status === "available");
  const pendingReports = maintRows.filter((r) => r.status === "pending");

  const tips = useMemo((): GlanceTip[] => {
    const out: GlanceTip[] = [];
    if (incoming.length > 0) {
      out.push({
        id: "assign",
        label: `${incoming.length} request${incoming.length === 1 ? "" : "s"} need assign`,
        detail: "Open trips queue",
        to: "/trips",
        tone: "warn",
      });
    }
    if (pendingReports.length > 0) {
      out.push({
        id: "reports",
        label: `${pendingReports.length} report${pendingReports.length === 1 ? "" : "s"} awaiting review`,
        detail: "Open maintenance desk",
        to: "/maintenance",
        tone: "warn",
      });
    }
    if (maintenanceVehicles.length > 0) {
      out.push({
        id: "shop",
        label: `${maintenanceVehicles.length} vehicle${maintenanceVehicles.length === 1 ? "" : "s"} in shop`,
        detail: "Open fleet",
        to: "/fleet",
        tone: "warn",
      });
    }
    if (liveTrips.length > 0) {
      out.push({
        id: "live",
        label: `${liveTrips.length} trip${liveTrips.length === 1 ? "" : "s"} live now`,
        detail: "Track live trips",
        to: "/trips",
        tone: "info",
      });
    }
    if (availableVehicles.length === 0 && fleet.length > 0) {
      out.push({
        id: "no-vehicles",
        label: "No free vehicles",
        detail: "Check fleet or shop",
        to: "/fleet",
        tone: "danger",
      });
    }
    if (availableDrivers.length === 0 && driverRows.length > 0) {
      out.push({
        id: "no-drivers",
        label: "No free drivers",
        detail: "Open drivers roster",
        to: "/drivers",
        tone: "danger",
      });
    }
    return out.slice(0, 5);
  }, [
    incoming.length,
    pendingReports.length,
    maintenanceVehicles.length,
    liveTrips.length,
    availableVehicles.length,
    fleet.length,
    availableDrivers.length,
    driverRows.length,
  ]);

  return (
    <AppShell title="Home" subtitle="Fleet · trips · maintenance">
      <div className="role-dashboard page-stack dash-home">
        <header className="dash-home__hero">
          <div className="min-w-0">
            <p className="dash-home__greet">{greetingForNow(firstName)}</p>
            <p className="dash-home__date">{todayLabel()}</p>
          </div>
          <p className="dash-home__tagline">Ops desk — assign, track, keep fleet healthy.</p>
        </header>

        <KpiGrid fit="auto" className="kpi-grid--compact shrink-0">
          <KpiCard
            compact
            to="/trips"
            label="Pending"
            value={incoming.length}
            tone="warning"
            icon={<Clock />}
          />
          <KpiCard
            compact
            to="/trips"
            label="Live"
            value={liveTrips.length}
            tone="info"
            icon={<Radar />}
          />
          <KpiCard
            compact
            to="/fleet"
            label="Vehicles free"
            value={availableVehicles.length}
            tone="success"
            icon={<Car />}
          />
          <KpiCard
            compact
            to="/drivers"
            label="Drivers free"
            value={availableDrivers.length}
            tone="primary"
            icon={<Users />}
          />
          <KpiCard
            compact
            to="/fleet"
            label="In shop"
            value={maintenanceVehicles.length}
            tone="warning"
            icon={<Wrench />}
          />
          <KpiCard
            compact
            to="/maintenance"
            label="Reports"
            value={pendingReports.length}
            tone="danger"
            icon={<FileWarning />}
          />
        </KpiGrid>

        <div className="dash-home__grid">
          <PendingQueueModule
            requests={preview}
            total={incoming.length}
            loading={requests.isLoading}
          />
          <LiveTripsModule trips={livePreview} loading={trips.isLoading} />
          <GlanceModule tips={tips} />
          <DashQuickActions onLogIssue={() => setLogOpen(true)} />
        </div>
      </div>

      <ReportVehicleIssueDialog open={logOpen} onOpenChange={setLogOpen} />
    </AppShell>
  );
}
