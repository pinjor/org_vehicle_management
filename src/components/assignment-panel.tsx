import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusChip, EmptyState } from "@/components/fleet-ui";
import { useAssignRequest, useRecommendations } from "@/lib/queries";
import { DRIVER_STATUS, explainMatch, formatDateTime } from "@/lib/fleet";

export function AssignmentPanel({
  requestId,
  passengers,
  expectedEnd,
  disabled,
}: {
  requestId: string;
  passengers: number;
  expectedEnd: string;
  disabled?: boolean;
}) {
  const { data, isLoading } = useRecommendations(requestId, !disabled);
  const assign = useAssignRequest();
  const [selected, setSelected] = useState<string | null>(null);

  if (disabled) {
    return <EmptyState title="Assignment closed" description="This request is not in an assignable state." />;
  }
  if (isLoading) return <p className="text-sm text-muted-foreground">Scoring available vehicle and driver pairs…</p>;
  const recs = data ?? [];
  if (!recs.length) {
    return (
      <EmptyState
        title="No compatible pairs"
        description="No vehicle and driver combination is free for the whole requested window."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {recs.slice(0, 6).map((rec, i) => {
        const key = `${rec.vid}-${rec.did}`;
        const { reasons, warnings } = explainMatch(rec, passengers, expectedEnd);
        const open = selected === key;
        return (
          <li key={key} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {i === 0 && <span className="mr-2 text-xs font-semibold text-primary">Best match</span>}
                  {rec.vname} · {rec.vreg}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rec.dname} · {rec.dphone} · rating {rec.rating} ·{" "}
                  {DRIVER_STATUS[rec.dstatus]?.label ?? rec.dstatus}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip label={`Score ${Math.round(rec.score)}`} tone={i === 0 ? "success" : "neutral"} />
                <Button
                  size="sm"
                  disabled={assign.isPending}
                  onClick={() =>
                    assign.mutate(
                      { requestId, vehicleId: rec.vid, driverId: rec.did },
                      {
                        onSuccess: () => toast.success(`Assigned ${rec.vreg} to ${rec.dname}`),
                        onError: (e) => toast.error(e.message),
                      },
                    )
                  }
                >
                  Assign
                </Button>
              </div>
            </div>
            <button
              type="button"
              className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setSelected(open ? null : key)}
            >
              {open ? "Hide reasoning" : "Why this match?"}
            </button>
            {open && (
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                <ul className="space-y-1 text-muted-foreground">
                  {reasons.map((r) => (
                    <li key={r}>+ {r}</li>
                  ))}
                </ul>
                <ul className="space-y-1 text-warning-foreground">
                  {warnings.length === 0 && <li className="text-muted-foreground">No warnings</li>}
                  {warnings.map((w) => (
                    <li key={w}>! {w}</li>
                  ))}
                </ul>
                {rec.next_assignment_at && (
                  <p className="text-muted-foreground sm:col-span-2">
                    Next booking for this pair: {formatDateTime(rec.next_assignment_at)}
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
