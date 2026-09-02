import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/fleet-ui";
import {
  useAssignRequest,
  useDrivers,
  useVehicles,
} from "@/lib/queries";

export function AssignmentPanel({
  requestId,
  passengers,
  disabled,
  onAssigned,
  initialVehicleId,
  initialDriverId,
  changeMode = false,
}: {
  requestId: string;
  passengers: number;
  expectedEnd?: string;
  disabled?: boolean;
  onAssigned?: () => void;
  initialVehicleId?: string | null;
  initialDriverId?: string | null;
  /** Re-assign an existing trip pairing */
  changeMode?: boolean;
}) {
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const assign = useAssignRequest();
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? "");
  const [driverId, setDriverId] = useState(initialDriverId ?? "");

  const availableVehicles = useMemo(
    () =>
      (vehicles.data ?? []).filter(
        (v) =>
          (v.operational_status === "available" || v.id === initialVehicleId) &&
          Number(v.seat_capacity) >= passengers,
      ),
    [vehicles.data, passengers, initialVehicleId],
  );

  const availableDrivers = useMemo(
    () =>
      (drivers.data ?? []).filter(
        (d) => d.current_status === "available" || d.id === initialDriverId,
      ),
    [drivers.data, initialDriverId],
  );

  const vehicle = availableVehicles.find((v) => v.id === vehicleId);
  const driver = availableDrivers.find((d) => d.id === driverId);
  const canSubmit = !!vehicle && !!driver;

  function pickVehicle(id: string) {
    setVehicleId(id);
    const v = availableVehicles.find((x) => x.id === id);
    if (v?.primary_driver_id) {
      const linked = availableDrivers.find((d) => d.id === v.primary_driver_id);
      if (linked) setDriverId(linked.id);
    }
  }

  function pickDriver(id: string) {
    setDriverId(id);
    const d = availableDrivers.find((x) => x.id === id);
    if (d?.primary_vehicle_id) {
      const linked = availableVehicles.find((v) => v.id === d.primary_vehicle_id);
      if (linked) setVehicleId(linked.id);
    }
  }

  if (disabled) {
    return (
      <EmptyState
        compact
        title="Can't assign"
        description="This request is closed."
      />
    );
  }

  function runAssign() {
    if (!vehicle || !driver) {
      toast.error("Pick a vehicle and a driver");
      return;
    }
    assign.mutate(
      { requestId, vehicleId: vehicle.id, driverId: driver.id },
      {
        onSuccess: () => {
          toast.success(changeMode ? "Updated" : "Assigned");
          onAssigned?.();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  const linkedHint =
    vehicle?.primary_driver_id && vehicle.primary_driver_id === driverId
      ? "Primary pair"
      : vehicle?.primary_driver_id && driverId && vehicle.primary_driver_id !== driverId
        ? "Not primary driver"
        : null;

  return (
    <section className="min-w-0 space-y-3">
      <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="assign-vehicle" className="text-xs">
            Vehicle
          </Label>
          <Select {...(vehicleId ? { value: vehicleId } : {})} onValueChange={pickVehicle}>
            <SelectTrigger id="assign-vehicle" className="h-10 w-full min-w-0">
              <SelectValue placeholder="Select vehicle" />
            </SelectTrigger>
            <SelectContent className="max-h-40 max-w-[min(100vw-2rem,20rem)] sm:max-h-56">
              {availableVehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.fleet_number} · {v.name} ({v.seat_capacity})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="assign-driver" className="text-xs">
            Driver
          </Label>
          <Select {...(driverId ? { value: driverId } : {})} onValueChange={pickDriver}>
            <SelectTrigger id="assign-driver" className="h-10 w-full min-w-0">
              <SelectValue placeholder="Select driver" />
            </SelectTrigger>
            <SelectContent className="max-h-40 max-w-[min(100vw-2rem,20rem)] sm:max-h-56">
              {availableDrivers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {availableVehicles.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No free vehicles with enough seats.</p>
      )}
      {availableDrivers.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No free drivers.</p>
      )}
      {canSubmit && (
        <p className="text-[11px] text-muted-foreground">
          {vehicle.fleet_number} · {vehicle.name} + {driver.full_name}
          {linkedHint ? ` (${linkedHint})` : ""}
        </p>
      )}
      <Button
        size="sm"
        className="min-h-10 w-full sm:w-auto"
        disabled={assign.isPending || !canSubmit}
        tooltip={changeMode ? "Update assignment" : "Assign"}
        onClick={runAssign}
      >
        {changeMode ? "Update" : "Assign"}
      </Button>
    </section>
  );
}
