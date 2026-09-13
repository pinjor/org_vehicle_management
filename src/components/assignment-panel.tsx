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
import { DRIVER_STATUS, VEHICLE_STATUS } from "@/lib/fleet";
import {
  useAssignRequest,
  useDrivers,
  useVehicles,
  type DriverRecord,
  type VehicleRecord,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

function vehicleBlockReason(v: VehicleRecord, passengers: number): string | null {
  if (Number(v.seat_capacity) < passengers) return "Too few seats";
  if (v.operational_status === "available") return null;
  const short: Record<string, string> = {
    reserved: "Reserved",
    on_trip: "On trip",
    under_maintenance: "Maintenance",
    unavailable: "Unavailable",
    out_of_service: "Out of service",
    retired: "Retired",
  };
  return short[v.operational_status] ?? VEHICLE_STATUS[v.operational_status]?.label ?? v.operational_status;
}

function driverBlockReason(d: DriverRecord): string | null {
  if (d.current_status === "available") return null;
  const short: Record<string, string> = {
    reserved: "Reserved",
    driving: "On trip",
    break: "On break",
    off_duty: "Off duty",
    leave: "On leave",
    unavailable: "Unavailable",
    suspended: "Suspended",
  };
  return short[d.current_status] ?? DRIVER_STATUS[d.current_status]?.label ?? d.current_status;
}

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

  const vehicleOptions = useMemo(() => {
    const rows = [...(vehicles.data ?? [])];
    rows.sort((a, b) => {
      const aOk = !vehicleBlockReason(a, passengers) || a.id === initialVehicleId ? 0 : 1;
      const bOk = !vehicleBlockReason(b, passengers) || b.id === initialVehicleId ? 0 : 1;
      if (aOk !== bOk) return aOk - bOk;
      return a.fleet_number.localeCompare(b.fleet_number);
    });
    return rows;
  }, [vehicles.data, passengers, initialVehicleId]);

  const driverOptions = useMemo(() => {
    const rows = [...(drivers.data ?? [])];
    rows.sort((a, b) => {
      const aOk = !driverBlockReason(a) || a.id === initialDriverId ? 0 : 1;
      const bOk = !driverBlockReason(b) || b.id === initialDriverId ? 0 : 1;
      if (aOk !== bOk) return aOk - bOk;
      return a.full_name.localeCompare(b.full_name);
    });
    return rows;
  }, [drivers.data, initialDriverId]);

  const vehicle = vehicleOptions.find((v) => v.id === vehicleId);
  const driver = driverOptions.find((d) => d.id === driverId);

  const vehicleSelectable =
    !!vehicle &&
    (!vehicleBlockReason(vehicle, passengers) || vehicle.id === initialVehicleId);
  const driverSelectable =
    !!driver && (!driverBlockReason(driver) || driver.id === initialDriverId);
  const canSubmit = vehicleSelectable && driverSelectable;

  const freeVehicleCount = vehicleOptions.filter((v) => !vehicleBlockReason(v, passengers)).length;
  const freeDriverCount = driverOptions.filter((d) => !driverBlockReason(d)).length;

  function pickVehicle(id: string) {
    const v = vehicleOptions.find((x) => x.id === id);
    if (!v) return;
    if (vehicleBlockReason(v, passengers) && v.id !== initialVehicleId) {
      toast.error(vehicleBlockReason(v, passengers) ?? "Vehicle unavailable");
      return;
    }
    setVehicleId(id);
    if (v.primary_driver_id) {
      const linked = driverOptions.find((d) => d.id === v.primary_driver_id);
      if (linked && (!driverBlockReason(linked) || linked.id === initialDriverId)) {
        setDriverId(linked.id);
      }
    }
  }

  function pickDriver(id: string) {
    const d = driverOptions.find((x) => x.id === id);
    if (!d) return;
    if (driverBlockReason(d) && d.id !== initialDriverId) {
      toast.error(driverBlockReason(d) ?? "Driver unavailable");
      return;
    }
    setDriverId(id);
    if (d.primary_vehicle_id) {
      const linked = vehicleOptions.find((v) => v.id === d.primary_vehicle_id);
      if (linked && (!vehicleBlockReason(linked, passengers) || linked.id === initialVehicleId)) {
        setVehicleId(linked.id);
      }
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
    if (!vehicle || !driver || !canSubmit) {
      toast.error("Pick an available vehicle and driver");
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
            <SelectContent className="max-h-52 max-w-[min(100vw-2rem,22rem)] sm:max-h-64">
              {vehicleOptions.map((v) => {
                const reason = vehicleBlockReason(v, passengers);
                const blocked = !!reason && v.id !== initialVehicleId;
                return (
                  <SelectItem
                    key={v.id}
                    value={v.id}
                    disabled={blocked}
                    className={cn(
                      "items-start py-1.5",
                      blocked && "text-destructive data-[disabled]:opacity-100",
                    )}
                  >
                    <span className="flex w-full min-w-0 items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {v.fleet_number} · {v.name}
                        {!blocked ? ` (${v.seat_capacity})` : ""}
                      </span>
                      {blocked ? (
                        <span className="shrink-0 text-[10px] font-semibold leading-tight text-destructive sm:text-[11px]">
                          {reason}
                        </span>
                      ) : null}
                    </span>
                  </SelectItem>
                );
              })}
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
            <SelectContent className="max-h-52 max-w-[min(100vw-2rem,22rem)] sm:max-h-64">
              {driverOptions.map((d) => {
                const reason = driverBlockReason(d);
                const blocked = !!reason && d.id !== initialDriverId;
                return (
                  <SelectItem
                    key={d.id}
                    value={d.id}
                    disabled={blocked}
                    className={cn(
                      "items-start py-1.5",
                      blocked && "text-destructive data-[disabled]:opacity-100",
                    )}
                  >
                    <span className="flex w-full min-w-0 items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate">{d.full_name}</span>
                      {blocked ? (
                        <span className="shrink-0 text-[10px] font-semibold leading-tight text-destructive sm:text-[11px]">
                          {reason}
                        </span>
                      ) : null}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
      {freeVehicleCount === 0 && (
        <p className="text-[11px] text-muted-foreground">No free vehicles with enough seats.</p>
      )}
      {freeDriverCount === 0 && (
        <p className="text-[11px] text-muted-foreground">No free drivers.</p>
      )}
      {canSubmit && vehicle && driver && (
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
