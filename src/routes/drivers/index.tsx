import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Plus, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AddEntityPanel, AddFormSection } from "@/components/add-form-shell";
import { KpiGridSkeleton, PanelSkeleton } from "@/components/loading-skeletons";
import { AppPhoneField, ChipGroup, EmptyState, Field, KpiCard, KpiGrid, MetaChip, Panel, StatusChip } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useLookupOptions } from "@/lib/lookups-context";
import { useCreateDriver, useDrivers, useVehicles } from "@/lib/queries";
import { isValidBdPhone, maskBdPhoneInput, normalizeBdPhone } from "@/lib/phone";
import { DRIVER_STATUS, SHIFT, formatDate, complianceTone, daysUntil } from "@/lib/fleet";

export const Route = createFileRoute("/drivers/")({
  head: () => ({
    meta: [
      { title: "Driver roster — Vehicle Management System" },
      { name: "description", content: "Driver roster with licence validity, vehicle categories, shifts and availability." },
      { property: "og:title", content: "Driver roster — Vehicle Management System" },
      { property: "og:description", content: "Licences, shifts, ratings and current duty status for every driver." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriversPage,
});

function DriversPage() {
  const { isDispatcher } = useAuth();
  const statusOptions = useLookupOptions("driver_status");
  const { data, isLoading } = useDrivers();
  const { data: fleetVehicles } = useVehicles();
  const create = useCreateDriver();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const emptyForm = {
    full_name: "",
    driver_code: "",
    phoneLocal: "",
    altPhoneLocal: "",
    email: "",
    license_number: "",
    license_type: "Professional",
    license_expiry: "",
    shift: "day",
    experience_years: "0",
    blood_group: "",
    emergency_contact: "",
    address: "",
    date_of_joining: "",
    rating: "4.5",
    current_status: "available",
    primary_vehicle_id: "",
  };
  const [form, setForm] = useState(emptyForm);
  const rows = (data ?? []).filter((d) =>
    `${d.driver_code} ${d.full_name} ${d.phone} ${d.shift} ${d.primary_vehicle_fleet ?? ""} ${d.primary_vehicle_name ?? ""} ${d.primary_vehicle_reg ?? ""} ${d.primary_vehicle_category ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const available = (data ?? []).filter((d) => d.current_status === "available").length;
  const expiring = (data ?? []).filter(
    (d) => d.license_expiry && (new Date(d.license_expiry).getTime() - Date.now()) / 86400000 < 90,
  ).length;

  async function addDriver(e: React.FormEvent) {
    e.preventDefault();
    const phone = normalizeBdPhone(form.phoneLocal);
    if (!phone) {
      toast.error("Enter a valid Bangladesh mobile number");
      return;
    }
    const altPhone = form.altPhoneLocal ? normalizeBdPhone(form.altPhoneLocal) : null;
    if (form.altPhoneLocal && !altPhone) {
      toast.error("Alternate phone is not a valid BD mobile");
      return;
    }
    try {
      await create.mutateAsync({
        full_name: form.full_name.trim(),
        driver_code: form.driver_code.trim(),
        phone,
        alternate_phone: altPhone,
        email: form.email.trim() || null,
        license_number: form.license_number.trim(),
        license_type: form.license_type.trim() || "Professional",
        license_expiry: form.license_expiry || null,
        shift: form.shift,
        experience_years: Number(form.experience_years) || 0,
        blood_group: form.blood_group.trim() || null,
        emergency_contact: form.emergency_contact.trim() || null,
        address: form.address.trim() || null,
        date_of_joining: form.date_of_joining || null,
        rating: Number(form.rating) || 4.5,
        current_status: form.current_status,
        primary_vehicle_id: form.primary_vehicle_id || null,
      });
      toast.success("Driver added to roster");
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add driver");
    }
  }

  return (
    <AppShell
      title="Driver roster"
      subtitle="Licence · shift · status"
      actions={
        isDispatcher ? (
          <Button size="sm" onClick={() => setShowForm(true)} tooltip="Register a new driver on the roster">
            <Plus className="size-3.5" /> Add driver
          </Button>
        ) : undefined
      }
    >
      <AddEntityPanel
        open={showForm}
        onOpenChange={setShowForm}
        title="Add driver"
        description="Same fields as driver profile — phone unique · added to signup roster."
        icon={<Users />}
        tone="success"
        formId="add-driver-form"
        onSubmit={addDriver}
        submitDisabled={!isValidBdPhone(form.phoneLocal)}
        submitPending={create.isPending}
        wide
      >
        <AddFormSection title="Personal" columns={1}>
          <Field label="Full name">
            <input className="app-field-input" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
          </Field>
          <Field label="Driver code">
            <input className="app-field-input" value={form.driver_code} onChange={(e) => setForm((f) => ({ ...f, driver_code: e.target.value }))} placeholder="DRV-007" required />
          </Field>
          <Field label="Mobile">
            <AppPhoneField value={form.phoneLocal} onChange={(v) => setForm((f) => ({ ...f, phoneLocal: maskBdPhoneInput(v) }))} />
          </Field>
          <Field label="Alternate mobile">
            <AppPhoneField value={form.altPhoneLocal} onChange={(v) => setForm((f) => ({ ...f, altPhoneLocal: maskBdPhoneInput(v) }))} />
          </Field>
          <Field label="Email">
            <input type="email" className="app-field-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Joined">
            <input type="date" className="app-field-input" value={form.date_of_joining} onChange={(e) => setForm((f) => ({ ...f, date_of_joining: e.target.value }))} />
          </Field>
          <Field label="Blood group">
            <input className="app-field-input" value={form.blood_group} onChange={(e) => setForm((f) => ({ ...f, blood_group: e.target.value }))} />
          </Field>
          <Field label="Emergency contact">
            <input className="app-field-input" value={form.emergency_contact} onChange={(e) => setForm((f) => ({ ...f, emergency_contact: e.target.value }))} />
          </Field>
          <Field label="Address">
            <input className="app-field-input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </Field>
        </AddFormSection>

        <AddFormSection title="Licence" columns={1}>
          <Field label="Licence number">
            <input className="app-field-input" value={form.license_number} onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))} required />
          </Field>
          <Field label="Licence type">
            <input className="app-field-input" value={form.license_type} onChange={(e) => setForm((f) => ({ ...f, license_type: e.target.value }))} />
          </Field>
          <Field label="Licence expiry">
            <input className="app-field-input" type="date" value={form.license_expiry} onChange={(e) => setForm((f) => ({ ...f, license_expiry: e.target.value }))} />
          </Field>
        </AddFormSection>

        <AddFormSection title="Work" columns={1}>
          <Field label="Experience (years)">
            <input className="app-field-input" type="number" min={0} value={form.experience_years} onChange={(e) => setForm((f) => ({ ...f, experience_years: e.target.value }))} />
          </Field>
          <Field label="Rating">
            <input className="app-field-input" type="number" step="0.1" min={0} max={5} value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} />
          </Field>
          <Field label="Shift">
            <select className="app-field-select" value={form.shift} onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}>
              {Object.entries(SHIFT).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Duty status">
            <select className="app-field-select" value={form.current_status} onChange={(e) => setForm((f) => ({ ...f, current_status: e.target.value }))}>
              {statusOptions.map((s) => (
                <option key={s.value_key} value={s.value_key}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Primary vehicle" hint="Optional — category follows this vehicle">
            <select className="app-field-select" value={form.primary_vehicle_id} onChange={(e) => setForm((f) => ({ ...f, primary_vehicle_id: e.target.value }))}>
              <option value="">— Not linked —</option>
              {(fleetVehicles ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.fleet_number} · {v.name} · {v.category}
                  {v.primary_driver_id ? " (reassign)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </AddFormSection>
      </AddEntityPanel>

      <div className="page-stack">
      {isLoading ? (
        <>
          <KpiGridSkeleton count={3} className="sm:grid-cols-3" />
          <PanelSkeleton rows={8} withSearch />
        </>
      ) : (
        <>
      <KpiGrid className="sm:grid-cols-3">
        <KpiCard label="Total" value={data?.length ?? 0} tone="primary" icon={<Users />} />
        <KpiCard label="Available" value={available} tone="success" icon={<UserCheck />} />
        <KpiCard label="Licence expiring" value={expiring} hint="90 days" tone="warning" icon={<AlertTriangle />} />
      </KpiGrid>

      <Panel tone="neutral" compact className="min-w-0" bodyClassName="min-w-0 p-0">
        <div className="border-b border-border px-3 py-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code, phone…"
            className="h-8"
          />
        </div>
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No drivers match" />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border md:hidden">
              {rows.map((d) => (
                <li key={d.id}>
                  <Link
                    to="/drivers/$driverId"
                    params={{ driverId: d.id }}
                    className="block space-y-1 px-3 py-2 active:bg-surface-2/80"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{d.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.driver_code} · {d.phone}
                        </p>
                      </div>
                      <StatusChip
                        label={DRIVER_STATUS[d.current_status]?.label ?? d.current_status}
                        tone={DRIVER_STATUS[d.current_status]?.tone}
                      />
                    </div>
                    <ChipGroup className="mt-1">
                      <MetaChip label={SHIFT[d.shift]?.label ?? d.shift} tone={SHIFT[d.shift]?.tone ?? "neutral"} />
                      <MetaChip label={`${d.experience_years} yr`} tone="neutral" />
                      <MetaChip label={`★ ${d.rating}`} tone="warning" />
                      <MetaChip
                        label={
                          d.primary_vehicle_fleet
                            ? `Vehicle · ${d.primary_vehicle_fleet}`
                            : "No vehicle linked"
                        }
                        tone={d.primary_vehicle_fleet ? "success" : "neutral"}
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
                  <th className="px-4 py-2 text-left">Driver</th>
                  <th className="px-4 py-2 text-left">Vehicle</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-left">Shift</th>
                  <th className="px-4 py-2 text-right">Experience</th>
                  <th className="px-4 py-2 text-right">Rating</th>
                  <th className="px-4 py-2 text-left">Licence expiry</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((d) => (
                  <tr key={d.id} className="border-t border-border/60">
                    <td>
                      <Link to="/drivers/$driverId" params={{ driverId: d.id }} className="block hover:text-primary">
                        <p className="font-medium">{d.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.driver_code} · {d.phone}
                        </p>
                      </Link>
                    </td>
                    <td>
                      {d.primary_vehicle_id && d.primary_vehicle_fleet ? (
                        <Link
                          to="/fleet/$vehicleId"
                          params={{ vehicleId: d.primary_vehicle_id }}
                          className="block hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="font-medium">
                            {d.primary_vehicle_fleet}
                            {d.primary_vehicle_name ? ` · ${d.primary_vehicle_name}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">{d.primary_vehicle_reg}</p>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      {d.primary_vehicle_category ? (
                        <MetaChip label={d.primary_vehicle_category.replace(/_/g, " ")} tone="info" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      <MetaChip label={SHIFT[d.shift]?.label ?? d.shift} tone={SHIFT[d.shift]?.tone ?? "neutral"} />
                    </td>
                    <td className="num text-right">
                      <MetaChip label={`${d.experience_years} yr`} tone="neutral" />
                    </td>
                    <td className="num text-right">
                      <MetaChip label={`★ ${d.rating}`} tone="warning" />
                    </td>
                    <td>
                      <StatusChip
                        label={formatDate(d.license_expiry)}
                        tone={complianceTone(daysUntil(d.license_expiry))}
                        dot={false}
                      />
                    </td>
                    <td>
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
          </>
        )}
      </Panel>
        </>
      )}
      </div>
    </AppShell>
  );
}
