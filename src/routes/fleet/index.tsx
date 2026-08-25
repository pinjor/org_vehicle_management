import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Car, CheckCircle, Plus, Users, Wrench } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AddEntityPanel, AddFormSection } from "@/components/add-form-shell";
import { KpiGridSkeleton, PanelSkeleton } from "@/components/loading-skeletons";
import { ChipGroup, EmptyState, Field, KpiCard, KpiGrid, MetaChip, Panel, StatusChip } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useLookupOptions } from "@/lib/lookups-context";
import { useCreateVehicle, useVehicles } from "@/lib/queries";
import { VEHICLE_STATUS, VEHICLE_CATEGORY_LABELS, categoryTone, formatDate } from "@/lib/fleet";

export const Route = createFileRoute("/fleet/")({
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
  const { isDispatcher } = useAuth();
  const categoryOptions = useLookupOptions("vehicle_category");
  const { data, isLoading } = useVehicles();
  const create = useCreateVehicle();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    fleet_number: "",
    registration_number: "",
    name: "",
    category: "sedan",
    brand: "",
    model: "",
    seat_capacity: "4",
    branch: "Head Office",
  });
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

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    const seat_capacity = Number(form.seat_capacity);
    if (!Number.isFinite(seat_capacity) || seat_capacity < 1) {
      toast.error("Seat capacity must be at least 1");
      return;
    }
    try {
      await create.mutateAsync({
        fleet_number: form.fleet_number.trim(),
        registration_number: form.registration_number.trim(),
        name: form.name.trim(),
        category: form.category,
        brand: form.brand.trim(),
        model: form.model.trim(),
        seat_capacity,
        branch: form.branch.trim() || "Head Office",
      });
      toast.success("Vehicle added to fleet");
      setForm({
        fleet_number: "",
        registration_number: "",
        name: "",
        category: "sedan",
        brand: "",
        model: "",
        seat_capacity: "4",
        branch: "Head Office",
      });
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add vehicle");
    }
  }

  return (
    <AppShell
      title="Fleet register"
      subtitle="Vehicles · docs · service"
      actions={
        isDispatcher ? (
          <Button size="sm" onClick={() => setShowForm(true)} tooltip="Register a new vehicle in the fleet">
            <Plus className="size-3.5" /> Add vehicle
          </Button>
        ) : undefined
      }
    >
      <AddEntityPanel
        open={showForm}
        onOpenChange={setShowForm}
        title="Add vehicle"
        description="Fleet # and registration must be unique."
        icon={<Car />}
        tone="primary"
        formId="add-vehicle-form"
        onSubmit={addVehicle}
        submitPending={create.isPending}
      >
        <AddFormSection title="Vehicle" columns={1}>
          <Field label="Fleet number">
            <input
              className="app-field-input"
              value={form.fleet_number}
              onChange={(e) => setForm((f) => ({ ...f, fleet_number: e.target.value }))}
              placeholder="FL-023"
              required
            />
          </Field>
          <Field label="Registration">
            <input
              className="app-field-input"
              value={form.registration_number}
              onChange={(e) => setForm((f) => ({ ...f, registration_number: e.target.value }))}
              required
            />
          </Field>
          <Field label="Display name">
            <input
              className="app-field-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Toyota Corolla Altis"
              required
            />
          </Field>
          <Field label="Category">
            <select
              className="app-field-select"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value_key} value={opt.value_key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Brand">
            <input
              className="app-field-input"
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            />
          </Field>
          <Field label="Model">
            <input
              className="app-field-input"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            />
          </Field>
          <Field label="Seats">
            <input
              className="app-field-input"
              type="number"
              min={1}
              value={form.seat_capacity}
              onChange={(e) => setForm((f) => ({ ...f, seat_capacity: e.target.value }))}
              required
            />
          </Field>
          <Field label="Branch">
            <input
              className="app-field-input"
              value={form.branch}
              onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
            />
          </Field>
        </AddFormSection>
      </AddEntityPanel>

      <div className="page-stack">
      {isLoading ? (
        <>
          <KpiGridSkeleton />
          <PanelSkeleton rows={8} withSearch />
        </>
      ) : (
        <>
      <KpiGrid>
        <KpiCard label="Total" value={data?.length ?? 0} tone="primary" icon={<Car />} />
        <KpiCard label="Available" value={available} tone="success" icon={<CheckCircle />} />
        <KpiCard label="Maintenance" value={maintenance} tone="warning" icon={<Wrench />} />
        <KpiCard label="Service due" value={dueService} hint="≤1k km" tone="danger" icon={<AlertTriangle />} />
      </KpiGrid>

      <Panel tone="neutral" compact className="min-w-0" bodyClassName="min-w-0 p-0">
        <div className="border-b border-border px-3 py-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fleet #, model, reg…"
            className="h-8"
          />
        </div>
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No vehicles match" />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border md:hidden">
              {rows.map((v) => (
                <li key={v.id}>
                  <Link
                    to="/fleet/$vehicleId"
                    params={{ vehicleId: v.id }}
                    className="block space-y-1 px-3 py-2 active:bg-surface-2/80"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {v.fleet_number} · {v.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{v.registration_number}</p>
                      </div>
                      <StatusChip
                        label={VEHICLE_STATUS[v.operational_status]?.label ?? v.operational_status}
                        tone={VEHICLE_STATUS[v.operational_status]?.tone}
                      />
                    </div>
                    <ChipGroup className="mt-1">
                      <MetaChip
                        label={VEHICLE_CATEGORY_LABELS[v.category as keyof typeof VEHICLE_CATEGORY_LABELS] ?? v.category}
                        tone={categoryTone(v.category)}
                      />
                      <MetaChip label={`${v.seat_capacity} seats`} tone="neutral" />
                      {v.branch && <MetaChip label={v.branch} tone="info" />}
                    </ChipGroup>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden min-w-0 overflow-x-auto md:block">
              <table className="data-table w-full">
              <thead className="bg-muted/40">
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
                  <tr key={v.id} className="border-t border-border/60">
                    <td>
                      <Link to="/fleet/$vehicleId" params={{ vehicleId: v.id }} className="block hover:text-primary">
                        <p className="font-medium">
                          {v.fleet_number} · {v.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{v.registration_number}</p>
                      </Link>
                    </td>
                    <td>
                      <MetaChip
                        label={VEHICLE_CATEGORY_LABELS[v.category as keyof typeof VEHICLE_CATEGORY_LABELS] ?? v.category}
                        tone={categoryTone(v.category)}
                      />
                    </td>
                    <td className="num text-right">
                      <MetaChip label={`${v.seat_capacity}`} tone="neutral" />
                    </td>
                    <td>{v.branch ? <MetaChip label={v.branch} tone="info" /> : "—"}</td>
                    <td className="num text-right">{v.odometer_km.toLocaleString()}</td>
                    <td>
                      <StatusChip label={formatDate(v.fitness_expiry)} tone={expiryTone(v.fitness_expiry)} dot={false} />
                    </td>
                    <td>
                      <StatusChip label={formatDate(v.insurance_expiry)} tone={expiryTone(v.insurance_expiry)} dot={false} />
                    </td>
                    <td>
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
          </>
        )}
      </Panel>
        </>
      )}
      </div>
    </AppShell>
  );
}
