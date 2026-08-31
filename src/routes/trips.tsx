import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { RequestListSkeleton } from "@/components/loading-skeletons";
import { LookupChip, LookupMetaChip } from "@/components/lookup-chip";
import { ChipGroup, EmptyState, MetaChip, Panel } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { formatDateTime, relativeTime } from "@/lib/fleet";
import { useActiveTrips, useDecideRequest, useRequests } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [
      { title: "Trips — FleetOps" },
      { name: "description", content: "Incoming vehicle requests and live trip assignments." },
    ],
  }),
  component: TripsPage,
});

type TripsTab = "incoming" | "live";

function TripsPage() {
  const { isDispatcher, user } = useAuth();
  const [tab, setTab] = useState<TripsTab>("incoming");
  const [search, setSearch] = useState("");
  const requests = useRequests();
  const trips = useActiveTrips();
  const decide = useDecideRequest();

  const incoming = useMemo(() => {
    const rows = (requests.data ?? []).filter((r) => ["submitted", "approved"].includes(r.status));
    const sorted = [...rows].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((r) =>
      `${r.reference} ${r.requester_name} ${r.purpose} ${r.trip_type}`
        .toLowerCase()
        .includes(q),
    );
  }, [requests.data, search]);

  const liveTrips = useMemo(() => {
    const rows = trips.data ?? [];
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((t) =>
      `${t.reference} ${t.vehicle_requests?.purpose ?? ""} ${t.drivers?.full_name ?? ""} ${t.vehicles?.registration_number ?? ""} ${t.vehicles?.name ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [trips.data, search]);

  if (!isDispatcher) {
    return (
      <AppShell title="Trips" subtitle="Dispatch only">
        <EmptyState compact title="Not available" description="Trip board is for dispatch and admin." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Trips" subtitle="Incoming requests and live assignments">
      <div className="role-dashboard page-stack min-w-0 w-full max-w-full">
        <Panel tone="primary" compact className="min-w-0 max-w-full" bodyClassName="p-0 min-w-0 max-w-full overflow-hidden">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as TripsTab)}
            className="min-w-0"
          >
            <div className="space-y-2.5 border-b border-border p-3 sm:p-3.5">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto">
                <TabsTrigger value="incoming" className="gap-1.5 px-3 py-1.5">
                  Incoming
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
              </TabsList>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  tab === "incoming"
                    ? "Search reference, requester, purpose…"
                    : "Search trip, driver, vehicle…"
                }
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
                    title="No incoming requests"
                    description="New employee requests needing review or assign show here."
                  />
                </div>
              ) : (
                <ul key={`incoming-${search}`} className="list-stagger divide-y divide-border/60">
                  {incoming.map((r) => {
                    const canReject = !!user && r.status === "submitted";
                    return (
                      <li key={r.id} className="relative">
                        <Link
                          to="/requests/$requestId"
                          params={{ requestId: r.id }}
                          className={cn(
                            "flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors hover:bg-muted/40 sm:px-3.5",
                            canReject && "pb-10",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold">{r.reference}</p>
                            <LookupChip group="priority" value={r.priority} />
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {r.requester_name} · {r.purpose}
                          </p>
                          <ChipGroup className="mt-0.5">
                            <LookupChip group="request_status" value={r.status} />
                            <LookupMetaChip group="trip_type" value={r.trip_type} />
                            <MetaChip label={`${r.passenger_count} pax`} tone="neutral" />
                          </ChipGroup>
                          <p className="text-[11px] text-muted-foreground">
                            Pickup {formatDateTime(r.pickup_at)} · {relativeTime(r.pickup_at)}
                          </p>
                        </Link>
                        {canReject ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="btn-reject absolute right-3 bottom-2.5 h-7 px-2 text-xs"
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
                        ) : null}
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
                    description="Active assignments in progress show here."
                  />
                </div>
              ) : (
                <ul key={`live-${search}`} className="list-stagger space-y-2 p-3">
                  {liveTrips.map((t) => {
                    const cardClass =
                      "block rounded-xl border border-border bg-surface px-3 py-3 transition-colors hover:bg-muted/40 sm:px-3.5";
                    const inner = (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{t.reference}</p>
                            {t.vehicle_requests?.purpose ? (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {t.vehicle_requests.purpose}
                              </p>
                            ) : null}
                          </div>
                          <LookupChip group="trip_status" value={t.status} />
                        </div>
                        <ChipGroup className="mt-2">
                          {t.vehicles?.registration_number ? (
                            <MetaChip label={t.vehicles.registration_number} tone="primary" />
                          ) : null}
                          {t.vehicles?.name && !t.vehicles.registration_number ? (
                            <MetaChip label={t.vehicles.name} tone="primary" />
                          ) : null}
                          {t.drivers?.full_name ? (
                            <MetaChip label={t.drivers.full_name} tone="info" />
                          ) : null}
                        </ChipGroup>
                        {t.vehicle_requests?.pickup_at ? (
                          <p className="mt-1.5 text-[11px] text-muted-foreground">
                            Pickup {formatDateTime(t.vehicle_requests.pickup_at)} ·{" "}
                            {relativeTime(t.vehicle_requests.pickup_at)}
                          </p>
                        ) : null}
                      </>
                    );
                    return (
                      <li key={t.id}>
                        {t.request_id ? (
                          <Link
                            to="/requests/$requestId"
                            params={{ requestId: t.request_id }}
                            className={cardClass}
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div className={cardClass}>{inner}</div>
                        )}
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
