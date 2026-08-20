import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FleetOps — Vehicle Request & Dispatch Console" },
      {
        name: "description",
        content:
          "Raise multi-stop vehicle requests, match drivers with a scoring engine and track live trips end to end.",
      },
      { property: "og:title", content: "FleetOps — Vehicle Request & Dispatch Console" },
      {
        property: "og:description",
        content: "Enterprise fleet operations: requests, intelligent dispatch and live trip tracking.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    void navigate({ to: session ? "/dashboard" : "/auth" });
  }, [session, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Loading FleetOps…
    </div>
  );
}
