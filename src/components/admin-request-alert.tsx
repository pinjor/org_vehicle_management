import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AssignmentPanel } from "@/components/assignment-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { formatDateTime, PRIORITY, relativeTime } from "@/lib/fleet";
import type { RequestRow } from "@/lib/queries";
import { useDecideRequest, useRequests } from "@/lib/queries";
import { StatusChip } from "@/components/fleet-ui";

/** Toast + modal when new employee requests arrive (admin/dispatcher only). */
export function AdminRequestAlert() {
  const { isDispatcher, user } = useAuth();
  const { data } = useRequests({ status: ["submitted"] });
  const decide = useDecideRequest();
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const [popup, setPopup] = useState<RequestRow | null>(null);

  useEffect(() => {
    if (!isDispatcher || !data) return;

    if (!initialized.current) {
      for (const r of data) seen.current.add(r.id);
      initialized.current = true;
      return;
    }

    for (const r of data) {
      if (seen.current.has(r.id)) continue;
      seen.current.add(r.id);
      toast.info(`New request ${r.reference}`, {
        description: `${r.requester_name} · ${r.passenger_count} passengers · ${relativeTime(r.pickup_at)}`,
        duration: 12_000,
        action: {
          label: "Assign",
          onClick: () => setPopup(r),
        },
      });
      setPopup(r);
    }
  }, [data, isDispatcher]);

  if (!isDispatcher || !popup || !user) return null;

  async function approve() {
    if (!popup || !user) return;
    await decide.mutateAsync({ requestId: popup.id, approve: true, actorId: user.id });
    toast.success("Request approved — assign a vehicle below");
  }

  return (
    <Dialog open onOpenChange={(open) => !open && setPopup(null)}>
      <DialogContent className="fixed inset-x-3 top-[5vh] flex max-h-[90vh] w-auto max-w-lg translate-x-0 flex-col overflow-y-auto sm:inset-x-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            New vehicle request
            <StatusChip label={PRIORITY[popup.priority]?.label ?? popup.priority} tone={PRIORITY[popup.priority]?.tone} />
          </DialogTitle>
          <DialogDescription>
            {popup.reference} · {popup.requester_name} · {popup.purpose}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <p>
              <span className="text-muted-foreground">Pickup:</span> {formatDateTime(popup.pickup_at)}
            </p>
            <p>
              <span className="text-muted-foreground">Drop by:</span> {formatDateTime(popup.expected_end_at)}
            </p>
            <p>
              <span className="text-muted-foreground">Passengers:</span> {popup.passenger_count} ·{" "}
              {popup.trip_type === "round_trip"
                ? "Round trip"
                : popup.trip_type === "multi_stop"
                  ? "Multi-stop"
                  : "One-way"}
            </p>
            {popup.requester_phone && (
              <p>
                <span className="text-muted-foreground">Phone:</span> {popup.requester_phone}
              </p>
            )}
          </div>

          {popup.status === "submitted" ? (
            <Button
              onClick={() => void approve()}
              disabled={decide.isPending}
              className="w-full"
              tooltip="Approve and move this request to dispatch assignment"
            >
              Approve request
            </Button>
          ) : (
            <AssignmentPanel
              requestId={popup.id}
              passengers={popup.passenger_count}
              expectedEnd={popup.expected_end_at}
            />
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button variant="outline" asChild className="w-full" tooltip="Go to the full dispatch board">
            <Link to="/dispatch">Open dispatch console</Link>
          </Button>
          <Button variant="ghost" asChild className="w-full" tooltip="See full request details, route, and audit trail">
            <Link to="/requests/$requestId" params={{ requestId: popup.id }}>
              View full request
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
