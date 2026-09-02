import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AdminRequestCard, LiveTripCard } from "@/components/list-cards";
import { RequestListSkeleton } from "@/components/loading-skeletons";
import { EmptyState, Panel } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { sortDispatchQueue, sortTripsList } from "@/lib/fleet";
import { useActiveTrips, useDecideRequest, useFleetTrips, useRequests, type TripRecord } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [
      { title: "Trips — FleetOps" },
      {
        name: "description",
        content: "Pending vehicle requests, live assignments, and completed trips.",
      },
    ],
  }),
  component: TripsPage,
});

type TripsTab = "incoming" | "live" | "completed";

function TripsPage() {
  const { isDispatcher, user } = useAuth();
  const [tab, setTab] = useState<TripsTab>("incoming");
  const [search, setSearch] = useState("");
  const requests = useRequests();
  const trips = useActiveTrips();
  const completedQuery = useFleetTrips("completed");
  const decide = useDecideRequest();

  const incoming = useMemo(() => {
    const rows = (requests.data ?? []).filter((r) => ["submitted", "approved"].includes(r.status));
    const sorted = sortDispatchQueue(rows);
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((r) =>
      `${r.reference} ${r.requester_name} ${r.purpose} ${r.trip_type}`
        .toLowerCase()
        .includes(q),
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

  if (!isDispatcher) {
    return (
      <AppShell title="Trips" subtitle="Dispatch only">
        <EmptyState compact title="Not available" description="Trip board is for dispatch and admin." />
      </AppShell>
    );
  }

  const searchPlaceholder =
    tab === "incoming"
      ? "Search…"
      : tab === "live"
        ? "Search…"
        : "Search…";

  return (
    <AppShell title="Trips" subtitle="Pending · Live · Done">
      <div className="role-dashboard page-stack min-w-0 w-full max-w-full">
        <Panel
          tone="primary"
          compact
          className="min-w-0 max-w-full"
          bodyClassName="p-0 min-w-0 max-w-full overflow-hidden"
        >
          <Tabs value={tab} onValueChange={(v) => setTab(v as TripsTab)} className="min-w-0">
            <div className="space-y-2.5 border-b border-border p-3 sm:p-3.5">
              <TabsList className="grid h-auto w-full grid-cols-3 gap-1 sm:inline-flex sm:w-auto">
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
                placeholder={searchPlaceholder}
                className="h-9 min-w-0 w-full"
              />
            </div>

            <TabsContent value="incoming" className="mt-0 focus-visible:outline-none">
              {requests.isLoading ? (
                <RequestListSkeleton />
              ) : incoming.length === 0 ? (
                <div className="p-3">
                  <EmptyState
                    compact
                    title="Nothing pending"
                    description="New requests show here."
                  />
                </div>
              ) : (
                <ul key={`incoming-${search}`} className="list-stagger space-y-2 p-3 lg:space-y-2.5">
                  {incoming.map((r) => {
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
              )}
            </TabsContent>

            <TabsContent value="live" className="mt-0 focus-visible:outline-none">
              {trips.isLoading ? (
                <RequestListSkeleton />
              ) : liveTrips.length === 0 ? (
                <div className="p-3">
                  <EmptyState
                    compact
                    title="No live trips"
                    description="Active trips show here."
                  />
                </div>
              ) : (
                <ul key={`live-${search}`} className="list-stagger space-y-2 p-3">
                  {liveTrips.map((t) => (
                    <li key={t.id}>
                      <LiveTripCard trip={t} />
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-0 focus-visible:outline-none">
              {completedQuery.isLoading ? (
                <RequestListSkeleton />
              ) : completedTrips.length === 0 ? (
                <div className="p-3">
                  <EmptyState
                    compact
                    title="No completed trips"
                    description="Finished trips show here."
                  />
                </div>
              ) : (
                <ul key={`completed-${search}`} className="list-stagger space-y-2 p-3">
                  {completedTrips.map((t) => {
                    const trip: TripRecord = {
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
                              ...(t.vehicle_requests.purpose
                                ? { purpose: t.vehicle_requests.purpose }
                                : {}),
                              ...(t.vehicle_requests.pickup_at
                                ? { pickup_at: t.vehicle_requests.pickup_at }
                                : {}),
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
                                ? { request_route_points: t.vehicle_requests.request_route_points }
                                : {}),
                            },
                          }
                        : {}),
                    };
                    return (
                      <li key={t.id}>
                        <LiveTripCard trip={trip} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </Panel>
      </div>
    </AppShell>
  );
}
