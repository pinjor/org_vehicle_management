import { createFileRoute } from "@tanstack/react-router";
import { AdminRideDetail } from "@/components/admin-ride-detail";
import { EmployeeRideDetail } from "@/components/employee-ride-detail";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/requests/$requestId")({
  head: () => ({
    meta: [
      { title: "Request detail — FleetOps" },
      { name: "description", content: "Full request record: route, passengers, assignment, trip progress and audit trail." },
      { property: "og:title", content: "Request detail — FleetOps" },
      { property: "og:description", content: "Review, approve and dispatch an individual vehicle request." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestDetailPage,
});

function RequestDetailPage() {
  const { requestId } = Route.useParams();
  const { isEmployee, isDispatcher } = useAuth();

  if (isEmployee && !isDispatcher) {
    return <EmployeeRideDetail requestId={requestId} />;
  }

  return <AdminRideDetail requestId={requestId} />;
}
