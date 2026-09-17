import { useState, type MouseEvent } from "react";
import { AssignmentPanel } from "@/components/assignment-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import type { RequestRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

function stop(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/** Assign-driver action for pending request cards. */
export function AdminPendingActions({
  request,
  className,
  layout = "foot",
}: {
  request: RequestRow;
  className?: string;
  layout?: "foot" | "row";
}) {
  const { user, isDispatcher } = useAuth();
  const [assignOpen, setAssignOpen] = useState(false);

  if (!isDispatcher || !user) return null;

  const assigned = !!(
    request.drivers ||
    request.vehicles ||
    request.assigned_driver_id ||
    request.assigned_vehicle_id
  );
  const canAssign = ["submitted", "approved"].includes(request.status) && !assigned;
  if (!canAssign) return null;

  return (
    <>
      <div
        className={cn(
          layout === "foot" && "ops-card__foot",
          layout === "row" && "admin-pending__row",
          className,
        )}
        onClick={stop}
      >
        <Button
          type="button"
          size="sm"
          className={cn(
            layout === "foot" && "admin-pending__btn min-h-10 w-full",
            layout === "row" && "h-8 whitespace-nowrap",
          )}
          onClick={(e) => {
            stop(e);
            setAssignOpen(true);
          }}
        >
          Assign driver
        </Button>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md gap-4" onClick={stop}>
          <DialogHeader>
            <DialogTitle>Assign driver</DialogTitle>
            <DialogDescription>
              Search or pick an available driver for this request
            </DialogDescription>
          </DialogHeader>
          <AssignmentPanel
            requestId={request.id}
            passengers={request.passenger_count}
            {...(request.journey_date ? { journeyDate: request.journey_date } : {})}
            pickupAt={request.pickup_at}
            {...(request.expected_end_at ? { expectedEnd: request.expected_end_at } : {})}
            onAssigned={() => setAssignOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
