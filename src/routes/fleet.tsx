import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyState, KpiCard, Panel, StatusChip } from "@/components/fleet-ui";
import { Input } from "@/components/ui/input";
import { useVehicles } from "@/lib/queries";
import { VEHICLE_STATUS, formatDate } from "@/lib/fleet";

export const Route = createFileRoute("/fleet")({
  head: () => ({
    meta: [
      { title: "Fleet register — FleetOps" },
      { name: "description", content: "Vehicle register with capacity, documents, servicing intervals and live operational status." },
      { property: "og:title", content: "Fleet register — FleetOps" },
      { property: "og:description", content: "Track every vehicle, its documents and service position." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FleetPage,
});

function expiryTone(date: string | null) {
  if (!date) return "neutral" as const;
  const days = (new Date(date).getTime() - Date.now()) / 86400000;
  if (days < 0) return "danger" as const;
  if (days < 45) return "warning" as const;
  return "neutral" as const;
}

function FleetPage() {
  const { data, isLoading } = useVehicles();
  const [search, setSearch] = useState("");
  const rows = (data ?? []).filter((v) =>
    `${v.fleet_number} ${v.name} ${v.registration_number} ${v.category} ${v.branch ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const available = (data ?? []).filter((v) => v.operational_status === "available").length;
  const maintenance = (data ?? []).filter((v) => v.operational_status === "under_maintenance").length;
  const dueService = (data ?? []).filter(
    (v) => v.odometer_km - v.last_service_km >= v.service_interval_km - 1000,
  ).length;

  return (
    <AppShell title="Fleet register" subtitle="Vehicles, documents and service position">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total vehicles" value={data?.length ?? 0} tone="primary" />
        <KpiCard label="Available" value={available} tone="success" />
        <KpiCard label="In maintenance" value={maintenance} tone="warning" />
        <KpiCard label="Service due soon" value={dueService} hint="Within 1,000 km of interval" tone="danger" />
      </div>

      <Panel className="mt-4" bodyClassName="p-0">
        <div className="border-b border-border p-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fleet number, model, registration or branch"
            className="h-9 max-w-sm"
          />
        </div>
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading fleet…</p>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No vehicles match" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Vehicle</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-right">Seats</th>
                  <th className="px-4 py-2 text-left">Branch</th>
                  <th className="px-4 py-2 text-right">Odometer</th>
                  <th className="px-4 py-2 text-left">Fitness</th>
                  <th className="px-4 py-2 text-left">Insurance</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((v) => (
                  <tr key={v.id} className="hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">
                        {v.fleet_number} · {v.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{v.registration_number}</p>
                    </td>
                    <td className="px-4 py-2.5 capitalize">{v.category}</td>
                    <td className="num px-4 py-2.5 text-right">{v.seat_capacity}</td>
                    <td className="px-4 py-2.5">{v.branch ?? "—"}</td>
                    <td className="num px-4 py-2.5 text-right">{v.odometer_km.toLocaleString()} km</td>
                    <td className="px-4 py-2.5">
                      <StatusChip label={formatDate(v.fitness_expiry)} tone={expiryTone(v.fitness_expiry)} dot={false} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusChip label={formatDate(v.insurance_expiry)} tone={expiryTone(v.insurance_expiry)} dot={false} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusChip
                        label={VEHICLE_STATUS[v.operational_status]?.label ?? v.operational_status}
                        tone={VEHICLE_STATUS[v.operational_status]?.tone}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
