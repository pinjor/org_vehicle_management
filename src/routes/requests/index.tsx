import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Panel, StatusChip } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useRequests } from "@/lib/queries";
import { PRIORITY, REQUEST_STATUS, formatDateTime, relativeTime } from "@/lib/fleet";

const FILTERS = ["all", "submitted", "approved", "assigned", "in_progress", "completed", "rejected"] as const;

export const Route = createFileRoute("/requests/")({
  head: () => ({
    meta: [
      { title: "Vehicle requests — FleetOps" },
      { name: "description", content: "Track every vehicle request from submission through approval, dispatch and completion." },
      { property: "og:title", content: "Vehicle requests — FleetOps" },
      { property: "og:description", content: "Browse, filter and open vehicle requests across departments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestsPage,
});

function RequestsPage() {
  const { isDispatcher, user } = useAuth();
  const { data, isLoading } = useRequests(isDispatcher || !user ? undefined : { requesterId: user.id });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");

  const rows = (data ?? []).filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return `${r.reference} ${r.purpose} ${r.requester_name}`.toLowerCase().includes(q);
  });

  return (
    <AppShell
      title="Vehicle requests"
      subtitle="Every journey request and its current stage"
      actions={
        <Button asChild size="sm">
          <Link to="/requests/new">
            <Plus className="size-4" /> New request
          </Link>
        </Button>
      }
    >
      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "rounded-md px-2.5 py-1 text-xs " +
                (filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")
              }
            >
              {f === "all" ? "All" : (REQUEST_STATUS[f]?.label ?? f)}
            </button>
          ))}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, purpose, requester"
            className="ml-auto h-8 w-full max-w-xs"
          />
        </div>

        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading requests…</p>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No requests match" description="Try a different filter or raise a new request." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  to="/requests/$requestId"
                  params={{ requestId: r.id }}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.reference} · {r.purpose}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.requester_name} · {r.departments?.code ?? "—"} · {formatDateTime(r.pickup_at)} ·{" "}
                      {relativeTime(r.pickup_at)} · {r.passenger_count} pax
                    </p>
                  </div>
                  <StatusChip label={PRIORITY[r.priority]?.label ?? r.priority} tone={PRIORITY[r.priority]?.tone} />
                  <StatusChip label={REQUEST_STATUS[r.status]?.label ?? r.status} tone={REQUEST_STATUS[r.status]?.tone} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}
