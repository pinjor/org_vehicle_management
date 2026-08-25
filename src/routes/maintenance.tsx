import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ClipboardList, FileWarning, Wrench } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ChipGroup, EmptyState, KpiCard, KpiGrid, MetaChip, Panel, StatusChip } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useReviewUnavailability, useUnavailabilityRequests, useVehicles } from "@/lib/queries";
import { SEVERITY, UNAVAILABILITY_STATUS, formatDateTime } from "@/lib/fleet";

export const Route = createFileRoute("/maintenance")({
  head: () => ({
    meta: [
      { title: "Maintenance desk — FleetOps" },
      { name: "description", content: "Review vehicle unavailability reports, send vehicles to maintenance and return them to service." },
      { property: "og:title", content: "Maintenance desk — FleetOps" },
      { property: "og:description", content: "Approve breakdown reports and manage vehicle downtime." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MaintenancePage,
});

function MaintenancePage() {
  const { data } = useUnavailabilityRequests();
  const vehicles = useVehicles();
  const review = useReviewUnavailability();
  const { user, isDispatcher } = useAuth();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const decisionHints: Record<string, string> = {
    sent_to_maintenance: "Send this vehicle to the workshop for repair",
    approved_unavailable: "Mark unavailable without sending to workshop",
    resolved: "Vehicle is fixed — return it to the available fleet",
    rejected: "Dismiss the report without changing vehicle status",
  };

  const rows = data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const inMaintenance = (vehicles.data ?? []).filter((v) => v.operational_status === "under_maintenance");

  return (
    <AppShell title="Maintenance desk" subtitle="Downtime reports and vehicles off the road">
      <div className="page-stack">
        <KpiGrid className="sm:grid-cols-3">
          <KpiCard label="Pending reviews" value={pending.length} tone="warning" icon={<FileWarning />} />
          <KpiCard label="Vehicles in maintenance" value={inMaintenance.length} tone="info" icon={<Wrench />} />
          <KpiCard label="Reports total" value={rows.length} tone="neutral" icon={<ClipboardList />} />
        </KpiGrid>

        <Panel tone="warning" title="Unavailability reports" bodyClassName="p-0">
          {rows.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Nothing reported" description="Driver breakdown and downtime reports land here." />
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {r.reference} ·{" "}
                        {r.vehicle_id ? (
                          <Link
                            to="/fleet/$vehicleId"
                            params={{ vehicleId: r.vehicle_id }}
                            className="hover:text-primary"
                          >
                            {r.vehicles?.registration_number ?? "View vehicle"}
                          </Link>
                        ) : (
                          (r.vehicles?.registration_number ?? "—")
                        )}
                      </p>
                      <ChipGroup className="mt-1.5">
                        <MetaChip label={r.reason.replace(/_/g, " ")} tone="neutral" />
                        <StatusChip
                          label={SEVERITY[r.severity]?.label ?? r.severity}
                          tone={SEVERITY[r.severity]?.tone ?? "neutral"}
                        />
                        <MetaChip label={formatDateTime(r.created_at)} tone="info" />
                      </ChipGroup>
                      {r.description && <p className="mt-2 text-sm">{r.description}</p>}
                    </div>
                    <StatusChip
                      label={UNAVAILABILITY_STATUS[r.status]?.label ?? r.status.replace(/_/g, " ")}
                      tone={UNAVAILABILITY_STATUS[r.status]?.tone ?? "neutral"}
                    />
                  </div>

                  {isDispatcher && user && r.status === "pending" && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        rows={2}
                        placeholder="Note for the driver"
                        value={notes[r.id] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ["sent_to_maintenance", "Send to maintenance"],
                            ["approved_unavailable", "Mark unavailable"],
                            ["resolved", "Return to service"],
                            ["rejected", "Reject"],
                          ] as const
                        ).map(([decision, label]) => (
                          <Button
                            key={decision}
                            size="sm"
                            variant={decision === "sent_to_maintenance" ? "default" : "outline"}
                            disabled={review.isPending}
                            tooltip={decisionHints[decision]}
                            onClick={() =>
                              review.mutate(
                                {
                                  id: r.id,
                                  vehicleId: r.vehicle_id,
                                  decision,
                                  note: notes[r.id] ?? "",
                                  actorId: user.id,
                                },
                                {
                                  onSuccess: () => toast.success(`Report ${label.toLowerCase()}`),
                                  onError: (e) => toast.error(e.message),
                                },
                              )
                            }
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
