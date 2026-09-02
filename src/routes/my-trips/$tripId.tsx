import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DriverTripPanel } from "@/components/driver-trip-panel";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { EmptyState } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useDriverTrips } from "@/lib/queries";

export const Route = createFileRoute("/my-trips/$tripId")({
  head: () => ({
    meta: [
      { title: "Trip — FleetOps" },
      { name: "description", content: "Trip assignment, live map and progress actions." },
    ],
  }),
  component: DriverTripDetailPage,
});

function DriverTripDetailPage() {
  const { tripId } = Route.useParams();
  const { driverId, user, isDispatcher } = useAuth();
  const { t } = useI18n();
  const { data, isLoading } = useDriverTrips(driverId ?? undefined);

  if (!driverId || !user) {
    return (
      <AppShell title={t("driver.trips.title")} subtitle={t("driver.detail.shellSub")}>
        <EmptyState
          compact
          title={t("driver.home.unlinkedTitle")}
          description={t("driver.home.unlinkedDesc")}
        />
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell title={t("driver.trips.title")} subtitle={t("driver.detail.shellSub")}>
        <div className="plan-ride ride-detail ride-detail--driver">
          <header className="plan-ride__top">
            <Link to="/my-trips" className="plan-ride__back" aria-label={t("driver.detail.back")}>
              <ArrowLeft className="size-5" />
            </Link>
            <h1 className="plan-ride__title">{t("driver.trips.title")}</h1>
            <span className="plan-ride__top-spacer" aria-hidden />
          </header>
          <DetailPageSkeleton />
        </div>
      </AppShell>
    );
  }

  const trip = (data ?? []).find((row) => row.id === tripId);

  if (!trip) {
    return (
      <AppShell title={t("driver.trips.title")} subtitle={t("driver.detail.shellSub")}>
        <div className="plan-ride ride-detail ride-detail--driver">
          <header className="plan-ride__top">
            <Link to="/my-trips" className="plan-ride__back" aria-label={t("driver.detail.back")}>
              <ArrowLeft className="size-5" />
            </Link>
            <h1 className="plan-ride__title">{t("driver.trips.title")}</h1>
            <span className="plan-ride__top-spacer" aria-hidden />
          </header>
          <EmptyState
            compact
            title={t("driver.detail.notFoundTitle")}
            description={t("driver.detail.notFoundDesc")}
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/my-trips">{t("driver.detail.back")}</Link>
              </Button>
            }
          />
        </div>
      </AppShell>
    );
  }

  const requestId = trip.request_id ?? trip.vehicle_requests?.id;
  if (isDispatcher && requestId) {
    return <Navigate to="/requests/$requestId" params={{ requestId }} />;
  }

  return (
    <AppShell title={t("driver.trips.title")} subtitle={t("driver.detail.shellSub")}>
      <DriverTripPanel trip={trip} />
    </AppShell>
  );
}
