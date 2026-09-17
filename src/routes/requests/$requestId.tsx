import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/requests/$requestId")({
  head: () => ({
    meta: [
      { title: "Request detail — Vehicle Management System" },
      {
        name: "description",
        content: "Full request record: route, passengers, assignment, trip progress and audit trail.",
      },
    ],
  }),
  component: RequestDetailRedirect,
});

/** Legacy path → list drawer (employee) or trips drawer (admin). */
function RequestDetailRedirect() {
  const { requestId } = Route.useParams();
  const { isEmployee, isDispatcher } = useAuth();

  if (isEmployee && !isDispatcher) {
    return <Navigate to="/requests" search={{ request: requestId }} replace />;
  }

  return <Navigate to="/trips" search={{ request: requestId }} replace />;
}
