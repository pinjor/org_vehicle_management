import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { User } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { LookupChip } from "@/components/lookup-chip";
import {
  AppPhoneField,
  DataRow,
  EntityProfileLink,
  Field,
  KpiCard,
  KpiGrid,
  List,
  ListRow,
  Panel,
} from "@/components/fleet-ui";
import { TripListRow } from "@/components/info-blocks";
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
  SHIFT,
} from "@/lib/fleet";
import { useDriver, useDriverTrips, useUpdateDriver, useVehicles } from "@/lib/queries";
import { formatBdPhone, isValidBdPhone, maskBdPhoneInput, normalizeBdPhone } from "@/lib/phone";
import { routeLineCompact } from "@/lib/route-summary";

export const Route = createFileRoute("/drivers/$driverId")({
  head: ({ params }) => ({
    meta: [{ title: `Driver profile — Vehicle Management System` }, { name: "description", content: `Driver record ${params.driverId}.` }],
  }),
  component: DriverProfilePage,
});

function driverInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

type DriverFormState = {
  full_name: string;
  driver_code: string;
  email: string;
  license_number: string;
  license_type: string;
  license_expiry: string;
  experience_years: number;
  shift: string;
  current_status: string;
  blood_group: string;
  emergency_contact: string;
  address: string;
  date_of_joining: string;
  rating: number;
  primary_vehicle_id: string;
};

const EMPTY_DRIVER_FORM: DriverFormState = {
  full_name: "",
  driver_code: "",
  email: "",
  license_number: "",
  license_type: "",
  license_expiry: "",
  experience_years: 0,
  shift: "",
  current_status: "",
  blood_group: "",
  emergency_contact: "",
  address: "",
  date_of_joining: "",
  rating: 0,
  primary_vehicle_id: "",
};

function DriverProfilePage() {
  const { driverId } = Route.useParams();
  const { isDispatcher, isDriver, isAdmin } = useAuth();
  const navigate = useNavigate();
  const statusOptions = useLookupOptions("driver_status");
  const { data: driver, isLoading } = useDriver(driverId);
  const { data: trips } = useDriverTrips(driverId);
  const { data: fleetVehicles } = useVehicles();
  const update = useUpdateDriver();
  const [form, setForm] = useState<DriverFormState>(EMPTY_DRIVER_FORM);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [altPhoneLocal, setAltPhoneLocal] = useState("");

  const isPureDriver = isDriver && !isDispatcher && !isAdmin;

  // Drivers use /profile — keep admin fleet page unchanged for dispatch/admin.
  useEffect(() => {
    if (isPureDriver) {
      void navigate({ to: "/profile", replace: true });
    }
  }, [isPureDriver, navigate]);

  useEffect(() => {
    if (!driver) return;
    setForm({
      full_name: driver.full_name,
      driver_code: driver.driver_code,
      email: driver.email ?? "",
      license_number: driver.license_number,
      license_type: driver.license_type,
      license_expiry: driver.license_expiry ?? "",
      experience_years: driver.experience_years,
      shift: driver.shift,
      current_status: driver.current_status,
      blood_group: driver.blood_group ?? "",
      emergency_contact: driver.emergency_contact ?? "",
      address: driver.address ?? "",
      date_of_joining: driver.date_of_joining ?? "",
      rating: driver.rating,
      primary_vehicle_id: driver.primary_vehicle_id ?? "",
    });
    setPhoneLocal(driver.phone?.replace(/^\+880/, "").replace(/^0/, "") ?? "");
    setAltPhoneLocal(driver.alternate_phone?.replace(/^\+880/, "").replace(/^0/, "") ?? "");
  }, [driver]);

  if (isPureDriver) {
    return (
      <AppShell title="Profile" subtitle="Redirecting…">
        <DetailPageSkeleton />
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell title="Driver profile">
        <DetailPageSkeleton kpiCount={4} />
      </AppShell>
    );
  }

  if (!driver) {
    return (
      <AppShell title="Driver not found">
        <Link to="/drivers" className="text-sm text-primary hover:underline">
          Back to roster
        </Link>
      </AppShell>
    );
  }

  const set = <K extends keyof DriverFormState>(k: K, v: DriverFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const licenceDays = daysUntil(String(form.license_expiry || driver.license_expiry));
  const vehicleCategory =
    (form.primary_vehicle_id
      ? fleetVehicles?.find((v) => v.id === form.primary_vehicle_id)?.category
      : null) ??
    driver.primary_vehicle_category ??
    null;
  const photoUrl = (driver as { photo_url?: string | null }).photo_url ?? null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!isDispatcher) return;
    const phone = normalizeBdPhone(phoneLocal);
    if (!phone) {
      toast.error("Enter a valid Bangladesh mobile number");
      return;
    }
    const altPhone = altPhoneLocal ? normalizeBdPhone(altPhoneLocal) : null;
    if (altPhoneLocal && !altPhone) {
      toast.error("Alternate phone is not a valid BD mobile");
      return;
    }
    try {
      await update.mutateAsync({
        id: driverId,
        patch: {
          full_name: String(form.full_name),
          driver_code: String(form.driver_code),
          email: String(form.email) || null,
          phone,
          alternate_phone: altPhone,
          license_number: String(form.license_number),
          license_type: String(form.license_type),
          license_expiry: String(form.license_expiry) || null,
          experience_years: Number(form.experience_years),
          shift: String(form.shift),
          current_status: String(form.current_status),
          blood_group: String(form.blood_group) || null,
          emergency_contact: String(form.emergency_contact) || null,
          address: String(form.address) || null,
          date_of_joining: String(form.date_of_joining) || null,
          rating: Number(form.rating),
          primary_vehicle_id: String(form.primary_vehicle_id) || null,
        },
      });
      toast.success("Driver profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <AppShell
      title={driver.full_name}
      subtitle={`${driver.driver_code} · ${formatBdPhone(driver.phone)}`}
      actions={<LookupChip group="driver_status" value={driver.current_status} />}
      backTo="/drivers"
      backLabel="Back to driver roster"
    >
      {!isDispatcher && (
        <p className="mb-3 rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-sm text-muted-foreground">
          View only. Contact dispatch to update this driver record.
        </p>
      )}

      <div className="profile-page profile-page--compact page-stack">
        <div className="profile-hero">
          <div className="profile-photo" aria-label="Driver photo">
            {photoUrl ? (
              <img src={photoUrl} alt={driver.full_name} />
            ) : (
              <>
                <span className="profile-photo__initials">{driverInitials(driver.full_name)}</span>
                <User className="size-5 opacity-40" aria-hidden />
                <span className="profile-photo__hint">Photo</span>
              </>
            )}
          </div>

          <div className="profile-hero__meta">
            <KpiGrid fit="auto">
              <KpiCard
                label="Licence validity"
                value={formatDate(driver.license_expiry)}
                hint={complianceLabel(licenceDays, "Licence")}
                tone={complianceTone(licenceDays)}
              />
              <KpiCard label="Experience" value={`${driver.experience_years} yr`} hint={driver.license_type} tone="info" />
              <KpiCard label="Rating" value={`★ ${driver.rating}`} hint={`${driver.shift} shift`} tone="primary" />
              <KpiCard
                label="Category"
                value={vehicleCategory ? categoryChipLabel(vehicleCategory) : "—"}
                hint={vehicleCategory ? "From primary vehicle" : "Link a vehicle"}
                tone="neutral"
              />
            </KpiGrid>

            <Panel compact bodyClassName="profile-overview-body">
              <DataRow label="Driver code" value={driver.driver_code} />
              <DataRow label="Mobile" value={formatBdPhone(driver.phone)} />
              <DataRow label="Email" value={driver.email ?? "—"} />
              <DataRow
                label="Duty status"
                value={<LookupChip group="driver_status" value={driver.current_status} dot={false} />}
              />
              <DataRow
                label="Primary vehicle"
                value={
                  driver.primary_vehicle_id && driver.primary_vehicle_fleet ? (
                    <EntityProfileLink
                      to="/fleet/$vehicleId"
                      params={{ vehicleId: driver.primary_vehicle_id }}
                      label={`${driver.primary_vehicle_fleet}${driver.primary_vehicle_name ? ` · ${driver.primary_vehicle_name}` : ""}`}
                      hint={driver.primary_vehicle_reg ?? undefined}
                    />
                  ) : (
                    "— Not linked —"
                  )
                }
              />
            </Panel>
          </div>
        </div>

        <form onSubmit={save} className="profile-page__form profile-page__form--split">
          <Panel title="Personal" compact bodyClassName="profile-panel-body">
            <div className="profile-form-fields">
              <Field label="Full name">
                <input
                  className="app-field-input"
                  value={String(form.full_name ?? "")}
                  onChange={(e) => set("full_name", e.target.value)}
                  disabled={!isDispatcher}
                />
              </Field>
              <Field label="Driver code">
                <input
                  className="app-field-input"
                  value={String(form.driver_code ?? "")}
                  onChange={(e) => set("driver_code", e.target.value)}
                  disabled={!isDispatcher}
                />
              </Field>
              <Field label="Mobile">
                <AppPhoneField
                  value={phoneLocal}
                  onChange={(v) => setPhoneLocal(maskBdPhoneInput(v))}
                  disabled={!isDispatcher}
                />
                {phoneLocal && !isValidBdPhone(phoneLocal) && (
                  <p className="mt-1 text-xs text-destructive">Invalid mobile</p>
                )}
              </Field>
              <Field label="Alternate mobile">
                <AppPhoneField
                  value={altPhoneLocal}
                  onChange={(v) => setAltPhoneLocal(maskBdPhoneInput(v))}
                  disabled={!isDispatcher}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className="app-field-input"
                  value={String(form.email ?? "")}
                  onChange={(e) => set("email", e.target.value)}
                  disabled={!isDispatcher}
                />
              </Field>
              <Field label="Joined">
                <input
                  type="date"
                  className="app-field-input"
                  value={String(form.date_of_joining ?? "")}
                  onChange={(e) => set("date_of_joining", e.target.value)}
                  disabled={!isDispatcher}
                />
              </Field>
              <Field label="Blood group">
                <input
                  className="app-field-input"
                  value={String(form.blood_group ?? "")}
                  onChange={(e) => set("blood_group", e.target.value)}
                  disabled={!isDispatcher}
                />
              </Field>
              <Field label="Emergency contact">
                <input
                  className="app-field-input"
                  value={String(form.emergency_contact ?? "")}
                  onChange={(e) => set("emergency_contact", e.target.value)}
                  disabled={!isDispatcher}
                />
              </Field>
              <Field label="Address" className="profile-field-span">
                <Textarea
                  value={String(form.address ?? "")}
                  onChange={(e) => set("address", e.target.value)}
                  rows={2}
                  disabled={!isDispatcher}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Licence" compact bodyClassName="profile-panel-body">
            <div className="profile-form-fields">
              <Field label="Licence number">
                <input
                  className="app-field-input"
                  value={String(form.license_number ?? "")}
                  onChange={(e) => set("license_number", e.target.value)}
                  disabled={!isDispatcher}
                />
              </Field>
              <Field label="Licence type">
                <input
                  className="app-field-input"
                  value={String(form.license_type ?? "")}
                  onChange={(e) => set("license_type", e.target.value)}
                  disabled={!isDispatcher}
                />
              </Field>
              <Field label="Licence expiry">
                <input
                  type="date"
                  className="app-field-input"
                  value={String(form.license_expiry ?? "")}
                  onChange={(e) => set("license_expiry", e.target.value)}
                  disabled={!isDispatcher}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Work" compact bodyClassName="profile-panel-body">
            <div className="profile-form-fields">
              <Field label="Experience (years)">
                <input
                  type="number"
                  className="app-field-input"
                  value={String(form.experience_years ?? "")}
                  onChange={(e) => set("experience_years", Number(e.target.value))}
                  disabled={!isDispatcher}
                />
              </Field>
              <Field label="Rating">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={5}
                  className="app-field-input"
                  value={String(form.rating ?? "")}
                  onChange={(e) => set("rating", Number(e.target.value))}
                  disabled={!isDispatcher}
                />
              </Field>
              <Field label="Shift">
                <select
                  className="app-field-select"
                  value={String(form.shift ?? "")}
                  onChange={(e) => set("shift", e.target.value)}
                  disabled={!isDispatcher}
                >
                  {Object.entries(SHIFT).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Duty status">
                <select
                  className="app-field-select"
                  value={String(form.current_status ?? "")}
                  onChange={(e) => set("current_status", e.target.value)}
                  disabled={!isDispatcher}
                >
                  {statusOptions.map((s) => (
                    <option key={s.value_key} value={s.value_key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Primary vehicle" className="profile-field-span" hint="Category follows this vehicle">
                <select
                  className="app-field-select"
                  value={String(form.primary_vehicle_id ?? "")}
                  onChange={(e) => set("primary_vehicle_id", e.target.value)}
                  disabled={!isDispatcher}
                >
                  <option value="">— Not linked —</option>
                  {(fleetVehicles ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.fleet_number} · {v.name} · {v.category}
                      {v.primary_driver_id && v.primary_driver_id !== driverId
                        ? " (reassign)"
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Panel>

          <Panel
            title="Category"
            description="Follows primary vehicle — change the vehicle to change category"
            className="profile-form-span"
            compact
            bodyClassName="profile-panel-body"
          >
            {vehicleCategory ? (
              <LookupChip group="vehicle_category" value={vehicleCategory} />
            ) : (
              <p className="text-sm text-muted-foreground">No primary vehicle linked</p>
            )}
          </Panel>

          {isDispatcher && (
            <div className="profile-form-span">
              <Button
                type="submit"
                className="min-h-9 w-full sm:w-auto"
                disabled={update.isPending}
                tooltip="Save changes to this driver's profile"
              >
                {update.isPending ? "Saving…" : "Save driver profile"}
              </Button>
            </div>
          )}
        </form>

        <Panel title="Trip history" description="Recent assignments" compact bodyClassName="p-0">
          {(trips ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No trips recorded for this driver yet.</p>
          ) : (
            <List>
              {(trips ?? []).slice(0, 12).map((t) => {
                const requestId = t.request_id ?? t.vehicle_requests?.id;
                return (
                  <ListRow key={t.id}>
                    <TripListRow
                      when={t.vehicle_requests?.pickup_at ?? t.created_at}
                      title={
                        routeLineCompact(t.vehicle_requests?.request_route_points) ||
                        t.vehicle_requests?.requester_name?.trim() ||
                        t.vehicle_requests?.purpose ||
                        t.reference
                      }
                      subtitle={[
                        t.vehicle_requests?.requester_name?.trim() &&
                        routeLineCompact(t.vehicle_requests?.request_route_points)
                          ? t.vehicle_requests.requester_name.trim()
                          : null,
                        t.vehicles?.registration_number ?? t.vehicles?.name,
                        t.vehicle_requests?.purpose,
                        t.reference,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      end={<LookupChip group="trip_status" value={t.status} />}
                      to={requestId ? "/requests/$requestId" : undefined}
                      params={requestId ? { requestId } : undefined}
                    />
                  </ListRow>
                );
              })}
            </List>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
