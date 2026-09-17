import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Car, Clock, Navigation, Users } from "lucide-react";
import { toast } from "sonner";
import { DriverHomeIllustration } from "@/components/employee-home-illustration";
import { EmployeeRideHome } from "@/components/employee-ride-home";
import { AppShell } from "@/components/app-shell";
import { DriverTripPreview } from "@/components/driver-trip-preview";
import { AdminRequestCard } from "@/components/list-cards";
import { PanelSkeleton } from "@/components/loading-skeletons";
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
import { sortDispatchQueue } from "@/lib/fleet";
import { useI18n } from "@/lib/i18n";
import {
  useActiveTrips,
  useDecideRequest,
  useDriverTrips,
  useDrivers,
  useRequests,
  useVehicles,
} from "@/lib/queries";

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

  const trips = (data ?? []).filter((t) => !["completed", "cancelled", "breakdown"].includes(t.status));
  const incoming = trips[0];
  const laterCount = Math.max(0, trips.length - 1);

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
            <div className="flex items-center justify-between gap-2 px-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("driver.home.incoming")}
              </p>
              {laterCount > 0 ? (
                <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Link to="/my-trips">{t("driver.home.upNext", { count: laterCount })}</Link>
                </Button>
              ) : null}
            </div>
            <DriverTripPreview trip={incoming} emphasize />
          </section>
        )}

        {!isLoading && !incoming && (
          <p className="px-1 text-center text-xs text-muted-foreground">{t("driver.home.empty")}</p>
        )}

        <DriverHomeIllustration />
      </div>
    </AppShell>
  );
}

/** KPIs + pending queue preview — full board on /trips. */
function DispatcherDashboard() {
  const { user } = useAuth();
  const requests = useRequests();
  const trips = useActiveTrips();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const decide = useDecideRequest();

  const rows = requests.data ?? [];
  const incoming = sortDispatchQueue(
    [...rows].filter((r) => ["submitted", "approved"].includes(r.status)),
  );
  const preview = incoming.slice(0, 5);
  const moreCount = Math.max(0, incoming.length - preview.length);
  const liveCount = (trips.data ?? []).filter(
    (t) => !["completed", "cancelled", "breakdown"].includes(t.status),
  ).length;

  const availableVehicles = (vehicles.data ?? []).filter((v) => v.operational_status === "available");
  const availableDrivers = (drivers.data ?? []).filter((d) => d.current_status === "available");

  return (
    <AppShell title="Home" subtitle="Ops overview">
      <div className="role-dashboard page-stack">
        <KpiGrid fit="auto">
          <KpiCard label="Pending" value={incoming.length} hint="Need assign" tone="warning" icon={<Clock />} />
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
          <KpiCard label="Live" value={liveCount} tone="info" icon={<CalendarClock />} />
        </KpiGrid>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pending
              {incoming.length > 0 ? ` · ${incoming.length}` : ""}
            </p>
            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <Link to="/trips">
                {moreCount > 0 ? `View all (+${moreCount})` : "Open trips"}
              </Link>
            </Button>
          </div>

          {requests.isLoading ? (
            <PanelSkeleton rows={3} />
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
                                      onSuccess: () => toast.success(`Rejected ${r.reference}`),
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
        </section>
      </div>
    </AppShell>
  );
}
