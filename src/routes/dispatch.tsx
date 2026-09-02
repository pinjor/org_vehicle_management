import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Car, Clock, Radar, Users, Wrench } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AdminRequestCard, LiveTripCard } from "@/components/list-cards";
import { LookupChip, LookupMetaChip } from "@/components/lookup-chip";
import { ChipGroup, EmptyState, KpiCard, MetaChip, Panel } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { sortDispatchQueue, sortTripsList } from "@/lib/fleet";
import { useActiveTrips, useDecideRequest, useDrivers, useRequests, useVehicles } from "@/lib/queries";
import { cn } from "@/lib/utils";

const DISPATCH_UI_KEY = "fleetops.dispatch.ui";

type DispatchSectionId = "queue" | "vehicles" | "trips";
type DispatchSections = Record<DispatchSectionId, boolean>;

const DEFAULT_COLLAPSED: DispatchSections = {
  queue: false,
  vehicles: false,
  trips: false,
};

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "Dispatch console — FleetOps" },
      {
        name: "description",
        content:
          "Assign vehicles and drivers to approved requests using ranked recommendations, and watch live trips.",
      },
    ],
  }),
  component: DispatchPage,
});

function DispatchPage() {
  const { user } = useAuth();
  const { data } = useRequests();
  const trips = useActiveTrips();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const decide = useDecideRequest();
  const queue = sortDispatchQueue(
    (data ?? []).filter((r) => ["submitted", "approved"].includes(r.status)),
  );

  const [collapsed, setCollapsedState] = useState<DispatchSections>(() => {
    try {
      const raw = localStorage.getItem(DISPATCH_UI_KEY);
      if (!raw) return DEFAULT_COLLAPSED;
      const parsed = JSON.parse(raw) as { collapsed?: Partial<DispatchSections> };
      return { ...DEFAULT_COLLAPSED, ...parsed.collapsed };
    } catch {
      return DEFAULT_COLLAPSED;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(DISPATCH_UI_KEY, JSON.stringify({ collapsed }));
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  function setCollapsed(key: DispatchSectionId, value: boolean) {
    setCollapsedState((s) => ({ ...s, [key]: value }));
  }

  const fleet = vehicles.data ?? [];
  const availableVehicles = fleet.filter((v) => v.operational_status === "available");
  const busyVehicles = fleet.filter((v) => ["reserved", "on_trip"].includes(v.operational_status));
  const downVehicles = fleet.filter((v) =>
    ["under_maintenance", "unavailable", "out_of_service"].includes(v.operational_status),
  );
  const availableDrivers = (drivers.data ?? []).filter((d) => d.current_status === "available");
  const liveTrips = sortTripsList(trips.data ?? []);

  const queueBody =
    queue.length === 0 ? (
      <EmptyState flush title="Nothing pending" description="New requests show here." />
    ) : (
      <ul className="dispatch-console__cards">
        {queue.map((r) => {
          const canReject = !!user && r.status === "submitted";
          return (
            <li key={r.id}>
              <AdminRequestCard
                request={r}
                trailing={
                  canReject ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="btn-reject h-8 px-3 text-xs"
                      disabled={decide.isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
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
    );

  const vehiclesBody = (
    <ul className="dispatch-console__fleet">
      {availableVehicles.map((v) => (
        <li key={v.id} className="dispatch-console__fleet-row">
          <Link
            to="/fleet/$vehicleId"
            params={{ vehicleId: v.id }}
            className="dispatch-console__fleet-link"
          >
            <span className="dispatch-console__fleet-name">
              {v.fleet_number} · {v.name}
            </span>
            <ChipGroup className="mt-1">
              <LookupMetaChip group="vehicle_category" value={v.category} />
              <MetaChip label={`${v.seat_capacity} seats`} tone="neutral" />
            </ChipGroup>
          </Link>
          <LookupChip group="vehicle_status" value="available" />
        </li>
      ))}
      {busyVehicles.map((v) => (
        <li key={v.id} className="dispatch-console__fleet-row dispatch-console__fleet-row--busy">
          <span className="dispatch-console__fleet-name truncate">
            {v.fleet_number} · {v.name}
          </span>
          <LookupChip group="vehicle_status" value={v.operational_status} />
        </li>
      ))}
      {downVehicles.length > 0 ? (
        <li className="dispatch-console__fleet-row dispatch-console__fleet-row--down">
          <Wrench className="size-3.5 shrink-0 text-warning" aria-hidden />
          <MetaChip label={`+${downVehicles.length} unavailable / maintenance`} tone="warning" />
        </li>
      ) : null}
      {availableVehicles.length === 0 && busyVehicles.length === 0 && downVehicles.length === 0 ? (
        <li className="p-3">
          <EmptyState flush compact title="No vehicles" description="Fleet list is empty." />
        </li>
      ) : null}
    </ul>
  );

  const tripsBody =
    liveTrips.length === 0 ? (
      <EmptyState flush title="No live trips" description="Active trips show here." />
    ) : (
      <ul className="dispatch-console__cards">
        {liveTrips.map((t) => (
          <li key={t.id}>
            <LiveTripCard trip={t} />
          </li>
        ))}
      </ul>
    );

  return (
    <AppShell title="Dispatch" subtitle="Assign rides" fillViewport>
      <div className="dispatch-console">
        <div className="dispatch-console__kpis">
          <KpiCard label="Pending" value={queue.length} hint="To assign" tone="warning" icon={<Clock />} />
          <KpiCard
            label="Vehicles free"
            value={availableVehicles.length}
            hint={`${fleet.length} total`}
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
          <KpiCard label="Live" value={liveTrips.length} tone="info" icon={<Radar />} />
        </div>

        <div
          className={cn(
            "dispatch-console__board",
            collapsed.queue && "dispatch-console__board--queue-min",
            collapsed.vehicles && "dispatch-console__board--vehicles-min",
            collapsed.trips && "dispatch-console__board--trips-min",
          )}
        >
          <div className="dispatch-console__cell dispatch-console__cell--queue">
            <Panel
              title="Pending"
              description={
                collapsed.queue
                  ? `${queue.length} pending · tap to open`
                  : `${queue.length} to assign`
              }
              tone="warning"
              collapsible
              collapsed={collapsed.queue}
              onCollapsedChange={(v) => setCollapsed("queue", v)}
              compact
              scrollBody
              className="dispatch-console__panel"
              bodyClassName="dispatch-console__panel-body"
            >
              {queueBody}
            </Panel>
          </div>

          <div className="dispatch-console__cell dispatch-console__cell--trips">
            <Panel
              title="Live"
              description={
                collapsed.trips
                  ? `${liveTrips.length} active · tap to open`
                  : "Trips happening now"
              }
              tone="info"
              collapsible
              collapsed={collapsed.trips}
              onCollapsedChange={(v) => setCollapsed("trips", v)}
              compact
              scrollBody
              className="dispatch-console__panel"
              bodyClassName="dispatch-console__panel-body"
              action={
                <Button asChild size="sm" variant="outline" className="min-h-8" tooltip="Past trips">
                  <Link to="/trips">History</Link>
                </Button>
              }
            >
              {tripsBody}
            </Panel>
          </div>

          <div className="dispatch-console__cell dispatch-console__cell--vehicles">
            <Panel
              title="Vehicles"
              description={
                collapsed.vehicles
                  ? `${availableVehicles.length} available · tap to open`
                  : `${availableVehicles.length} free · ${busyVehicles.length} busy`
              }
              tone="success"
              collapsible
              collapsed={collapsed.vehicles}
              onCollapsedChange={(v) => setCollapsed("vehicles", v)}
              compact
              scrollBody
              className="dispatch-console__panel"
              bodyClassName="dispatch-console__panel-body"
            >
              {vehiclesBody}
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
