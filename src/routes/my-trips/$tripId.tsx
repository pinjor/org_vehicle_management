import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
  const { driverId, user } = useAuth();
  const { t } = useI18n();
  const { data, isLoading } = useDriverTrips(driverId ?? undefined);
  const [issue, setIssue] = useState("");

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
      <AppShell title={t("driver.trips.title")} subtitle={t("driver.detail.loading")}>
        <DetailPageSkeleton />
      </AppShell>
    );
  }

  const trip = (data ?? []).find((row) => row.id === tripId);

  if (!trip) {
    return (
      <AppShell title={t("driver.trips.title")} subtitle={t("driver.detail.notFoundTitle")}>
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
      </AppShell>
    );
  }

  return (
    <AppShell
      title={trip.reference}
      subtitle={trip.vehicle_requests?.purpose ?? t("driver.detail.assignment")}
      actions={
        <Button asChild variant="ghost" size="sm" className="min-h-8 gap-1 px-2" tooltip={t("driver.detail.back")}>
          <Link to="/my-trips">
            <ArrowLeft className="size-3.5" />
            {t("driver.detail.trips")}
          </Link>
        </Button>
      }
    >
      <div className="role-dashboard page-stack">
        <DriverTripPanel
          trip={trip}
          driverId={driverId}
          userId={user.id}
          issue={issue}
          onIssueChange={setIssue}
        />
      </div>
    </AppShell>
  );
}
