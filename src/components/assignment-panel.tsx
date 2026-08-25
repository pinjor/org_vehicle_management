import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AssignmentSkeleton } from "@/components/loading-skeletons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusChip, EmptyState } from "@/components/fleet-ui";
import { useAssignRequest, useDrivers, useRecommendations, useVehicles } from "@/lib/queries";
import { DRIVER_STATUS, explainMatch, formatDateTime } from "@/lib/fleet";

export function AssignmentPanel({
  requestId,
  passengers,
  expectedEnd,
  disabled,
  onAssigned,
}: {
  requestId: string;
  passengers: number;
  expectedEnd: string;
  disabled?: boolean;
  onAssigned?: () => void;
}) {
  const { data, isLoading } = useRecommendations(requestId, !disabled);
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const assign = useAssignRequest();
  const [selected, setSelected] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [driverId, setDriverId] = useState<string>("");

  const availableVehicles = useMemo(
    () =>
      (vehicles.data ?? []).filter(
        (v) =>
          v.operational_status === "available" &&
          Number(v.seat_capacity) >= passengers,
      ),
    [vehicles.data, passengers],
  );

  const availableDrivers = useMemo(
    () => (drivers.data ?? []).filter((d) => d.current_status === "available"),
    [drivers.data],
  );

  if (disabled) {
    return (
      <EmptyState
        compact
        title="Assignment closed"
        description="This request is not in an assignable state."
      />
    );
  }
  if (isLoading) return <AssignmentSkeleton />;

  const recs = data ?? [];

  function runAssign(vid: string, did: string, label?: string) {
    if (!vid || !did) {
      toast.error("Pick both a vehicle and a driver");
      return;
    }
    assign.mutate(
      { requestId, vehicleId: vid, driverId: did },
      {
        onSuccess: () => {
          toast.success(label ?? "Vehicle and driver assigned");
          onAssigned?.();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2.5 rounded-lg border border-border bg-surface-2/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pick vehicle & driver
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="assign-vehicle" className="text-xs">
              Vehicle
            </Label>
            <Select value={vehicleId || undefined} onValueChange={setVehicleId}>
              <SelectTrigger id="assign-vehicle" className="h-10 w-full">
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {availableVehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.fleet_number} · {v.name} ({v.seat_capacity} seats)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableVehicles.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No available vehicles fit this passenger count.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assign-driver" className="text-xs">
              Driver
            </Label>
            <Select value={driverId || undefined} onValueChange={setDriverId}>
              <SelectTrigger id="assign-driver" className="h-10 w-full">
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                {availableDrivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.full_name}
                    {d.phone ? ` · ${d.phone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableDrivers.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No drivers marked available.</p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          className="min-h-10 w-full sm:w-auto"
          disabled={assign.isPending || !vehicleId || !driverId}
          tooltip="Assign the selected vehicle and driver"
          onClick={() => runAssign(vehicleId, driverId)}
        >
          Assign selected
        </Button>
      </section>

      {recs.length === 0 ? (
        <EmptyState
          compact
          title="No ranked matches"
          description="Use the dropdowns above, or free a vehicle/driver for recommendations."
        />
      ) : (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Best matches
          </p>
          <ul className="list-stagger space-y-2.5">
            {recs.slice(0, 6).map((rec, i) => {
              const key = `${rec.vid}-${rec.did}`;
              const { reasons, warnings } = explainMatch(rec, passengers, expectedEnd);
              const open = selected === key;
              return (
                <li key={key} className="list-stagger-item rounded-lg border border-border p-3">
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {i === 0 && (
                          <span className="mr-2 text-xs font-semibold text-primary">Best match</span>
                        )}
                        {rec.vname} · {rec.vreg}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {rec.dname} · {rec.dphone} · rating {rec.rating} ·{" "}
                        {DRIVER_STATUS[rec.dstatus]?.label ?? rec.dstatus}
                      </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                      <StatusChip
                        label={`Score ${Math.round(rec.score)}`}
                        tone={i === 0 ? "success" : "neutral"}
                      />
                      <Button
                        size="sm"
                        className="min-h-9 w-full sm:w-auto"
                        disabled={assign.isPending}
                        tooltip={`Dispatch ${rec.vreg} with ${rec.dname}`}
                        onClick={() =>
                          runAssign(rec.vid, rec.did, `Assigned ${rec.vreg} to ${rec.dname}`)
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
                        {warnings.length === 0 && (
                          <li className="text-muted-foreground">No warnings</li>
                        )}
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
        </section>
      )}
    </div>
  );
}
