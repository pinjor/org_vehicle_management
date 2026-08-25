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
import { useCreateDriver, useDrivers } from "@/lib/queries";
import { isValidBdPhone, maskBdPhoneInput, normalizeBdPhone } from "@/lib/phone";
import { DRIVER_STATUS, SHIFT, formatDate, complianceTone, daysUntil } from "@/lib/fleet";

export const Route = createFileRoute("/drivers/")({
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
  const { isDispatcher } = useAuth();
  const categoryOptions = useLookupOptions("vehicle_category");
  const { data, isLoading } = useDrivers();
  const create = useCreateDriver();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    driver_code: "",
    phoneLocal: "",
    license_number: "",
    license_expiry: "",
    shift: "day",
    experience_years: "0",
    allowed_categories: ["sedan", "suv"] as string[],
  });
  const rows = (data ?? []).filter((d) =>
    `${d.driver_code} ${d.full_name} ${d.phone} ${d.shift}`.toLowerCase().includes(search.toLowerCase()),
  );
  const available = (data ?? []).filter((d) => d.current_status === "available").length;
  const expiring = (data ?? []).filter(
    (d) => d.license_expiry && (new Date(d.license_expiry).getTime() - Date.now()) / 86400000 < 90,
  ).length;

  function toggleCategory(cat: string) {
    setForm((f) => ({
      ...f,
      allowed_categories: f.allowed_categories.includes(cat)
        ? f.allowed_categories.filter((c) => c !== cat)
        : [...f.allowed_categories, cat],
    }));
  }

  async function addDriver(e: React.FormEvent) {
    e.preventDefault();
    const phone = normalizeBdPhone(form.phoneLocal);
    if (!phone) {
      toast.error("Enter a valid Bangladesh mobile number");
      return;
    }
    if (form.allowed_categories.length === 0) {
      toast.error("Select at least one vehicle category");
      return;
    }
    try {
      await create.mutateAsync({
        full_name: form.full_name.trim(),
        driver_code: form.driver_code.trim(),
        phone,
        license_number: form.license_number.trim(),
        license_expiry: form.license_expiry || null,
        shift: form.shift,
        allowed_categories: form.allowed_categories,
        experience_years: Number(form.experience_years) || 0,
      });
      toast.success("Driver added to roster");
      setForm({
        full_name: "",
        driver_code: "",
        phoneLocal: "",
        license_number: "",
        license_expiry: "",
        shift: "day",
        experience_years: "0",
        allowed_categories: ["sedan", "suv"],
      });
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
        description="Phone unique · added to signup roster."
        icon={<Users />}
        tone="success"
        formId="add-driver-form"
        onSubmit={addDriver}
        submitDisabled={!isValidBdPhone(form.phoneLocal)}
        submitPending={create.isPending}
      >
        <AddFormSection title="Personal" columns={1}>
          <Field label="Full name">
            <input
              className="app-field-input"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              required
            />
          </Field>
          <Field label="Driver code">
            <input
              className="app-field-input"
              value={form.driver_code}
              onChange={(e) => setForm((f) => ({ ...f, driver_code: e.target.value }))}
              placeholder="DRV-007"
              required
            />
          </Field>
          <Field label="Mobile">
            <AppPhoneField
              value={form.phoneLocal}
              onChange={(v) => setForm((f) => ({ ...f, phoneLocal: maskBdPhoneInput(v) }))}
            />
          </Field>
        </AddFormSection>
        <AddFormSection title="Licence" columns={1}>
          <Field label="Licence number">
            <input
              className="app-field-input"
              value={form.license_number}
              onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))}
              required
            />
          </Field>
          <Field label="Licence expiry">
            <input
              className="app-field-input"
              type="date"
              value={form.license_expiry}
              onChange={(e) => setForm((f) => ({ ...f, license_expiry: e.target.value }))}
            />
          </Field>
          <Field label="Shift">
            <select
              className="app-field-select"
              value={form.shift}
              onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}
            >
              {Object.entries(SHIFT).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </Field>
        </AddFormSection>
        <AddFormSection title="Work" columns={1}>
          <Field label="Experience (years)">
            <input
              className="app-field-input"
              type="number"
              min={0}
              value={form.experience_years}
              onChange={(e) => setForm((f) => ({ ...f, experience_years: e.target.value }))}
            />
          </Field>
          <Field label="Categories" hint="Tap to toggle">
            <div className="flex flex-wrap gap-1.5">
              {categoryOptions.map((opt) => {
                const active = form.allowed_categories.includes(opt.value_key);
                return (
                  <button
                    key={opt.value_key}
                    type="button"
                    className={
                      "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors " +
                      (active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/25")
                    }
                    onClick={() => toggleCategory(opt.value_key)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
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
                      <ChipGroup>
                        {(d.allowed_categories ?? []).slice(0, 3).map((c) => (
                          <MetaChip key={c} label={c} tone="info" />
                        ))}
                      </ChipGroup>
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
