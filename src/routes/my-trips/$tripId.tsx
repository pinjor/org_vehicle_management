import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useDriverTrips } from "@/lib/queries";

export const Route = createFileRoute("/my-trips/$tripId")({
  head: () => ({
    meta: [
      { title: "Trip — Vehicle Management System" },
      { name: "description", content: "Trip assignment and progress actions." },
    ],
  }),
  component: DriverTripDetailRedirect,
});

/** Legacy path → my-trips drawer (or admin trips drawer). */
function DriverTripDetailRedirect() {
  const { tripId } = Route.useParams();
  const { driverId, isDispatcher } = useAuth();
  const { data } = useDriverTrips(driverId ?? undefined);
  const trip = (data ?? []).find((row) => row.id === tripId);
  const requestId = trip?.request_id ?? trip?.vehicle_requests?.id;

  if (isDispatcher && requestId) {
    return <Navigate to="/trips" search={{ request: requestId }} replace />;
  }

  return <Navigate to="/my-trips" search={{ trip: tripId }} replace />;
}
