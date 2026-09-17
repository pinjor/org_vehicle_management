import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmployeeRequestCard } from "@/components/list-cards";
import { RequestListSkeleton } from "@/components/loading-skeletons";
import { EmptyState, Panel } from "@/components/fleet-ui";
import {
  DualList,
  RequestTableRow,
  TripListTable,
} from "@/components/trip-list-table";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useRequests } from "@/lib/queries";

const PENDING_STATUSES = new Set(["submitted", "approved"]);

export const Route = createFileRoute("/requests/pending")({
  head: () => ({
    meta: [
      { title: "Pending rides — Vehicle Management System" },
      { name: "description", content: "Your pending vehicle requests awaiting assignment or pickup." },
    ],
  }),
  component: PendingRidesPage,
});

function PendingRidesPage() {
  const { isDispatcher, isEmployee, user } = useAuth();
  const { data, isLoading } = useRequests(user?.id ? { requesterId: user.id } : undefined);

  const rows = useMemo(() => {
    return [...(data ?? [])]
      .filter((r) => PENDING_STATUSES.has(r.status))
      .sort((a, b) => new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime());
  }, [data]);

  if (isDispatcher || !isEmployee) {
    return <Navigate to="/requests" />;
  }

  return (
    <AppShell
      title="Pending rides"
      subtitle="Requests waiting for assignment or pickup"
      fillViewport
      actions={
        <Button asChild size="sm" tooltip="Start a new vehicle request">
          <Link to="/requests/new">
            <Plus className="size-4" /> Book
          </Link>
        </Button>
      }
    >
      <div className="role-dashboard page-stack page-stack--fill min-w-0 w-full max-w-full">
        <Panel
          tone="primary"
          compact
          className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col"
          bodyClassName="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden p-0"
        >
          {isLoading ? (
            <RequestListSkeleton />
          ) : rows.length === 0 ? (
            <div className="p-3">
              <EmptyState
                compact
                title="No pending rides"
                description="New requests show here until a driver is assigned or the trip starts."
              />
              <div className="mt-3 flex justify-center pb-3">
                <Button asChild size="sm">
                  <Link to="/requests/new">Book a ride</Link>
                </Button>
              </div>
            </div>
          ) : (
            <DualList
              cards={
                <ul className="list-stagger space-y-2 p-3">
                  {rows.map((r) => (
                    <li key={r.id}>
                      <EmployeeRequestCard request={r} />
                    </li>
                  ))}
                </ul>
              }
              table={
                <TripListTable
                  fill
                  headers={["Time", "Driver", "Route", "Passengers", "Status", "Actions"]}
                >
                  {rows.map((r) => (
                    <RequestTableRow key={r.id} request={r} mode="employee" />
                  ))}
                </TripListTable>
              }
            />
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
