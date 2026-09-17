import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path — dispatch console merged into /trips. */
export const Route = createFileRoute("/dispatch")({
  beforeLoad: () => {
    throw redirect({ to: "/trips" });
  },
});
