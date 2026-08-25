import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Car, Clock, Radar, Route as RouteIcon, Wrench } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LookupChip, LookupMetaChip } from "@/components/lookup-chip";
import { ChipGroup, EmptyState, KpiCard, KpiGrid, MetaChip, Panel } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { useActiveTrips, useRequests, useVehicles } from "@/lib/queries";
import { formatDateTime, relativeTime } from "@/lib/fleet";

const DISPATCH_UI_KEY = "fleetops.dispatch.ui";

type DispatchSectionId = "queue" | "vehicles" | "trips";
type DispatchSections = Record<DispatchSectionId, boolean>;

const DEFAULT_COLLAPSED: DispatchSections = {
  queue: false,
  vehicles: false,
  trips: false,
};

const DISPATCH_SECTION_ORDER: DispatchSectionId[] = ["queue", "vehicles", "trips"];

type SectionOptions = {
  scrollBody?: boolean;
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
  const { data } = useRequests();
  const trips = useActiveTrips();
  const vehicles = useVehicles();
  const queue = (data ?? []).filter((r) => ["submitted", "under_review", "approved"].includes(r.status));

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

  const queueDescription = collapsed.queue
    ? `${queue.length} pending · click to expand`
    : "Open a request to review and assign";

  const queueBody =
    queue.length === 0 ? (
      <EmptyState flush title="No pending requests" description="New employee requests will pop up here." />
    ) : (
      <ul className="divide-y divide-border/60">
        {[...queue]
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map((r) => (
            <li key={r.id}>
              <Link to="/requests/$requestId" params={{ requestId: r.id }} className={cnQueueItem()}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{r.reference}</p>
                  <LookupChip group="priority" value={r.priority} />
                </div>
                <p className="truncate text-xs text-muted-foreground">{r.requester_name}</p>
                <ChipGroup className="mt-1.5">
                  <LookupChip group="request_status" value={r.status} />
                  <LookupMetaChip group="trip_type" value={r.trip_type} />
                  <MetaChip label={`${r.passenger_count} pax`} tone="neutral" />
                </ChipGroup>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pickup {formatDateTime(r.pickup_at)} · {relativeTime(r.pickup_at)}
                </p>
              </Link>
            </li>
          ))}
      </ul>
    );

  const vehiclesBody = (
    <ul className="divide-y divide-border/60 pb-1 text-sm">
      {availableVehicles.map((v) => (
        <li key={v.id} className="flex items-center justify-between gap-2 px-4 py-2">
          <Link to="/fleet/$vehicleId" params={{ vehicleId: v.id }} className="min-w-0 hover:text-primary">
            <p className="truncate font-medium">
              {v.fleet_number} · {v.name}
            </p>
            <ChipGroup className="mt-1">
              <LookupMetaChip group="vehicle_category" value={v.category} />
              <MetaChip label={`${v.seat_capacity} seats`} tone="neutral" />
            </ChipGroup>
          </Link>
          <LookupChip group="vehicle_status" value="available" />
        </li>
      ))}
      {busyVehicles.map((v) => (
        <li key={v.id} className="flex items-center justify-between gap-2 px-4 py-2 opacity-85">
          <span className="min-w-0 truncate">
            {v.fleet_number} · {v.name}
          </span>
          <LookupChip group="vehicle_status" value={v.operational_status} />
        </li>
      ))}
      {downVehicles.length > 0 && (
        <li className="flex items-center gap-2 px-4 py-2">
          <Wrench className="size-3.5 text-warning" />
          <MetaChip label={`+${downVehicles.length} unavailable / maintenance`} tone="warning" />
        </li>
      )}
    </ul>
  );

  const liveTrips = trips.data ?? [];
  const tripsBody =
    liveTrips.length === 0 ? (
      <div className="p-3">
        <EmptyState flush title="No live trips" description="Active assignments show here." />
      </div>
    ) : (
      <ul className="space-y-2 p-3">
        {liveTrips.map((t) => {
          const inner = (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.reference}</p>
                  {t.vehicle_requests?.purpose && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.vehicle_requests.purpose}</p>
                  )}
                </div>
                <LookupChip group="trip_status" value={t.status} />
              </div>
              <ChipGroup className="mt-2">
                {t.vehicles?.registration_number && (
                  <MetaChip label={t.vehicles.registration_number} tone="primary" />
                )}
                {t.drivers?.full_name && <MetaChip label={t.drivers.full_name} tone="info" />}
              </ChipGroup>
              {t.vehicle_requests?.pickup_at && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Pickup {formatDateTime(t.vehicle_requests.pickup_at)} ·{" "}
                  {relativeTime(t.vehicle_requests.pickup_at)}
                </p>
              )}
            </>
          );

          const cardClass =
            "block rounded-xl border border-border bg-background/80 px-3 py-3 shadow-sm transition-colors hover:border-primary/25 hover:bg-muted/30";

          return (
            <li key={t.id}>
              {t.request_id ? (
                <Link to="/requests/$requestId" params={{ requestId: t.request_id }} className={cardClass}>
                  {inner}
                </Link>
              ) : (
                <div className={cardClass}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    );

  function renderSection(section: DispatchSectionId, opts: SectionOptions = {}) {
    const isCollapsed = collapsed[section];
    const scrollBody = opts.scrollBody === true;

    if (section === "queue") {
      return (
        <Panel
          key={section}
          title="Incoming requests"
          description={queueDescription}
          tone="warning"
          collapsible
          collapsed={isCollapsed}
          onCollapsedChange={(v) => setCollapsed("queue", v)}
          compact
          {...(scrollBody ? { scrollBody: true } : {})}
          bodyClassName="flex flex-col gap-0 p-0"
        >
          {queueBody}
        </Panel>
      );
    }

    if (section === "vehicles") {
      return (
        <Panel
          key={section}
          title="Vehicle availability"
          description={
            isCollapsed
              ? `${availableVehicles.length} available · click to expand`
              : `${availableVehicles.length} available now`
          }
          tone="success"
          collapsible
          collapsed={isCollapsed}
          onCollapsedChange={(v) => setCollapsed("vehicles", v)}
          compact
          {...(scrollBody ? { scrollBody: true } : {})}
          bodyClassName="p-0 pb-3"
        >
          {vehiclesBody}
        </Panel>
      );
    }

    return (
      <Panel
        key={section}
        title="Live trips"
        description={
          isCollapsed
            ? `${liveTrips.length} active · click to expand`
            : "Trips in progress right now"
        }
        tone="info"
        collapsible
        collapsed={isCollapsed}
        onCollapsedChange={(v) => setCollapsed("trips", v)}
        compact
        {...(scrollBody ? { scrollBody: true } : {})}
        bodyClassName="flex flex-col p-0"
        action={
          <Button asChild size="sm" variant="outline" className="min-h-8" tooltip="Browse completed trips">
            <Link to="/trips">History</Link>
          </Button>
        }
      >
        {tripsBody}
      </Panel>
    );
  }

  const leftExpanded = Number(!collapsed.queue) + Number(!collapsed.vehicles);

  function leftSectionShell(section: "queue" | "vehicles") {
    const isCollapsed = collapsed[section];
    if (isCollapsed) return "flex shrink-0 flex-col";
    if (leftExpanded === 2) return section === "queue" ? "flex min-h-0 flex-[44] flex-col" : "flex min-h-0 flex-[56] flex-col";
    return "flex min-h-0 flex-1 flex-col";
  }

  return (
    <AppShell title="Admin dispatch" subtitle="Open a request to review and assign" fillViewport>
      <div className="dispatch-console page-stack flex min-h-0 flex-1 flex-col gap-4 lg:overflow-hidden">
        <KpiGrid className="shrink-0">
          <KpiCard label="Pending requests" value={queue.length} hint="Need assignment" tone="warning" icon={<Clock />} />
          <KpiCard
            label="Available vehicles"
            value={availableVehicles.length}
            hint={`of ${fleet.length} total`}
            tone="success"
            icon={<Car />}
          />
          <KpiCard label="Assigned / on trip" value={busyVehicles.length} tone="primary" icon={<RouteIcon />} />
          <KpiCard label="Live trips" value={liveTrips.length} tone="info" icon={<Radar />} />
        </KpiGrid>

        <div className="hidden min-h-0 flex-1 lg:flex lg:gap-4">
          <div className="flex min-h-0 min-w-0 flex-[1.35] flex-col gap-4">
            <div className={leftSectionShell("queue")}>{renderSection("queue", { scrollBody: true })}</div>
            <div className={leftSectionShell("vehicles")}>{renderSection("vehicles", { scrollBody: true })}</div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {renderSection("trips", { scrollBody: true })}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:hidden">
          {DISPATCH_SECTION_ORDER.map((section) => renderSection(section))}
        </div>
      </div>
    </AppShell>
  );
}

function cnQueueItem() {
  return "block w-full px-4 py-3 text-left transition-colors hover:bg-primary/5";
}
