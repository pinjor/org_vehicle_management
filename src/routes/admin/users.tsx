import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, UserCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { PanelSkeleton } from "@/components/loading-skeletons";
import { AppShell } from "@/components/app-shell";
import { AddEntityPanel, AddFormSection } from "@/components/add-form-shell";
import { AppPhoneField, EmptyState, Field, FilterBar, KpiCard, KpiGrid, Panel, StatusChip } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { ROSTER_ROLE } from "@/lib/fleet";
import { WhenStamp } from "@/components/info-blocks";
import { formatBdPhone, isValidBdPhone, maskBdPhoneInput, normalizeBdPhone } from "@/lib/phone";
import {
  useCreateRosterEntry,
  useDeactivateRosterEntry,
  useRoster,
  useUpdateRosterEntry,
  type RosterEntry,
} from "@/lib/queries";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [{ title: "User roster — FleetOps" }],
  }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { isDispatcher } = useAuth();
  const { data, isLoading } = useRoster();
  const create = useCreateRosterEntry();
  const update = useUpdateRosterEntry();
  const deactivate = useDeactivateRosterEntry();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin_hr" | "driver" | "employee">("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phoneLocal: "",
    role: "employee" as "admin_hr" | "driver" | "employee",
    notes: "",
  });

  if (!isDispatcher) {
    return (
      <AppShell title="User roster" subtitle="Admin only">
        <EmptyState title="Access denied" description="Only admin or HR can manage the user roster." />
      </AppShell>
    );
  }

  const rows = (data ?? []).filter((r) => {
    if (roleFilter !== "all" && r.role !== roleFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return `${r.full_name} ${r.phone} ${r.role}`.toLowerCase().includes(q);
  });

  const signedUp = (data ?? []).filter((r) => r.user_id).length;
  const pending = (data ?? []).filter((r) => !r.user_id && r.is_active).length;

  const roleFilterOptions = (["all", "admin_hr", "driver", "employee"] as const).map((f) => ({
    value: f,
    label: f === "all" ? "All" : ROSTER_ROLE[f].label,
    tone: f === "all" ? ("neutral" as const) : ROSTER_ROLE[f].tone,
    count: f === "all" ? (data?.length ?? 0) : (data ?? []).filter((r) => r.role === f).length,
  }));

  function RoleSelect({ id, role }: { id: string; role: RosterEntry["role"] }) {
    return (
      <select
        className="app-field-select h-7 w-auto min-w-[7.5rem] py-0 text-xs"
        value={role}
        disabled={update.isPending}
        aria-label="Change roster role"
        onChange={(e) =>
          update.mutate(
            { id, patch: { role: e.target.value as RosterEntry["role"] } },
            {
              onSuccess: () => toast.success("Role updated"),
              onError: (err) => toast.error(err.message),
            },
          )
        }
      >
        <option value="employee">Employee</option>
        <option value="driver">Driver</option>
        <option value="admin_hr">Admin / HR</option>
      </select>
    );
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    const phone = normalizeBdPhone(form.phoneLocal);
    if (!phone) {
      toast.error("Enter a valid Bangladesh mobile number");
      return;
    }
    try {
      await create.mutateAsync({
        full_name: form.full_name.trim(),
        phone,
        role: form.role,
        notes: form.notes.trim() || null,
      });
      toast.success("User added to roster");
      setForm({ full_name: "", phoneLocal: "", role: "employee", notes: "" });
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add user");
    }
  }

  return (
    <AppShell
      title="User roster"
      subtitle="Pre-register by phone before signup"
      actions={
        <Button size="sm" onClick={() => setShowForm(true)} tooltip="Pre-register a phone number before the user signs up">
          <Plus className="size-3.5" /> Add user
        </Button>
      }
    >
      <AddEntityPanel
        open={showForm}
        onOpenChange={setShowForm}
        title="Add to roster"
        description="Pre-register phone before signup."
        icon={<UserPlus />}
        tone="info"
        formId="add-user-form"
        onSubmit={addUser}
        submitDisabled={!isValidBdPhone(form.phoneLocal)}
        submitPending={create.isPending}
      >
        <AddFormSection title="Roster entry" columns={1}>
          <Field label="Full name">
            <input
              className="app-field-input"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              required
            />
          </Field>
          <Field label="Mobile">
            <AppPhoneField
              value={form.phoneLocal}
              onChange={(v) => setForm((f) => ({ ...f, phoneLocal: maskBdPhoneInput(v) }))}
            />
          </Field>
          <Field label="Role">
            <select
              className="app-field-select"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as typeof form.role }))}
            >
              <option value="employee">Employee</option>
              <option value="driver">Driver</option>
              <option value="admin_hr">Admin / HR</option>
            </select>
          </Field>
          <Field label="Notes">
            <input
              className="app-field-input"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
        </AddFormSection>
      </AddEntityPanel>

      <div className="page-stack">
        <KpiGrid className="sm:grid-cols-3">
          <KpiCard label="On roster" value={data?.length ?? 0} tone="primary" icon={<Users />} />
          <KpiCard label="Signed up" value={signedUp} tone="success" icon={<UserCheck />} />
          <KpiCard label="Awaiting signup" value={pending} tone="warning" icon={<UserPlus />} />
        </KpiGrid>

        <Panel tone="primary" compact className="min-w-0" bodyClassName="min-w-0 p-0">
          <div className="space-y-2.5 border-b border-border p-3 sm:p-3.5">
            <FilterBar
              label="Filter by role"
              value={roleFilter}
              onChange={(v) => setRoleFilter(v as typeof roleFilter)}
              options={roleFilterOptions}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone…"
              className="h-9"
            />
          </div>

          {isLoading ? (
            <PanelSkeleton rows={8} />
          ) : rows.length === 0 ? (
            <div className="p-3">
              <EmptyState title="No users match" />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border/60 md:hidden">
                {rows.map((r) => (
                  <li key={r.id} className="px-3.5 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.full_name}</p>
                        <p className="text-xs text-muted-foreground">{formatBdPhone(r.phone)}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        <StatusChip label={ROSTER_ROLE[r.role].label} tone={ROSTER_ROLE[r.role].tone} />
                        {r.user_id ? (
                          <StatusChip label="Active" tone="success" />
                        ) : (
                          <StatusChip label="Pending" tone="warning" />
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <RoleSelect id={r.id} role={r.role} />
                      {r.is_active && !r.user_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={deactivate.isPending}
                          tooltip="Remove from roster before they sign up"
                          onClick={() =>
                            deactivate.mutate(r.id, {
                              onSuccess: () => toast.success("Removed from roster"),
                              onError: (e) => toast.error(e.message),
                            })
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden min-w-0 overflow-x-auto md:block">
                <table className="data-table w-full">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left">Name</th>
                      <th className="text-left">Phone</th>
                      <th className="text-left">Role</th>
                      <th className="text-left">Status</th>
                      <th className="text-left">Added</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-border/60">
                        <td>
                          <p className="font-medium">{r.full_name}</p>
                          {r.notes && <p className="max-w-[12rem] truncate text-xs text-muted-foreground">{r.notes}</p>}
                        </td>
                        <td className="whitespace-nowrap">{formatBdPhone(r.phone)}</td>
                        <td>
                          <RoleSelect id={r.id} role={r.role} />
                        </td>
                        <td>
                          {r.user_id ? (
                            <StatusChip label="Signed up" tone="success" />
                          ) : (
                            <StatusChip label="Pending" tone="warning" />
                          )}
                        </td>
                        <td className="whitespace-nowrap text-muted-foreground">
                          <WhenStamp at={r.created_at} />
                        </td>
                        <td className="text-right">
                          {r.is_active && !r.user_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={deactivate.isPending}
                              tooltip="Remove from roster before they sign up"
                              onClick={() =>
                                deactivate.mutate(r.id, {
                                  onSuccess: () => toast.success("Removed from roster"),
                                  onError: (e) => toast.error(e.message),
                                })
                              }
                            >
                              Remove
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
