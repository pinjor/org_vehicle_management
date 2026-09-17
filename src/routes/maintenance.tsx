import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ClipboardList, FileWarning, MoreHorizontal, Plus, Wrench } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { WhenRail } from "@/components/info-blocks";
import { ReportVehicleIssueDialog } from "@/components/report-vehicle-issue-dialog";
import { EmptyState, KpiCard, KpiGrid, Panel, StatusChip } from "@/components/fleet-ui";
import { PanelSkeleton } from "@/components/loading-skeletons";
import {
  DualList,
  ListWhenCell,
  TripListTable,
} from "@/components/trip-list-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
  useReviewUnavailability,
  useUnavailabilityRequests,
  useVehicles,
  type UnavailabilityRow,
} from "@/lib/queries";
import { SEVERITY, UNAVAILABILITY_STATUS, VEHICLE_STATUS } from "@/lib/fleet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/maintenance")({
  head: () => ({
    meta: [
      { title: "Maintenance desk — Vehicle Management System" },
      {
        name: "description",
        content:
          "Review vehicle unavailability reports, send vehicles to maintenance and return them to service.",
      },
      { property: "og:title", content: "Maintenance desk — Vehicle Management System" },
      { property: "og:description", content: "Approve breakdown reports and manage vehicle downtime." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MaintenancePage,
});

type MaintTab = "pending" | "shop" | "all";

type ShopVehicle = {
  id: string;
  registration_number?: string | null;
  name?: string | null;
  fleet_number?: string | null;
  operational_status: string;
  openReport?: UnavailabilityRow | undefined;
};

type ReviewDecision = "sent_to_maintenance" | "approved_unavailable" | "resolved" | "rejected";

const PRIMARY_DECISION = {
  decision: "sent_to_maintenance" as const,
  label: "To shop",
};

const MORE_DECISIONS = [
  { decision: "approved_unavailable" as const, label: "Mark unavailable" },
  { decision: "resolved" as const, label: "Mark fixed" },
  { decision: "rejected" as const, label: "Reject report", destructive: true },
];

function vehicleLabel(r: UnavailabilityRow) {
  return r.vehicles?.registration_number ?? r.vehicles?.name ?? "Vehicle";
}

function reasonLabel(reason: string) {
  return reason.replace(/_/g, " ");
}

function PendingActions({
  report,
  userId,
  notes,
  setNote,
  reviewPending,
  onReview,
  compact,
}: {
  report: UnavailabilityRow;
  userId: string;
  notes: Record<string, string>;
  setNote: (id: string, value: string) => void;
  reviewPending: boolean;
  onReview: (
    input: {
      id: string;
      vehicleId: string;
      decision: ReviewDecision;
      note: string;
      actorId: string;
    },
    label: string,
  ) => void;
  compact?: boolean;
}) {
  const run = (decision: ReviewDecision, label: string) =>
    onReview(
      {
        id: report.id,
        vehicleId: report.vehicle_id,
        decision,
        note: notes[report.id] ?? "",
        actorId: userId,
      },
      label,
    );

  return (
    <div
      className={cn("flex gap-2", compact ? "items-center justify-end" : "flex-col")}
      onClick={(e) => e.stopPropagation()}
    >
      {!compact ? (
        <Textarea
          rows={2}
          placeholder="Note for driver (optional)"
          value={notes[report.id] ?? ""}
          onChange={(e) => setNote(report.id, e.target.value)}
          className="min-h-16 text-sm"
        />
      ) : null}
      <div className={cn("flex items-center gap-1.5", !compact && "w-full")}>
        <Button
          type="button"
          size="sm"
          className={cn("h-8", !compact && "min-w-0 flex-1")}
          disabled={reviewPending}
          onClick={() => run(PRIMARY_DECISION.decision, PRIMARY_DECISION.label)}
        >
          {PRIMARY_DECISION.label}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1 px-2.5"
              disabled={reviewPending}
              aria-label="More decisions"
            >
              {compact ? (
                <MoreHorizontal className="size-4" />
              ) : (
                <>
                  More
                  <ChevronDown className="size-3.5 opacity-70" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            {MORE_DECISIONS.map((item, i) => (
              <div key={item.decision}>
                {item.destructive && i > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  disabled={reviewPending}
                  className={cn(item.destructive && "text-destructive focus:text-destructive")}
                  onSelect={() => run(item.decision, item.label)}
                >
                  {item.label}
                </DropdownMenuItem>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ResolveBtn({
  report,
  userId,
  note,
  reviewPending,
  onReview,
  compact,
}: {
  report: UnavailabilityRow;
  userId: string;
  note?: string;
  reviewPending: boolean;
  onReview: (input: {
    id: string;
    vehicleId: string;
    decision: "resolved";
    note: string;
    actorId: string;
  }) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn(compact && "flex justify-end")} onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        size="sm"
        className={cn("h-8", !compact && "w-full")}
        disabled={reviewPending}
        onClick={() =>
          onReview({
            id: report.id,
            vehicleId: report.vehicle_id,
            decision: "resolved",
            note: note ?? "Returned to service",
            actorId: userId,
          })
        }
      >
        Back in service
      </Button>
    </div>
  );
}

function ReportCard({
  report,
  actions,
}: {
  report: UnavailabilityRow;
  actions?: ReactNode;
}) {
  const plate = vehicleLabel(report);
  const main = (
    <>
      <WhenRail at={report.created_at} size="sm" className="ops-card__when" />
      <div className="ops-card__body min-w-0 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">{plate}</p>
            <p className="trip-list-table__muted mt-0.5 capitalize">
              {reasonLabel(report.reason)}
              {report.drivers?.full_name ? ` · ${report.drivers.full_name}` : ""}
            </p>
          </div>
          <StatusChip
            label={UNAVAILABILITY_STATUS[report.status]?.label ?? report.status.replace(/_/g, " ")}
            tone={UNAVAILABILITY_STATUS[report.status]?.tone ?? "neutral"}
          />
        </div>
        {report.description ? (
          <p className="text-sm text-muted-foreground line-clamp-2">{report.description}</p>
        ) : null}
        <StatusChip
          label={SEVERITY[report.severity]?.label ?? report.severity}
          tone={SEVERITY[report.severity]?.tone ?? "neutral"}
        />
      </div>
    </>
  );

  return (
    <div className={cn("ops-card", report.status === "pending" && "ops-card--hot")}>
      {report.vehicle_id ? (
        <Link
          to="/fleet/$vehicleId"
          params={{ vehicleId: report.vehicle_id }}
          className="ops-card__main"
        >
          {main}
        </Link>
      ) : (
        <div className="ops-card__main">{main}</div>
      )}
      {actions ? (
        <div className="ops-card__actions border-t border-border p-3" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function ShopCard({
  vehicle,
  actions,
}: {
  vehicle: ShopVehicle;
  actions?: ReactNode;
}) {
  const main = (
    <>
      {vehicle.openReport ? (
        <WhenRail at={vehicle.openReport.created_at} size="sm" className="ops-card__when" />
      ) : (
        <div className="ops-card__when" />
      )}
      <div className="ops-card__body min-w-0 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {vehicle.registration_number ?? vehicle.name ?? "Vehicle"}
              {vehicle.fleet_number ? (
                <span className="ml-1.5 text-xs font-medium text-muted-foreground">{vehicle.fleet_number}</span>
              ) : null}
            </p>
            {vehicle.openReport ? (
              <p className="trip-list-table__muted mt-0.5 capitalize">
                {reasonLabel(vehicle.openReport.reason)}
              </p>
            ) : null}
          </div>
          <StatusChip
            label={VEHICLE_STATUS[vehicle.operational_status]?.label ?? vehicle.operational_status}
            tone={VEHICLE_STATUS[vehicle.operational_status]?.tone ?? "warning"}
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="ops-card">
      <Link to="/fleet/$vehicleId" params={{ vehicleId: vehicle.id }} className="ops-card__main">
        {main}
      </Link>
      {actions ? (
        <div className="ops-card__actions border-t border-border p-3" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function ReportTableRow({
  report,
  actions,
}: {
  report: UnavailabilityRow;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  const plate = vehicleLabel(report);
  return (
    <tr
      className={cn(report.vehicle_id && "trip-list-table__row--link")}
      onClick={() => {
        if (!report.vehicle_id) return;
        navigate({ to: "/fleet/$vehicleId", params: { vehicleId: report.vehicle_id } });
      }}
    >
      <td>
        <ListWhenCell at={report.created_at} />
      </td>
      <td>
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium leading-snug break-words">{plate}</p>
          {report.vehicles?.fleet_number ? (
            <p className="trip-list-table__muted truncate">{report.vehicles.fleet_number}</p>
          ) : null}
        </div>
      </td>
      <td>
        <div className="min-w-0">
          <p className="capitalize font-medium">{reasonLabel(report.reason)}</p>
          {report.description ? (
            <p className="trip-list-table__muted line-clamp-2">{report.description}</p>
          ) : null}
        </div>
      </td>
      <td>
        <div className="min-w-0">
          <p className="truncate font-medium">{report.drivers?.full_name?.trim() || "—"}</p>
          {report.drivers?.phone ? (
            <p className="trip-list-table__muted truncate">{report.drivers.phone}</p>
          ) : null}
        </div>
      </td>
      <td>
        <StatusChip
          label={SEVERITY[report.severity]?.label ?? report.severity}
          tone={SEVERITY[report.severity]?.tone ?? "neutral"}
        />
      </td>
      <td>
        <StatusChip
          label={UNAVAILABILITY_STATUS[report.status]?.label ?? report.status.replace(/_/g, " ")}
          tone={UNAVAILABILITY_STATUS[report.status]?.tone ?? "neutral"}
        />
      </td>
      <td className="text-right">
        <div className="trip-list-table__actions justify-end" onClick={(e) => e.stopPropagation()}>
          {actions ?? <span className="text-muted-foreground">—</span>}
        </div>
      </td>
    </tr>
  );
}

function ShopTableRow({
  vehicle,
  actions,
}: {
  vehicle: ShopVehicle;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <tr
      className="trip-list-table__row--link"
      onClick={() => navigate({ to: "/fleet/$vehicleId", params: { vehicleId: vehicle.id } })}
    >
      <td>
        {vehicle.openReport ? (
          <ListWhenCell at={vehicle.openReport.created_at} />
        ) : (
          <span className="trip-list-table__empty">—</span>
        )}
      </td>
      <td>
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium leading-snug break-words">
            {vehicle.registration_number ?? vehicle.name ?? "Vehicle"}
          </p>
          {vehicle.fleet_number ? (
            <p className="trip-list-table__muted truncate">{vehicle.fleet_number}</p>
          ) : null}
        </div>
      </td>
      <td>
        <p className="capitalize font-medium">
          {vehicle.openReport ? reasonLabel(vehicle.openReport.reason) : "—"}
        </p>
      </td>
      <td>
        <StatusChip
          label={VEHICLE_STATUS[vehicle.operational_status]?.label ?? vehicle.operational_status}
          tone={VEHICLE_STATUS[vehicle.operational_status]?.tone ?? "warning"}
        />
      </td>
      <td className="text-right">
        <div className="trip-list-table__actions justify-end" onClick={(e) => e.stopPropagation()}>
          {actions ?? <span className="text-muted-foreground">—</span>}
        </div>
      </td>
    </tr>
  );
}

function MaintenancePage() {
  const { data, isLoading } = useUnavailabilityRequests();
  const vehicles = useVehicles();
  const review = useReviewUnavailability();
  const { user, isDispatcher } = useAuth();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [logOpen, setLogOpen] = useState(false);
  const [tab, setTab] = useState<MaintTab>("pending");
  const [search, setSearch] = useState("");

  const rows = data ?? [];

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rows]);

  const pending = useMemo(() => {
    const list = sorted.filter((r) => r.status === "pending");
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((r) =>
      `${r.reference} ${vehicleLabel(r)} ${r.reason} ${r.drivers?.full_name ?? ""} ${r.description ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [sorted, search]);

  const allReports = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter((r) =>
      `${r.reference} ${vehicleLabel(r)} ${r.reason} ${r.status} ${r.drivers?.full_name ?? ""} ${r.description ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [sorted, search]);

  const inShop = useMemo(() => {
    const list: ShopVehicle[] = (vehicles.data ?? [])
      .filter((v) => v.operational_status === "under_maintenance")
      .map((v) => ({
        id: v.id,
        registration_number: v.registration_number,
        name: v.name,
        fleet_number: v.fleet_number,
        operational_status: v.operational_status,
        openReport: rows.find(
          (r) =>
            r.vehicle_id === v.id &&
            (r.status === "sent_to_maintenance" || r.status === "approved_unavailable"),
        ),
      }));
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((v) =>
      `${v.registration_number ?? ""} ${v.name ?? ""} ${v.fleet_number ?? ""} ${v.openReport?.reason ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [vehicles.data, rows, search]);

  const setNote = (id: string, value: string) => setNotes((n) => ({ ...n, [id]: value }));

  const runReview = (
    input: {
      id: string;
      vehicleId: string;
      decision: "sent_to_maintenance" | "approved_unavailable" | "resolved" | "rejected";
      note: string;
      actorId: string;
    },
    successLabel: string,
  ) => {
    review.mutate(input, {
      onSuccess: () => toast.success(successLabel),
      onError: (e) => toast.error(e.message),
    });
  };

  if (!isDispatcher) {
    return (
      <AppShell title="Maintenance" subtitle="Admin only">
        <EmptyState compact title="Not available" description="Maintenance desk is for transport admin." />
      </AppShell>
    );
  }

  const reportActions = (r: UnavailabilityRow, compact?: boolean) => {
    if (!user) return null;
    if (r.status === "pending") {
      return (
        <PendingActions
          report={r}
          userId={user.id}
          notes={notes}
          setNote={setNote}
          reviewPending={review.isPending}
          onReview={(input, label) => runReview(input, `Report ${label.toLowerCase()}`)}
          {...(compact ? { compact: true } : {})}
        />
      );
    }
    if (r.status === "sent_to_maintenance" || r.status === "approved_unavailable") {
      return (
        <ResolveBtn
          report={r}
          userId={user.id}
          {...(notes[r.id] ? { note: notes[r.id] } : {})}
          reviewPending={review.isPending}
          onReview={(input) => runReview(input, "Report resolved")}
          {...(compact ? { compact: true } : {})}
        />
      );
    }
    return null;
  };

  return (
    <AppShell
      title="Maintenance"
      subtitle="Pending · In shop · Reports"
      fillViewport
      actions={
        <Button size="sm" onClick={() => setLogOpen(true)} tooltip="Log a fleet vehicle issue">
          <Plus className="size-4" /> Log issue
        </Button>
      }
    >
      <div className="role-dashboard page-stack page-stack--fill min-w-0 w-full max-w-full">
        <KpiGrid fit="auto" className="shrink-0">
          <KpiCard label="Pending" value={pending.length} hint="Need review" tone="warning" icon={<FileWarning />} />
          <KpiCard label="In shop" value={inShop.length} hint="Under maintenance" tone="info" icon={<Wrench />} />
          <KpiCard label="Reports" value={rows.length} hint="All time" tone="neutral" icon={<ClipboardList />} />
        </KpiGrid>

        <Panel
          tone="primary"
          compact
          className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col"
          bodyClassName="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden p-0"
        >
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as MaintTab)}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <div className="list-toolbar shrink-0 border-b border-border p-3 sm:p-3.5">
              <TabsList className="list-toolbar__tabs">
                <TabsTrigger value="pending" className="gap-1.5 px-3 py-1.5">
                  Pending
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums",
                      tab === "pending"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted-foreground/15 text-muted-foreground",
                    )}
                  >
                    {pending.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="shop" className="gap-1.5 px-3 py-1.5">
                  In shop
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums",
                      tab === "shop"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted-foreground/15 text-muted-foreground",
                    )}
                  >
                    {inShop.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="all" className="gap-1.5 px-3 py-1.5">
                  All
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums",
                      tab === "all"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted-foreground/15 text-muted-foreground",
                    )}
                  >
                    {allReports.length}
                  </span>
                </TabsTrigger>
              </TabsList>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vehicle, reason, driver…"
                className="list-toolbar__search"
              />
      </div>

            <TabsContent
              value="pending"
              className="mt-0 min-h-0 flex-1 overflow-hidden focus-visible:outline-none data-[state=inactive]:hidden"
            >
              {isLoading ? (
                <PanelSkeleton rows={6} />
              ) : pending.length === 0 ? (
                <div className="p-3">
                  <EmptyState compact title="Nothing pending" description="New downtime reports show here." />
          </div>
        ) : (
                <DualList
                  cards={
                    <ul className="list-stagger space-y-2 p-3">
                      {pending.map((r) => (
                        <li key={r.id}>
                          <ReportCard report={r} actions={reportActions(r)} />
                        </li>
                      ))}
                    </ul>
                  }
                  table={
                    <TripListTable
                      fill
                      headers={["Time", "Vehicle", "Issue", "Reporter", "Severity", "Status", "Actions"]}
                    >
                      {pending.map((r) => (
                        <ReportTableRow key={r.id} report={r} actions={reportActions(r, true)} />
                      ))}
                    </TripListTable>
                  }
                />
              )}
            </TabsContent>

            <TabsContent
              value="shop"
              className="mt-0 min-h-0 flex-1 overflow-hidden focus-visible:outline-none data-[state=inactive]:hidden"
            >
              {vehicles.isLoading ? (
                <PanelSkeleton rows={4} />
              ) : inShop.length === 0 ? (
                <div className="p-3">
                  <EmptyState compact title="Shop empty" description="Vehicles in maintenance show here." />
                </div>
              ) : (
                <DualList
                  cards={
                    <ul className="list-stagger space-y-2 p-3">
                      {inShop.map((v) => (
                        <li key={v.id}>
                          <ShopCard
                            vehicle={v}
                            {...(user && v.openReport
                              ? {
                                  actions: (
                                    <ResolveBtn
                                      report={v.openReport}
                                      userId={user.id}
                                      {...(notes[v.openReport.id] ? { note: notes[v.openReport.id] } : {})}
                                      reviewPending={review.isPending}
                                      onReview={(input) => runReview(input, "Vehicle back in service")}
                                    />
                                  ),
                                }
                              : {})}
                          />
                        </li>
                      ))}
                    </ul>
                  }
                  table={
                    <TripListTable fill headers={["Time", "Vehicle", "Issue", "Status", "Actions"]}>
                      {inShop.map((v) => (
                        <ShopTableRow
                          key={v.id}
                          vehicle={v}
                          {...(user && v.openReport
                            ? {
                                actions: (
                                  <ResolveBtn
                                    report={v.openReport}
                                    userId={user.id}
                                    {...(notes[v.openReport.id] ? { note: notes[v.openReport.id] } : {})}
                                    reviewPending={review.isPending}
                                    onReview={(input) => runReview(input, "Vehicle back in service")}
                                    compact
                                  />
                                ),
                              }
                            : {})}
                        />
                      ))}
                    </TripListTable>
                  }
                />
              )}
            </TabsContent>

            <TabsContent
              value="all"
              className="mt-0 min-h-0 flex-1 overflow-hidden focus-visible:outline-none data-[state=inactive]:hidden"
            >
              {isLoading ? (
                <PanelSkeleton rows={6} />
              ) : allReports.length === 0 ? (
                <div className="p-3">
                  <EmptyState compact title="No reports" description="Tap Log issue to record fleet downtime." />
                    </div>
              ) : (
                <DualList
                  cards={
                    <ul className="list-stagger space-y-2 p-3">
                      {allReports.map((r) => (
                        <li key={r.id}>
                          <ReportCard report={r} actions={reportActions(r)} />
              </li>
            ))}
          </ul>
                  }
                  table={
                    <TripListTable
                      fill
                      headers={["Time", "Vehicle", "Issue", "Reporter", "Severity", "Status", "Actions"]}
                    >
                      {allReports.map((r) => (
                        <ReportTableRow key={r.id} report={r} actions={reportActions(r, true)} />
                      ))}
                    </TripListTable>
                  }
                />
              )}
            </TabsContent>
          </Tabs>
      </Panel>
      </div>

      <ReportVehicleIssueDialog open={logOpen} onOpenChange={setLogOpen} />
    </AppShell>
  );
}
