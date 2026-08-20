import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyState, KpiCard, Panel, StatusChip } from "@/components/fleet-ui";
import { Input } from "@/components/ui/input";
import { useDrivers } from "@/lib/queries";
import { DRIVER_STATUS, formatDate } from "@/lib/fleet";

export const Route = createFileRoute("/drivers")({
  head: () => ({
    meta: [
      { title: "Driver roster — FleetOps" },
      { name: "description", content: "Driver roster with licence validity, vehicle categories, shifts and availability." },
      { property: "og:title", content: "Driver roster — FleetOps" },
      { property: "og:description", content: "Licences, shifts, ratings and current duty status for every driver." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriversPage,
});

function DriversPage() {
  const { data, isLoading } = useDrivers();
  const [search, setSearch] = useState("");
  const rows = (data ?? []).filter((d) =>
    `${d.driver_code} ${d.full_name} ${d.phone} ${d.shift}`.toLowerCase().includes(search.toLowerCase()),
  );
  const available = (data ?? []).filter((d) => d.current_status === "available").length;
  const expiring = (data ?? []).filter(
    (d) => d.license_expiry && (new Date(d.license_expiry).getTime() - Date.now()) / 86400000 < 90,
  ).length;

  return (
    <AppShell title="Driver roster" subtitle="Licences, shifts and duty status">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total drivers" value={data?.length ?? 0} tone="primary" />
        <KpiCard label="Available now" value={available} tone="success" />
        <KpiCard label="Licence expiring" value={expiring} hint="Within 90 days" tone="warning" />
      </div>

      <Panel className="mt-4" bodyClassName="p-0">
        <div className="border-b border-border p-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code, phone or shift"
            className="h-9 max-w-sm"
          />
        </div>
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading roster…</p>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No drivers match" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Driver</th>
                  <th className="px-4 py-2 text-left">Categories</th>
                  <th className="px-4 py-2 text-left">Shift</th>
                  <th className="px-4 py-2 text-right">Experience</th>
                  <th className="px-4 py-2 text-right">Rating</th>
                  <th className="px-4 py-2 text-left">Licence expiry</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{d.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.driver_code} · {d.phone}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{(d.allowed_categories ?? []).join(", ")}</td>
                    <td className="px-4 py-2.5 capitalize">{d.shift}</td>
                    <td className="num px-4 py-2.5 text-right">{d.experience_years} yr</td>
                    <td className="num px-4 py-2.5 text-right">{d.rating}</td>
                    <td className="px-4 py-2.5">{formatDate(d.license_expiry)}</td>
                    <td className="px-4 py-2.5">
                      <StatusChip
                        label={DRIVER_STATUS[d.current_status]?.label ?? d.current_status}
                        tone={DRIVER_STATUS[d.current_status]?.tone}
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
