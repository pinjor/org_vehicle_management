import { createFileRoute, Link } from "@tanstack/react-router";
import { DetailPageSkeleton } from "@/components/loading-skeletons";
import { AppShell } from "@/components/app-shell";
import { TripListRow } from "@/components/info-blocks";
import { LookupChip } from "@/components/lookup-chip";
import {
  DataRow,
  EmptyState,
  KpiCard,
  KpiGrid,
  List,
  ListRow,
  Panel,
  StatusChip,
} from "@/components/fleet-ui";
import { useAuth } from "@/lib/auth";
import { sortRequestsList } from "@/lib/fleet";
import { formatBdPhone } from "@/lib/phone";
import { useAdminEmployee } from "@/lib/queries";

export const Route = createFileRoute("/admin/employees/$employeeId")({
  head: () => ({
    meta: [{ title: "Employee profile — FleetOps" }],
  }),
  component: EmployeeProfilePage,
});

function EmployeeProfilePage() {
  const { employeeId } = Route.useParams();
  const { isDispatcher } = useAuth();
  const { data, isLoading } = useAdminEmployee(employeeId);

  if (!isDispatcher) {
    return (
      <AppShell title="Employee" subtitle="Admin only">
        <EmptyState title="Access denied" />
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell title="Employee">
        <DetailPageSkeleton />
      </AppShell>
    );
  }

  const profile = data?.profile;
  const requests = sortRequestsList(data?.requests ?? []);

  if (!profile) {
    return (
      <AppShell title="Employee not found">
        <Link to="/admin/employees" className="text-sm text-primary hover:underline">
          Back to employees
        </Link>
      </AppShell>
    );
  }

  const active = requests.filter((r) => ["submitted", "approved", "assigned", "in_progress"].includes(r.status));
  const completed = requests.filter((r) => ["completed", "cancelled", "rejected"].includes(r.status));

  return (
    <AppShell
      title={profile.full_name}
      subtitle={[profile.department_name, profile.employee_code].filter(Boolean).join(" · ") || "Employee"}
      actions={<StatusChip label="Employee" tone="neutral" />}
      backTo="/admin/employees"
      backLabel="Back to employees"
    >
      <div className="profile-page page-stack">
        <KpiGrid className="sm:grid-cols-3">
          <KpiCard label="Total requests" value={requests.length} tone="primary" />
          <KpiCard label="Active" value={active.length} tone="info" />
          <KpiCard label="Closed" value={completed.length} tone="success" />
        </KpiGrid>

        <Panel title="Contact" compact bodyClassName="px-3 py-0">
          <DataRow label="Phone" value={profile.phone ? formatBdPhone(profile.phone) : "—"} />
          <DataRow label="Email" value={profile.email ?? "—"} />
          <DataRow label="Department" value={profile.department_name ?? "—"} />
          <DataRow label="Employee code" value={profile.employee_code ?? "—"} />
        </Panel>

        <Panel title="Requests" description="Vehicle requests" compact bodyClassName="p-0">
          {requests.length === 0 ? (
            <div className="p-3">
              <EmptyState title="No requests yet" />
            </div>
          ) : (
            <List>
              {requests.map((r) => (
                <ListRow key={r.id}>
                  <TripListRow
                    when={r.pickup_at}
                    title={r.purpose || r.reference}
                    subtitle={[
                      r.drivers?.full_name ? `Driver ${r.drivers.full_name}` : null,
                      r.vehicles?.registration_number,
                      `${r.passenger_count} pax`,
                      r.reference,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    end={<LookupChip group="request_status" value={r.status} />}
                    to="/requests/$requestId"
                    params={{ requestId: r.id }}
                  />
                </ListRow>
              ))}
            </List>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
