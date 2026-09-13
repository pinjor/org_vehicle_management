import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PanelSkeleton } from "@/components/loading-skeletons";
import { AppShell } from "@/components/app-shell";
import { EmptyState, FilterBar, KpiCard, KpiGrid, ListLink, MetaChip, Panel, StatusChip } from "@/components/fleet-ui";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { formatBdPhone } from "@/lib/phone";
import { useAdminEmployees } from "@/lib/queries";
import type { Tone } from "@/lib/fleet";
import { ClipboardList, UserCheck, Users } from "lucide-react";

export const Route = createFileRoute("/admin/employees")({
  head: () => ({
    meta: [{ title: "Employees — Vehicle Management System" }],
  }),
  component: AdminEmployeesPage,
});

function AdminEmployeesPage() {
  const { isDispatcher } = useAuth();
  const { data, isLoading } = useAdminEmployees();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending">("all");

  if (!isDispatcher) {
    return (
      <AppShell title="Employees" subtitle="Admin only">
        <EmptyState title="Access denied" description="Only admin or HR can view the employee list." />
      </AppShell>
    );
  }

  const rows = (data ?? []).filter((e) => {
    const name = e.profile_name ?? e.roster_name;
    const phone = e.profile_phone ?? e.roster_phone;
    const dept = e.department_name ?? "";
    const code = e.employee_code ?? "";
    if (statusFilter === "active" && !e.profile_id) return false;
    if (statusFilter === "pending" && e.profile_id) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return `${name} ${phone} ${dept} ${code}`.toLowerCase().includes(q);
  });

  const signedUp = (data ?? []).filter((e) => e.profile_id).length;
  const pending = (data ?? []).filter((e) => !e.profile_id).length;
  const withRequests = (data ?? []).filter((e) => e.request_count > 0).length;

  const statusFilterOptions = (
    [
      ["all", "All", "neutral"],
      ["active", "Signed up", "success"],
      ["pending", "Pending signup", "warning"],
    ] as const
  ).map(([key, label, tone]) => ({
    value: key,
    label,
    tone: tone as Tone,
    count: key === "all" ? (data?.length ?? 0) : key === "active" ? signedUp : pending,
  }));

  return (
    <AppShell title="Employees" subtitle="Roster · department · requests">
      <div className="page-stack">
        <KpiGrid className="sm:grid-cols-3">
          <KpiCard label="On roster" value={data?.length ?? 0} tone="primary" icon={<Users />} />
          <KpiCard label="Signed up" value={signedUp} hint={`${pending} pending`} tone="success" icon={<UserCheck />} />
          <KpiCard label="With requests" value={withRequests} tone="info" icon={<ClipboardList />} />
        </KpiGrid>

        <Panel tone="primary" compact className="min-w-0" bodyClassName="min-w-0 p-0">
          <div className="space-y-2.5 border-b border-border p-3 sm:p-3.5">
            <FilterBar
              label="Filter by status"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={statusFilterOptions}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, dept, code…"
              className="h-9"
            />
          </div>

          {isLoading ? (
            <PanelSkeleton rows={8} />
          ) : rows.length === 0 ? (
            <div className="p-3">
              <EmptyState title="No employees match" description="Add employees from User roster." />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border/60 md:hidden">
                {rows.map((e) => {
                  const name = e.profile_name ?? e.roster_name;
                  const phone = e.profile_phone ?? e.roster_phone;
                  return (
                    <li key={e.roster_id}>
                      {e.profile_id ? (
                        <ListLink to="/admin/employees/$employeeId" params={{ employeeId: e.profile_id }}>
                          <div className="min-w-0">
                            <p className="font-medium">{name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatBdPhone(phone)}
                              {e.department_name ? ` · ${e.department_name}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <StatusChip label={`${e.request_count} req`} tone="info" dot={false} />
                            <StatusChip label="Active" tone="success" />
                          </div>
                        </ListLink>
                      ) : (
                        <div className="flex items-center justify-between gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <p className="font-medium">{name}</p>
                            <p className="text-xs text-muted-foreground">{formatBdPhone(phone)}</p>
                          </div>
                          <StatusChip label="Pending signup" tone="warning" />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="hidden min-w-0 overflow-x-auto md:block">
                <table className="data-table w-full">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left">Employee</th>
                      <th className="text-left">Department</th>
                      <th className="text-left">Code</th>
                      <th className="text-right">Requests</th>
                      <th className="text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => {
                      const name = e.profile_name ?? e.roster_name;
                      const phone = e.profile_phone ?? e.roster_phone;
                      return (
                        <tr key={e.roster_id} className="border-t border-border/60">
                          <td>
                            {e.profile_id ? (
                              <Link
                                to="/admin/employees/$employeeId"
                                params={{ employeeId: e.profile_id }}
                                className="block hover:text-primary"
                              >
                                <p className="font-medium">{name}</p>
                                <p className="text-xs text-muted-foreground">{formatBdPhone(phone)}</p>
                              </Link>
                            ) : (
                              <>
                                <p className="font-medium">{name}</p>
                                <p className="text-xs text-muted-foreground">{formatBdPhone(phone)}</p>
                              </>
                            )}
                          </td>
                          <td>{e.department_name ? <MetaChip label={e.department_name} tone="info" /> : "—"}</td>
                          <td>{e.employee_code ? <MetaChip label={e.employee_code} tone="neutral" /> : "—"}</td>
                          <td className="num text-right">
                            <MetaChip label={`${e.request_count}`} tone={e.request_count > 0 ? "info" : "neutral"} />
                          </td>
                          <td>
                            {e.profile_id ? (
                              <StatusChip label="Signed up" tone="success" />
                            ) : (
                              <StatusChip label="Pending signup" tone="warning" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>

        <p className="text-xs text-muted-foreground">
          Pre-register new employees on{" "}
          <Link to="/admin/users" className="font-medium text-primary hover:underline">
            User roster
          </Link>
          .
        </p>
      </div>
    </AppShell>
  );
}
