import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { EmployeeRideBooking } from "@/components/employee-ride-booking";

const newRequestSearchSchema = z.object({
  /** Saved location id for Where to? (drop / destination). */
  to: z.string().optional(),
  /** @deprecated alias — same as to */
  pickup: z.string().optional(),
});

export const Route = createFileRoute("/requests/new")({
  validateSearch: (search) => newRequestSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Plan your ride — FleetOps" },
      { name: "description", content: "Request a one-time ride or round trip with pickup and drop details." },
    ],
  }),
  component: NewRequestPage,
});

function NewRequestPage() {
  const search = Route.useSearch();
  return (
    <AppShell title="Plan your ride" subtitle="Request a vehicle">
      <EmployeeRideBooking initialDropId={search.to ?? search.pickup} />
    </AppShell>
  );
}
