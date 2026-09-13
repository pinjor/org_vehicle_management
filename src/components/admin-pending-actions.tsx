import { useState, type MouseEvent } from "react";
import { toast } from "sonner";
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
import { useDecideRequest, type RequestRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

function stop(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/** Approve + Assign driver for pending request cards / detail headers. */
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
  const decide = useDecideRequest();
  const [assignOpen, setAssignOpen] = useState(false);

  if (!isDispatcher || !user) return null;

  const assigned = !!(
    request.drivers ||
    request.vehicles ||
    request.assigned_driver_id ||
    request.assigned_vehicle_id
  );
  const canApprove = request.status === "submitted";
  const canAssign = ["submitted", "approved"].includes(request.status) && !assigned;

  if (!canApprove && !canAssign) return null;

  const approveBtn = canApprove ? (
    <Button
      type="button"
      size="sm"
      className={cn(layout === "foot" && "admin-pending__btn", "min-h-10")}
      disabled={decide.isPending}
      onClick={(e) => {
        stop(e);
        decide.mutate(
          { requestId: request.id, approve: true, actorId: user.id },
          {
            onSuccess: () => toast.success(`Approved ${request.reference}`),
            onError: (err) => toast.error(err.message),
          },
        );
      }}
    >
      {decide.isPending ? "…" : "Approve"}
    </Button>
  ) : null;

  const assignBtn = canAssign ? (
    <Button
      type="button"
      size="sm"
      variant={canApprove ? "outline" : "default"}
      className={cn(layout === "foot" && "admin-pending__btn", "min-h-10")}
      onClick={(e) => {
        stop(e);
        setAssignOpen(true);
      }}
    >
      Assign driver
    </Button>
  ) : null;

  return (
    <>
      <div
        className={cn(
          layout === "foot" && "ops-card__foot",
          layout === "foot" && canApprove && canAssign && "ops-card__foot--split",
          layout === "row" && "admin-pending__row",
          className,
        )}
        onClick={stop}
      >
        {approveBtn}
        {assignBtn}
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md gap-4" onClick={stop}>
          <DialogHeader>
            <DialogTitle>Assign driver</DialogTitle>
            <DialogDescription>
              {request.reference} · pick an available driver
            </DialogDescription>
          </DialogHeader>
          <AssignmentPanel
            requestId={request.id}
            passengers={request.passenger_count}
            {...(request.expected_end_at ? { expectedEnd: request.expected_end_at } : {})}
            onAssigned={() => setAssignOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
