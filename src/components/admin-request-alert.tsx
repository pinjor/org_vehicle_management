import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { WhenRail, WhenStamp } from "@/components/info-blocks";
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
import { relativeTime, passengerLabel } from "@/lib/fleet";
import { formatBdPhone } from "@/lib/phone";
import type { RequestRow } from "@/lib/queries";
import { useDecideRequest, useRequests } from "@/lib/queries";
import { routeLineCompact } from "@/lib/route-summary";

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

  const canAssign = ["submitted", "approved"].includes(popup.status);
  const stopCount = (popup.request_route_points ?? []).filter((p) => p.point_type === "stop").length;
  const route = routeLineCompact(popup.request_route_points);

  return (
    <Dialog open onOpenChange={(open) => !open && setPopup(null)}>
      <DialogContent className="fixed left-3 right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex max-h-[min(90dvh,calc(100dvh-1.5rem))] w-auto max-w-lg translate-x-0 translate-y-0 flex-col gap-3 overflow-hidden p-4 sm:left-[50%] sm:right-auto sm:top-[50%] sm:max-h-[85vh] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:gap-4 sm:p-6">
        <DialogHeader className="shrink-0 pr-6 text-left">
          <DialogTitle>New request</DialogTitle>
          <DialogDescription>
            {popup.reference} · {popup.requester_name} · {popup.purpose}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="min-w-0 space-y-2 text-sm">
              <p className="font-semibold leading-snug">{popup.requester_name}</p>
              {popup.requester_phone ? (
                <p className="text-xs font-medium text-muted-foreground">
                  {formatBdPhone(popup.requester_phone)}
                </p>
              ) : null}
              {route ? <p className="ops-card__route-line text-sm font-semibold leading-snug">{route}</p> : null}
              <p className="text-xs text-muted-foreground inline-flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                <span>{passengerLabel(popup.passenger_count)}</span>
                {popup.expected_end_at ? (
                  <>
                    <span>· drop by</span>
                    <WhenStamp at={popup.expected_end_at} withRelative />
                  </>
                ) : null}
                <span>
                  ·{" "}
                  {popup.trip_type === "round_trip"
                    ? "Round trip"
                    : popup.trip_type === "multi_stop" || stopCount > 0
                      ? `Multi-stop${stopCount > 0 ? ` · ${stopCount} stop${stopCount === 1 ? "" : "s"}` : ""}`
                      : "One-way"}
                </span>
              </p>
            </div>
            <WhenRail at={popup.pickup_at} size="lg" />
          </div>

          {canAssign ? (
            <div className="min-w-0 space-y-3 rounded-lg border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Assign driver
              </p>
              <AssignmentPanel
                requestId={popup.id}
                passengers={popup.passenger_count}
                {...(popup.expected_end_at ? { expectedEnd: popup.expected_end_at } : {})}
                onAssigned={() => {
                  toast.success("Assigned");
                  setPopup(null);
                }}
              />
              {popup.status === "submitted" ? (
                <div className="admin-pending__row">
                  <Button
                    disabled={decide.isPending}
                    className="flex-1"
                    tooltip="Approve request"
                    onClick={() => {
                      void decide
                        .mutateAsync({ requestId: popup.id, approve: true, actorId: user.id })
                        .then(() => toast.success("Request approved"))
                        .catch((e: Error) => toast.error(e.message));
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    disabled={decide.isPending}
                    className="btn-reject flex-1"
                    tooltip="Reject request"
                    onClick={() => {
                      void decide
                        .mutateAsync({ requestId: popup.id, approve: false, actorId: user.id })
                        .then(() => {
                          toast.success("Request rejected");
                          setPopup(null);
                        })
                        .catch((e: Error) => toast.error(e.message));
                    }}
                  >
                    Reject
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 sm:flex-col">
          <Button variant="outline" asChild className="w-full" tooltip="Open dispatch board">
            <Link to="/dispatch">Dispatch board</Link>
          </Button>
          <Button variant="ghost" asChild className="w-full" tooltip="Full request details">
            <Link to="/requests/$requestId" params={{ requestId: popup.id }}>
              Details
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
