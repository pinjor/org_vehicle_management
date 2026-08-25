import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/my-trips")({
  component: MyTripsLayout,
});

function MyTripsLayout() {
  return <Outlet />;
}
