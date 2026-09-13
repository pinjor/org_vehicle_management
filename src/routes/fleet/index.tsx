import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Car, CheckCircle, Plus, Wrench } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AddEntityPanel, AddFormSection } from "@/components/add-form-shell";
import { KpiGridSkeleton, PanelSkeleton } from "@/components/loading-skeletons";
import { ChipGroup, EmptyState, Field, KpiCard, KpiGrid, MetaChip, Panel, StatusChip } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useLookupOptions } from "@/lib/lookups-context";
import { useCreateVehicle, useDrivers, useVehicles } from "@/lib/queries";
import { VEHICLE_STATUS, VEHICLE_CATEGORY_LABELS, categoryTone, formatDate } from "@/lib/fleet";

export const Route = createFileRoute("/fleet/")({
  head: () => ({
    meta: [
      { title: "Fleet register — Vehicle Management System" },
      { name: "description", content: "Vehicle register with capacity, documents, servicing intervals and live operational status." },
      { property: "og:title", content: "Fleet register — Vehicle Management System" },
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
  const fuelOptions = useLookupOptions("fuel_type");
  const ownershipOptions = useLookupOptions("ownership");
  const statusOptions = useLookupOptions("vehicle_status");
  const { data, isLoading } = useVehicles();
  const { data: drivers } = useDrivers();
  const create = useCreateVehicle();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const emptyForm = {
    fleet_number: "",
    registration_number: "",
    name: "",
    category: "sedan",
    brand: "",
    model: "",
    model_year: "",
    color: "",
    seat_capacity: "4",
    luggage_capacity: "2",
    fuel_type: "petrol",
    transmission: "manual",
    has_ac: true,
    is_vip: false,
    ownership: "owned",
    branch: "Head Office",
    primary_driver_id: "",
    registration_expiry: "",
    fitness_expiry: "",
    insurance_expiry: "",
    tax_token_expiry: "",
    odometer_km: "0",
    last_service_km: "0",
    last_service_date: "",
    service_interval_km: "10000",
    last_repair_date: "",
    last_repair_summary: "",
    operational_status: "available",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const set = (k: keyof typeof emptyForm, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const rows = (data ?? []).filter((v) =>
    `${v.fleet_number} ${v.name} ${v.registration_number} ${v.category} ${v.branch ?? ""} ${v.primary_driver_name ?? ""} ${v.primary_driver_code ?? ""}`
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
        model_year: form.model_year ? Number(form.model_year) : null,
        color: form.color.trim() || null,
        seat_capacity,
        luggage_capacity: Number(form.luggage_capacity) || 2,
        fuel_type: form.fuel_type,
        transmission: form.transmission.trim() || "manual",
        has_ac: form.has_ac,
        is_vip: form.is_vip,
        ownership: form.ownership,
        branch: form.branch.trim() || "Head Office",
        primary_driver_id: form.primary_driver_id || null,
        registration_expiry: form.registration_expiry || null,
        fitness_expiry: form.fitness_expiry || null,
        insurance_expiry: form.insurance_expiry || null,
        tax_token_expiry: form.tax_token_expiry || null,
        odometer_km: Number(form.odometer_km) || 0,
        last_service_km: Number(form.last_service_km) || 0,
        last_service_date: form.last_service_date || null,
        service_interval_km: Number(form.service_interval_km) || 10000,
        last_repair_date: form.last_repair_date || null,
        last_repair_summary: form.last_repair_summary.trim() || null,
        operational_status: form.operational_status,
        notes: form.notes.trim() || null,
      });
      toast.success("Vehicle added to fleet");
      setForm(emptyForm);
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
        description="Same fields as vehicle profile — fleet # and registration must be unique."
        icon={<Car />}
        tone="primary"
        formId="add-vehicle-form"
        onSubmit={addVehicle}
        submitPending={create.isPending}
        wide
      >
        <AddFormSection title="Vehicle" columns={1}>
          <Field label="Fleet number">
            <input className="app-field-input" value={form.fleet_number} onChange={(e) => set("fleet_number", e.target.value)} placeholder="FL-023" required />
          </Field>
          <Field label="Registration">
            <input className="app-field-input" value={form.registration_number} onChange={(e) => set("registration_number", e.target.value)} required />
          </Field>
          <Field label="Display name">
            <input className="app-field-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Toyota Corolla Altis" required />
          </Field>
          <Field label="Category">
            <select className="app-field-select" value={form.category} onChange={(e) => set("category", e.target.value)}>
              {categoryOptions.map((opt) => (
                <option key={opt.value_key} value={opt.value_key}>{opt.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Primary driver" hint="Optional — can change later">
            <select className="app-field-select" value={form.primary_driver_id} onChange={(e) => set("primary_driver_id", e.target.value)}>
              <option value="">— Not linked —</option>
              {(drivers ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.driver_code} · {d.full_name}
                  {d.primary_vehicle_id ? " (reassign)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Brand">
            <input className="app-field-input" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
          </Field>
          <Field label="Model">
            <input className="app-field-input" value={form.model} onChange={(e) => set("model", e.target.value)} />
          </Field>
          <Field label="Year">
            <input className="app-field-input" type="number" value={form.model_year} onChange={(e) => set("model_year", e.target.value)} />
          </Field>
          <Field label="Color">
            <input className="app-field-input" value={form.color} onChange={(e) => set("color", e.target.value)} />
          </Field>
        </AddFormSection>

        <AddFormSection title="Capacity & fuel" columns={1}>
          <Field label="Seats">
            <input className="app-field-input" type="number" min={1} value={form.seat_capacity} onChange={(e) => set("seat_capacity", e.target.value)} required />
          </Field>
          <Field label="Luggage">
            <input className="app-field-input" type="number" min={0} value={form.luggage_capacity} onChange={(e) => set("luggage_capacity", e.target.value)} />
          </Field>
          <Field label="Fuel">
            <select className="app-field-select" value={form.fuel_type} onChange={(e) => set("fuel_type", e.target.value)}>
              {fuelOptions.map((opt) => (
                <option key={opt.value_key} value={opt.value_key}>{opt.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Transmission">
            <input className="app-field-input" value={form.transmission} onChange={(e) => set("transmission", e.target.value)} />
          </Field>
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" checked={form.has_ac} onChange={(e) => set("has_ac", e.target.checked)} />
            Air conditioning
          </label>
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_vip} onChange={(e) => set("is_vip", e.target.checked)} />
            VIP vehicle
          </label>
        </AddFormSection>

        <AddFormSection title="Compliance" columns={1}>
          <Field label="Fitness expiry">
            <input className="app-field-input" type="date" value={form.fitness_expiry} onChange={(e) => set("fitness_expiry", e.target.value)} />
          </Field>
          <Field label="Insurance expiry">
            <input className="app-field-input" type="date" value={form.insurance_expiry} onChange={(e) => set("insurance_expiry", e.target.value)} />
          </Field>
          <Field label="Registration expiry">
            <input className="app-field-input" type="date" value={form.registration_expiry} onChange={(e) => set("registration_expiry", e.target.value)} />
          </Field>
          <Field label="Tax token expiry">
            <input className="app-field-input" type="date" value={form.tax_token_expiry} onChange={(e) => set("tax_token_expiry", e.target.value)} />
          </Field>
        </AddFormSection>

        <AddFormSection title="Service & operations" columns={1}>
          <Field label="Odometer (km)">
            <input className="app-field-input" type="number" min={0} value={form.odometer_km} onChange={(e) => set("odometer_km", e.target.value)} />
          </Field>
          <Field label="Last service km">
            <input className="app-field-input" type="number" min={0} value={form.last_service_km} onChange={(e) => set("last_service_km", e.target.value)} />
          </Field>
          <Field label="Last service date">
            <input className="app-field-input" type="date" value={form.last_service_date} onChange={(e) => set("last_service_date", e.target.value)} />
          </Field>
          <Field label="Interval (km)">
            <input className="app-field-input" type="number" min={1000} value={form.service_interval_km} onChange={(e) => set("service_interval_km", e.target.value)} />
          </Field>
          <Field label="Last repair date">
            <input className="app-field-input" type="date" value={form.last_repair_date} onChange={(e) => set("last_repair_date", e.target.value)} />
          </Field>
          <Field label="Repair summary">
            <input className="app-field-input" value={form.last_repair_summary} onChange={(e) => set("last_repair_summary", e.target.value)} />
          </Field>
          <Field label="Branch">
            <input className="app-field-input" value={form.branch} onChange={(e) => set("branch", e.target.value)} />
          </Field>
          <Field label="Ownership">
            <select className="app-field-select" value={form.ownership} onChange={(e) => set("ownership", e.target.value)}>
              {ownershipOptions.map((opt) => (
                <option key={opt.value_key} value={opt.value_key}>{opt.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="app-field-select" value={form.operational_status} onChange={(e) => set("operational_status", e.target.value)}>
              {statusOptions.map((opt) => (
                <option key={opt.value_key} value={opt.value_key}>{opt.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Admin notes">
            <input className="app-field-input" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
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
                      <MetaChip
                        label={
                          v.primary_driver_name
                            ? `Driver · ${v.primary_driver_name}`
                            : "No driver linked"
                        }
                        tone={v.primary_driver_name ? "success" : "neutral"}
                      />
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
                  <th className="px-4 py-2 text-left">Driver</th>
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
                      {v.primary_driver_id && v.primary_driver_name ? (
                        <Link
                          to="/drivers/$driverId"
                          params={{ driverId: v.primary_driver_id }}
                          className="block hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="font-medium">{v.primary_driver_name}</p>
                          <p className="text-xs text-muted-foreground">{v.primary_driver_code}</p>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
