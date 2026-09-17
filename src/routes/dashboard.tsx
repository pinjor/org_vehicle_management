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
import { toast } from "sonner";
import { DriverHomeIllustration } from "@/components/employee-home-illustration";
import { EmployeeRideHome } from "@/components/employee-ride-home";
import { AppShell } from "@/components/app-shell";
import { DriverTripPreview } from "@/components/driver-trip-preview";
import { AdminRequestCard } from "@/components/list-cards";
import { PanelSkeleton } from "@/components/loading-skeletons";
import {
  DashModule,
  DashQuickActions,
  DriverStatusModule,
  FleetHealthModule,
  GlanceModule,
  LiveTripsModule,
  MaintenanceModule,
  greetingForNow,
  todayLabel,
} from "@/components/ops-home-modules";
import { ReportVehicleIssueDialog } from "@/components/report-vehicle-issue-dialog";
import {
  DualList,
  RequestTableRow,
  TripListTable,
} from "@/components/trip-list-table";
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
  useDecideRequest,
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

/** Modular ops home — full boards live on /trips, /fleet, /maintenance. */
function DispatcherDashboard() {
  const { user, profile } = useAuth();
  const requests = useRequests();
  const trips = useActiveTrips();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const unavailability = useUnavailabilityRequests();
  const decide = useDecideRequest();
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
  const preview = incoming.slice(0, 4);
  const moreCount = Math.max(0, incoming.length - preview.length);

  const liveTrips = useMemo(
    () =>
      (trips.data ?? []).filter((t) => !["completed", "cancelled", "breakdown"].includes(t.status)),
    [trips.data],
  );
  const livePreview = liveTrips.slice(0, 5);

  const availableVehicles = fleet.filter((v) => v.operational_status === "available");
  const maintenanceVehicles = fleet.filter((v) => v.operational_status === "under_maintenance");
  const unavailableVehicles = fleet.filter((v) =>
    ["unavailable", "out_of_service"].includes(v.operational_status),
  );

  const availableDrivers = driverRows.filter((d) => d.current_status === "available");
  const drivingDrivers = driverRows.filter((d) =>
    ["driving", "reserved"].includes(d.current_status),
  );
  const awayDrivers = driverRows.filter((d) =>
    ["leave", "off_duty", "unavailable", "suspended", "break"].includes(d.current_status),
  );

  const pendingReports = maintRows.filter((r) => r.status === "pending");
  const openMaint = maintRows.filter((r) =>
    ["pending", "sent_to_maintenance", "approved_unavailable"].includes(r.status),
  );
  const maintPreview = openMaint.slice(0, 4);

  const tips = useMemo(() => {
    const out: string[] = [];
    if (incoming.length > 0) {
      out.push(`${incoming.length} request${incoming.length === 1 ? "" : "s"} need assign`);
    }
    if (pendingReports.length > 0) {
      out.push(
        `${pendingReports.length} maintenance report${pendingReports.length === 1 ? "" : "s"} awaiting review`,
      );
    }
    if (maintenanceVehicles.length > 0) {
      out.push(
        `${maintenanceVehicles.length} vehicle${maintenanceVehicles.length === 1 ? "" : "s"} in shop`,
      );
    }
    if (liveTrips.length > 0) {
      out.push(`${liveTrips.length} trip${liveTrips.length === 1 ? "" : "s"} live now`);
    }
    if (availableVehicles.length === 0 && fleet.length > 0) {
      out.push("No free vehicles — check fleet or shop");
    }
    if (availableDrivers.length === 0 && driverRows.length > 0) {
      out.push("No free drivers right now");
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
          <KpiCard compact label="Pending" value={incoming.length} tone="warning" icon={<Clock />} />
          <KpiCard compact label="Live" value={liveTrips.length} tone="info" icon={<Radar />} />
          <KpiCard
            compact
            label="Vehicles free"
            value={availableVehicles.length}
            tone="success"
            icon={<Car />}
          />
          <KpiCard
            compact
            label="Drivers free"
            value={availableDrivers.length}
            tone="primary"
            icon={<Users />}
          />
          <KpiCard
            compact
            label="In shop"
            value={maintenanceVehicles.length}
            tone="warning"
            icon={<Wrench />}
          />
          <KpiCard
            compact
            label="Reports"
            value={pendingReports.length}
            tone="danger"
            icon={<FileWarning />}
          />
        </KpiGrid>

        <div className="dash-home__grid">
          <DashQuickActions onLogIssue={() => setLogOpen(true)} />

          <DashModule
            title="Pending"
            count={incoming.length}
            action={
              <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                <Link to="/trips">
                  {moreCount > 0 ? `View all (+${moreCount})` : "Open trips"}
                </Link>
              </Button>
            }
            className="dash-mod--pending"
            bodyClassName="dash-mod__body--list"
          >
            {requests.isLoading ? (
              <PanelSkeleton rows={4} />
            ) : preview.length === 0 ? (
              <EmptyState
                compact
                title="Nothing pending"
                description="New vehicle requests show up here for assign."
              />
            ) : (
              <DualList
                fill={false}
                cards={
                  <ul className="list-stagger space-y-2">
                    {preview.map((r) => {
                      const canReject = !!user && r.status === "submitted";
                      return (
                        <li key={r.id}>
                          <AdminRequestCard
                            request={r}
                            trailing={
                              canReject ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  disabled={decide.isPending}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!user) return;
                                    decide.mutate(
                                      { requestId: r.id, approve: false, actorId: user.id },
                                      {
                                        onSuccess: () => toast.success("Request rejected"),
                                        onError: (err) => toast.error(err.message),
                                      },
                                    );
                                  }}
                                >
                                  Reject
                                </Button>
                              ) : null
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                }
                table={
                  <div className="overflow-hidden rounded-lg border border-border">
                    <TripListTable
                      className="trip-list-board--pending"
                      headers={["Time", "Employee", "Route", "Passengers", "Status"]}
                    >
                      {preview.map((r) => (
                        <RequestTableRow key={r.id} request={r} showActions={false} />
                      ))}
                    </TripListTable>
                  </div>
                }
              />
            )}
          </DashModule>

          <LiveTripsModule trips={livePreview} loading={trips.isLoading} />

          <FleetHealthModule
            total={fleet.length}
            available={availableVehicles.length}
            maintenance={maintenanceVehicles.length}
            unavailable={unavailableVehicles.length}
          />

          <DriverStatusModule
            total={driverRows.length}
            available={availableDrivers.length}
            driving={drivingDrivers.length}
            away={awayDrivers.length}
          />

          <MaintenanceModule
            pendingReports={pendingReports.length}
            inShop={maintenanceVehicles.length}
            preview={maintPreview}
            loading={unavailability.isLoading}
          />

          <GlanceModule tips={tips} />
        </div>
      </div>

      <ReportVehicleIssueDialog open={logOpen} onOpenChange={setLogOpen} />
    </AppShell>
  );
}
