import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Car, Clock, Radar, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AdminRequestCard, LiveTripCard } from "@/components/list-cards";
import { RequestListSkeleton } from "@/components/loading-skeletons";
import { EmptyState, KpiCard, KpiGrid, Panel } from "@/components/fleet-ui";
import {
  DualList,
  RequestTableRow,
  TripListTable,
  TripTableRow,
} from "@/components/trip-list-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { sortDispatchQueue, sortTripsList } from "@/lib/fleet";
import {
  useActiveTrips,
  useDecideRequest,
  useDrivers,
  useFleetTrips,
  useRequests,
  useVehicles,
  type FleetTripRow,
  type TripRecord,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [
      { title: "Trips — Vehicle Management System" },
      {
        name: "description",
        content: "Pending vehicle requests, live assignments, and completed trips.",
      },
    ],
  }),
  component: TripsPage,
});

type TripsTab = "incoming" | "live" | "completed";

function rejectBtn(canReject: boolean, pending: boolean, onReject: () => void): ReactNode {
  if (!canReject) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="btn-reject h-8 px-3 text-xs"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onReject();
      }}
    >
      Reject
    </Button>
  );
}

function toTripRecord(t: FleetTripRow): TripRecord {
  return {
    id: t.id,
    reference: t.reference,
    status: t.status,
    created_at: t.created_at,
    request_id: t.request_id,
    ...(t.vehicles
      ? {
          vehicles: {
            name: t.vehicles.name ?? "",
            ...(t.vehicles.registration_number
              ? { registration_number: t.vehicles.registration_number }
              : {}),
          },
        }
      : {}),
    ...(t.drivers
      ? {
          drivers: {
            full_name: t.drivers.full_name ?? "",
            ...(t.drivers.phone ? { phone: t.drivers.phone } : {}),
          },
        }
      : {}),
    ...(t.vehicle_requests
      ? {
          vehicle_requests: {
            ...(t.vehicle_requests.purpose ? { purpose: t.vehicle_requests.purpose } : {}),
            ...(t.vehicle_requests.pickup_at ? { pickup_at: t.vehicle_requests.pickup_at } : {}),
            ...(t.vehicle_requests.passenger_count != null
              ? { passenger_count: t.vehicle_requests.passenger_count }
              : {}),
            ...(t.vehicle_requests.requester_name
              ? { requester_name: t.vehicle_requests.requester_name }
              : {}),
            ...(t.vehicle_requests.requester_phone
              ? { requester_phone: t.vehicle_requests.requester_phone }
              : {}),
            ...(t.vehicle_requests.request_route_points
              ? {
                  request_route_points: t.vehicle_requests.request_route_points.map((p, i) => ({
                    sequence: p.sequence ?? i,
                    name: p.name,
                    ...(p.address != null ? { address: p.address } : {}),
                    latitude: null,
                    longitude: null,
                    point_type: p.point_type,
                  })),
                }
              : {}),
          },
        }
      : {}),
  };
}

function TripsPage() {
  const { isDispatcher, user } = useAuth();
  const [tab, setTab] = useState<TripsTab>("incoming");
  const [search, setSearch] = useState("");
  const requests = useRequests();
  const trips = useActiveTrips();
  const completedQuery = useFleetTrips("completed");
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const decide = useDecideRequest();

  const incoming = useMemo(() => {
    const rows = (requests.data ?? []).filter((r) => ["submitted", "approved"].includes(r.status));
    const sorted = sortDispatchQueue(rows);
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((r) =>
      `${r.reference} ${r.requester_name} ${r.purpose} ${r.trip_type}`.toLowerCase().includes(q),
    );
  }, [requests.data, search]);

  const liveTrips = useMemo(() => {
    const rows = sortTripsList(trips.data ?? []);
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((t) =>
      `${t.reference} ${t.vehicle_requests?.purpose ?? ""} ${t.drivers?.full_name ?? ""} ${t.vehicles?.registration_number ?? ""} ${t.vehicles?.name ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [trips.data, search]);

  const completedTrips = useMemo(() => {
    const rows = sortTripsList(completedQuery.data ?? []);
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((t) =>
      `${t.reference} ${t.vehicle_requests?.purpose ?? ""} ${t.vehicle_requests?.requester_name ?? ""} ${t.drivers?.full_name ?? ""} ${t.vehicles?.registration_number ?? ""} ${t.vehicles?.name ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [completedQuery.data, search]);

  const fleet = vehicles.data ?? [];
  const availableVehicles = fleet.filter((v) => v.operational_status === "available");
  const availableDrivers = (drivers.data ?? []).filter((d) => d.current_status === "available");

  if (!isDispatcher) {
    return (
      <AppShell title="Trips" subtitle="Admin only">
        <EmptyState compact title="Not available" description="Trip board is for transport admin." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Trips" subtitle="Pending · Live · Done" fillViewport>
      <div className="role-dashboard page-stack page-stack--fill min-w-0 w-full max-w-full">
        <KpiGrid fit="auto" className="kpi-grid--compact shrink-0">
          <KpiCard
            compact
            label="Pending"
            value={incoming.length}
            tone="warning"
            icon={<Clock />}
          />
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
          <KpiCard compact label="Live" value={liveTrips.length} tone="info" icon={<Radar />} />
        </KpiGrid>

        <Panel
          tone="primary"
          compact
          className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col"
          bodyClassName="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden p-0"
        >
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as TripsTab)}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <div className="list-toolbar shrink-0 border-b border-border p-3 sm:p-3.5">
              <TabsList className="list-toolbar__tabs">
                <TabsTrigger value="incoming" className="gap-1.5 px-3 py-1.5">
                  Pending
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums",
                      tab === "incoming"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted-foreground/15 text-muted-foreground",
                    )}
                  >
                    {incoming.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="live" className="gap-1.5 px-3 py-1.5">
                  Live
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums",
                      tab === "live"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted-foreground/15 text-muted-foreground",
                    )}
                  >
                    {liveTrips.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-1.5 px-3 py-1.5">
                  Completed
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums",
                      tab === "completed"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted-foreground/15 text-muted-foreground",
                    )}
                  >
                    {completedTrips.length}
                  </span>
                </TabsTrigger>
              </TabsList>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="list-toolbar__search"
              />
            </div>

            <TabsContent
              value="incoming"
              className="mt-0 min-h-0 flex-1 overflow-auto focus-visible:outline-none data-[state=inactive]:hidden"
            >
              {requests.isLoading ? (
                <RequestListSkeleton />
              ) : incoming.length === 0 ? (
                <div className="p-3">
                  <EmptyState compact title="Nothing pending" description="New requests show here." />
                </div>
              ) : (
                <DualList
                  fill={false}
                  cards={
                    <ul key={`incoming-m-${search}`} className="list-stagger space-y-2 p-3">
                      {incoming.map((r) => {
                        const canReject = !!user && r.status === "submitted";
                        return (
                          <li key={r.id}>
                            <AdminRequestCard
                              request={r}
                              trailing={rejectBtn(canReject, decide.isPending, () => {
                                if (!user) return;
                                decide.mutate(
                                  { requestId: r.id, approve: false, actorId: user.id },
                                  {
                                    onSuccess: () => toast.success(`Rejected ${r.reference}`),
                                    onError: (err) => toast.error(err.message),
                                  },
                                );
                              })}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  }
                  table={
                    <TripListTable
                      className="trip-list-board--pending"
                      headers={["Time", "Employee", "Route", "Passengers", "Status"]}
                    >
                      {incoming.map((r) => (
                        <RequestTableRow key={r.id} request={r} showActions={false} />
                      ))}
                    </TripListTable>
                  }
                />
              )}
            </TabsContent>

            <TabsContent
              value="live"
              className="mt-0 min-h-0 flex-1 overflow-hidden focus-visible:outline-none data-[state=inactive]:hidden"
            >
              {trips.isLoading ? (
                <RequestListSkeleton />
              ) : liveTrips.length === 0 ? (
                <div className="p-3">
                  <EmptyState compact title="No live trips" description="Active trips show here." />
                </div>
              ) : (
                <DualList
                  cards={
                    <ul key={`live-m-${search}`} className="list-stagger space-y-2 p-3">
                      {liveTrips.map((t) => (
                        <li key={t.id}>
                          <LiveTripCard trip={t} />
                        </li>
                      ))}
                    </ul>
                  }
                  table={
                    <TripListTable
                      fill
                      headers={[
                        "Time",
                        "Employee",
                        "Route",
                        "Passengers",
                        "Driver",
                        "Vehicle",
                        "Status",
                      ]}
                    >
                      {liveTrips.map((t) => (
                        <TripTableRow key={t.id} trip={t} showActions={false} />
                      ))}
                    </TripListTable>
                  }
                />
              )}
            </TabsContent>

            <TabsContent
              value="completed"
              className="mt-0 min-h-0 flex-1 overflow-hidden focus-visible:outline-none data-[state=inactive]:hidden"
            >
              {completedQuery.isLoading ? (
                <RequestListSkeleton />
              ) : completedTrips.length === 0 ? (
                <div className="p-3">
                  <EmptyState compact title="No completed trips" description="Finished trips show here." />
                </div>
              ) : (
                <DualList
                  cards={
                    <ul key={`completed-m-${search}`} className="list-stagger space-y-2 p-3">
                      {completedTrips.map((t) => (
                        <li key={t.id}>
                          <LiveTripCard trip={toTripRecord(t)} />
                        </li>
                      ))}
                    </ul>
                  }
                  table={
                    <TripListTable
                      fill
                      headers={[
                        "Time",
                        "Employee",
                        "Route",
                        "Passengers",
                        "Driver",
                        "Vehicle",
                        "Status",
                      ]}
                    >
                      {completedTrips.map((t) => (
                        <TripTableRow key={t.id} trip={toTripRecord(t)} showActions={false} />
                      ))}
                    </TripListTable>
                  }
                />
              )}
            </TabsContent>
          </Tabs>
        </Panel>
      </div>
    </AppShell>
  );
}
