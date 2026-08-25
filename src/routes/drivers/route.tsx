import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/drivers")({
  component: DriversLayout,
});

function DriversLayout() {
  return <Outlet />;
}
