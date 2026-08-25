import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Wrench } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { LookupChip } from "@/components/lookup-chip";
import {
  EntityProfileLink,
  Field,
  KpiCard,
  KpiGrid,
  List,
  ListLink,
  ListRow,
  Panel,
  StatusChip,
} from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useLookupOptions } from "@/lib/lookups-context";
import {
  categoryChipLabel,
  complianceLabel,
  complianceTone,
  daysUntil,
  formatDate,
  formatDateTime,
  kmUntilService,
  serviceTone,
  TRIP_STATUS,
} from "@/lib/fleet";
import { useUnavailabilityRequests, useUpdateVehicle, useVehicle, useVehicleTrips } from "@/lib/queries";

export const Route = createFileRoute("/fleet/$vehicleId")({
  head: ({ params }) => ({
    meta: [{ title: `Vehicle profile — FleetOps` }, { name: "description", content: `Vehicle record ${params.vehicleId}.` }],
  }),
  component: VehicleProfilePage,
});

function VehicleProfilePage() {
  const { vehicleId } = Route.useParams();
  const { isDispatcher } = useAuth();
  const categoryOptions = useLookupOptions("vehicle_category");
  const fuelOptions = useLookupOptions("fuel_type");
  const statusOptions = useLookupOptions("vehicle_status");
  const ownershipOptions = useLookupOptions("ownership");
  const { data: vehicle, isLoading } = useVehicle(vehicleId);
  const { data: trips } = useVehicleTrips(vehicleId);
  const { data: maintenance } = useUnavailabilityRequests();
  const update = useUpdateVehicle();
  const [form, setForm] = useState<Record<string, string | number | boolean>>({});

  const vehicleMaintenance = useMemo(
    () => (maintenance ?? []).filter((m) => m.vehicle_id === vehicleId).slice(0, 8),
    [maintenance, vehicleId],
  );

  useEffect(() => {
    if (!vehicle) return;
    setForm({
      name: vehicle.name,
      registration_number: vehicle.registration_number,
      fleet_number: vehicle.fleet_number,
      category: vehicle.category,
      brand: vehicle.brand,
      model: vehicle.model,
      model_year: vehicle.model_year ?? "",
      color: vehicle.color ?? "",
      seat_capacity: vehicle.seat_capacity,
      luggage_capacity: vehicle.luggage_capacity,
      fuel_type: vehicle.fuel_type,
      transmission: vehicle.transmission,
      has_ac: vehicle.has_ac,
      is_vip: vehicle.is_vip,
      ownership: vehicle.ownership,
      branch: vehicle.branch,
      odometer_km: vehicle.odometer_km,
      last_service_km: vehicle.last_service_km,
      last_service_date: vehicle.last_service_date ?? "",
      service_interval_km: vehicle.service_interval_km,
      registration_expiry: vehicle.registration_expiry ?? "",
      fitness_expiry: vehicle.fitness_expiry ?? "",
      insurance_expiry: vehicle.insurance_expiry ?? "",
      tax_token_expiry: vehicle.tax_token_expiry ?? "",
      last_repair_date: vehicle.last_repair_date ?? "",
      last_repair_summary: vehicle.last_repair_summary ?? "",
      operational_status: vehicle.operational_status,
      notes: vehicle.notes ?? "",
    });
  }, [vehicle]);

  if (isLoading) {
    return (
      <AppShell title="Vehicle profile">
        <DetailPageSkeleton kpiCount={5} />
      </AppShell>
    );
  }

  if (!vehicle) {
    return (
      <AppShell title="Vehicle not found">
        <Link to="/fleet" className="text-sm text-primary hover:underline">
          Back to fleet
        </Link>
      </AppShell>
    );
  }

  const set = (k: string, v: string | number | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const odo = Number(form.odometer_km ?? vehicle.odometer_km);
  const lastSvcKm = Number(form.last_service_km ?? vehicle.last_service_km);
  const interval = Number(form.service_interval_km ?? vehicle.service_interval_km);
  const kmLeft = kmUntilService(odo, lastSvcKm, interval);

  const fitnessDays = daysUntil(String(form.fitness_expiry || vehicle.fitness_expiry));
  const insuranceDays = daysUntil(String(form.insurance_expiry || vehicle.insurance_expiry));
  const regDays = daysUntil(String(form.registration_expiry || vehicle.registration_expiry));
  const taxDays = daysUntil(String(form.tax_token_expiry || vehicle.tax_token_expiry));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!isDispatcher) return;
    try {
      await update.mutateAsync({
        id: vehicleId,
        patch: {
          name: String(form.name),
          registration_number: String(form.registration_number),
          fleet_number: String(form.fleet_number),
          category: String(form.category),
          brand: String(form.brand),
          model: String(form.model),
          model_year: form.model_year ? Number(form.model_year) : null,
          color: String(form.color) || null,
          seat_capacity: Number(form.seat_capacity),
          luggage_capacity: Number(form.luggage_capacity),
          fuel_type: String(form.fuel_type),
          transmission: String(form.transmission),
          has_ac: Boolean(form.has_ac),
          is_vip: Boolean(form.is_vip),
          ownership: String(form.ownership),
          branch: String(form.branch),
          odometer_km: Number(form.odometer_km),
          last_service_km: Number(form.last_service_km),
          last_service_date: String(form.last_service_date) || null,
          service_interval_km: Number(form.service_interval_km),
          registration_expiry: String(form.registration_expiry) || null,
          fitness_expiry: String(form.fitness_expiry) || null,
          insurance_expiry: String(form.insurance_expiry) || null,
          tax_token_expiry: String(form.tax_token_expiry) || null,
          last_repair_date: String(form.last_repair_date) || null,
          last_repair_summary: String(form.last_repair_summary) || null,
          operational_status: String(form.operational_status),
          notes: String(form.notes) || null,
        },
      });
      toast.success("Vehicle profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <AppShell
      title={vehicle.name}
      subtitle={`${vehicle.fleet_number} · ${vehicle.registration_number} · ${categoryChipLabel(vehicle.category)}`}
      actions={<LookupChip group="vehicle_status" value={vehicle.operational_status} />}
    >
      <Link
        to="/fleet"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Fleet register
      </Link>

      {!isDispatcher && (
        <p className="mb-3 rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-sm text-muted-foreground">
          View only. Contact dispatch to update this vehicle record.
        </p>
      )}

      <div className="profile-page profile-page--compact page-stack">
        <KpiGrid fit="auto">
          <KpiCard
            label="Fitness"
            value={formatDate(vehicle.fitness_expiry)}
            hint={complianceLabel(fitnessDays, "Fitness")}
            tone={complianceTone(fitnessDays)}
          />
          <KpiCard
            label="Insurance"
            value={formatDate(vehicle.insurance_expiry)}
            hint={complianceLabel(insuranceDays, "Insurance")}
            tone={complianceTone(insuranceDays)}
          />
          <KpiCard
            label="Registration"
            value={formatDate(vehicle.registration_expiry)}
            hint={complianceLabel(regDays, "Reg.")}
            tone={complianceTone(regDays)}
          />
          <KpiCard
            label="Tax token"
            value={formatDate(vehicle.tax_token_expiry)}
            hint={complianceLabel(taxDays, "Tax")}
            tone={complianceTone(taxDays)}
          />
          <KpiCard
            label="Next service"
            value={kmLeft < 0 ? `${Math.abs(kmLeft).toLocaleString()} overdue` : `${kmLeft.toLocaleString()} km`}
            hint={`Every ${interval.toLocaleString()} km`}
            tone={serviceTone(kmLeft)}
          />
        </KpiGrid>

        <Panel compact bodyClassName="p-0">
          <dl className="profile-overview-grid">
            <div className="profile-overview-cell">
              <dt>Fleet #</dt>
              <dd>{vehicle.fleet_number}</dd>
            </div>
            <div className="profile-overview-cell">
              <dt>Registration</dt>
              <dd>{vehicle.registration_number}</dd>
            </div>
            <div className="profile-overview-cell">
              <dt>Category</dt>
              <dd>{categoryChipLabel(vehicle.category)}</dd>
            </div>
            <div className="profile-overview-cell">
              <dt>Branch</dt>
              <dd>{vehicle.branch ?? "—"}</dd>
            </div>
            <div className="profile-overview-cell">
              <dt>Odometer</dt>
              <dd>{vehicle.odometer_km.toLocaleString()} km</dd>
            </div>
            <div className="profile-overview-cell">
              <dt>Status</dt>
              <dd>
                <LookupChip group="vehicle_status" value={vehicle.operational_status} dot={false} />
              </dd>
            </div>
          </dl>
        </Panel>

        <form onSubmit={save} className="profile-page__form profile-page__form--split">
          <Panel title="Identification" compact bodyClassName="profile-panel-body">
            <div className="profile-form-fields">
              <Field label="Fleet number">
                <input className="app-field-input" value={String(form.fleet_number ?? "")} onChange={(e) => set("fleet_number", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Registration">
                <input className="app-field-input" value={String(form.registration_number ?? "")} onChange={(e) => set("registration_number", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Display name" className="profile-field-span">
                <input className="app-field-input" value={String(form.name ?? "")} onChange={(e) => set("name", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Type">
                <select className="app-field-select" value={String(form.category ?? "")} onChange={(e) => set("category", e.target.value)} disabled={!isDispatcher}>
                  {categoryOptions.map((c) => (
                    <option key={c.value_key} value={c.value_key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Brand">
                <input className="app-field-input" value={String(form.brand ?? "")} onChange={(e) => set("brand", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Model">
                <input className="app-field-input" value={String(form.model ?? "")} onChange={(e) => set("model", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Year">
                <input className="app-field-input" type="number" value={String(form.model_year ?? "")} onChange={(e) => set("model_year", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Color">
                <input className="app-field-input" value={String(form.color ?? "")} onChange={(e) => set("color", e.target.value)} disabled={!isDispatcher} />
              </Field>
            </div>
          </Panel>

          <Panel title="Capacity & fuel" compact bodyClassName="profile-panel-body">
            <div className="profile-form-fields">
              <Field label="Seats">
                <input className="app-field-input" type="number" value={String(form.seat_capacity ?? "")} onChange={(e) => set("seat_capacity", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Luggage">
                <input className="app-field-input" type="number" value={String(form.luggage_capacity ?? "")} onChange={(e) => set("luggage_capacity", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Fuel">
                <select className="app-field-select" value={String(form.fuel_type ?? "")} onChange={(e) => set("fuel_type", e.target.value)} disabled={!isDispatcher}>
                  {fuelOptions.map((f) => (
                    <option key={f.value_key} value={f.value_key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Transmission">
                <input className="app-field-input" value={String(form.transmission ?? "")} onChange={(e) => set("transmission", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <label className="flex min-h-9 items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(form.has_ac)} onChange={(e) => set("has_ac", e.target.checked)} disabled={!isDispatcher} />
                Air conditioning
              </label>
              <label className="flex min-h-9 items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(form.is_vip)} onChange={(e) => set("is_vip", e.target.checked)} disabled={!isDispatcher} />
                VIP vehicle
              </label>
            </div>
          </Panel>

          <Panel title="Compliance" compact bodyClassName="profile-panel-body">
            <div className="profile-form-fields">
              <Field label="Fitness expiry">
                <input className="app-field-input" type="date" value={String(form.fitness_expiry ?? "")} onChange={(e) => set("fitness_expiry", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Insurance expiry">
                <input className="app-field-input" type="date" value={String(form.insurance_expiry ?? "")} onChange={(e) => set("insurance_expiry", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Registration expiry">
                <input className="app-field-input" type="date" value={String(form.registration_expiry ?? "")} onChange={(e) => set("registration_expiry", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Tax token expiry">
                <input className="app-field-input" type="date" value={String(form.tax_token_expiry ?? "")} onChange={(e) => set("tax_token_expiry", e.target.value)} disabled={!isDispatcher} />
              </Field>
            </div>
          </Panel>

          <Panel title="Service & repair" compact bodyClassName="profile-panel-body">
            <div className="profile-form-fields">
              <Field label="Odometer (km)">
                <input className="app-field-input" type="number" value={String(form.odometer_km ?? "")} onChange={(e) => set("odometer_km", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Last service km">
                <input className="app-field-input" type="number" value={String(form.last_service_km ?? "")} onChange={(e) => set("last_service_km", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Last service date">
                <input className="app-field-input" type="date" value={String(form.last_service_date ?? "")} onChange={(e) => set("last_service_date", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Interval (km)">
                <input className="app-field-input" type="number" value={String(form.service_interval_km ?? "")} onChange={(e) => set("service_interval_km", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Last repair date">
                <input className="app-field-input" type="date" value={String(form.last_repair_date ?? "")} onChange={(e) => set("last_repair_date", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Repair summary">
                <input className="app-field-input" value={String(form.last_repair_summary ?? "")} onChange={(e) => set("last_repair_summary", e.target.value)} disabled={!isDispatcher} />
              </Field>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full transition-all ${kmLeft < 0 ? "bg-destructive" : kmLeft < 1000 ? "bg-warning" : "bg-primary"}`}
                style={{ width: `${Math.min(100, Math.max(0, ((interval - kmLeft) / interval) * 100))}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {odo.toLocaleString()} km · next at {(lastSvcKm + interval).toLocaleString()} km
            </p>
          </Panel>

          <Panel title="Operations" className="profile-form-span" compact bodyClassName="profile-panel-body">
            <div className="profile-form-fields profile-form-fields--3">
              <Field label="Branch">
                <input className="app-field-input" value={String(form.branch ?? "")} onChange={(e) => set("branch", e.target.value)} disabled={!isDispatcher} />
              </Field>
              <Field label="Ownership">
                <select className="app-field-select" value={String(form.ownership ?? "")} onChange={(e) => set("ownership", e.target.value)} disabled={!isDispatcher}>
                  {ownershipOptions.map((o) => (
                    <option key={o.value_key} value={o.value_key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select className="app-field-select" value={String(form.operational_status ?? "")} onChange={(e) => set("operational_status", e.target.value)} disabled={!isDispatcher}>
                  {statusOptions.map((s) => (
                    <option key={s.value_key} value={s.value_key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Admin notes" className="profile-field-span">
                <Textarea value={String(form.notes ?? "")} onChange={(e) => set("notes", e.target.value)} rows={2} disabled={!isDispatcher} />
              </Field>
            </div>
          </Panel>

          {isDispatcher && (
            <div className="profile-form-span">
              <Button type="submit" className="min-h-9 w-full sm:w-auto" disabled={update.isPending} tooltip="Save changes to this vehicle's profile">
                {update.isPending ? "Saving…" : "Save vehicle profile"}
              </Button>
            </div>
          )}
        </form>

        <div className="profile-page__side-by-side">
          <Panel title="Maintenance" description="Unavailability" compact bodyClassName="p-0">
            {vehicleMaintenance.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No reports on file.</p>
            ) : (
              <List>
                {vehicleMaintenance.map((m) => (
                  <ListRow key={m.id}>
                    <div className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-medium capitalize">
                          <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
                          {m.reason?.replace(/_/g, " ") ?? "Report"}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.description || "—"}</p>
                      </div>
                      <StatusChip label={m.status?.replace(/_/g, " ") ?? "pending"} tone="warning" />
                    </div>
                  </ListRow>
                ))}
              </List>
            )}
          </Panel>

          <Panel title="Trip history" description="Recent" compact bodyClassName="p-0">
            {(trips ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No trips yet.</p>
            ) : (
              <List>
                {(trips ?? []).slice(0, 12).map((t) => {
                  const requestId = t.request_id ?? t.vehicle_requests?.id;
                  const row = (
                    <>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.reference}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.vehicle_requests?.purpose ?? "Trip"} · {formatDateTime(t.vehicle_requests?.pickup_at ?? t.created_at)}
                        </p>
                        {t.driver_id && t.drivers?.full_name && (
                          <div className="mt-1">
                            <EntityProfileLink
                              to="/drivers/$driverId"
                              params={{ driverId: t.driver_id }}
                              label={t.drivers.full_name}
                              hint={t.drivers.driver_code ?? t.drivers.phone}
                            />
                          </div>
                        )}
                      </div>
                      <StatusChip label={TRIP_STATUS[t.status]?.label ?? t.status} tone={TRIP_STATUS[t.status]?.tone ?? "neutral"} />
                    </>
                  );

                  return (
                    <ListRow key={t.id}>
                      {requestId ? (
                        <ListLink to="/requests/$requestId" params={{ requestId }}>
                          {row}
                        </ListLink>
                      ) : (
                        <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">{row}</div>
                      )}
                    </ListRow>
                  );
                })}
              </List>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
