import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/fleet-ui";
import { DRIVER_STATUS, VEHICLE_STATUS } from "@/lib/fleet";
import { formatBdPhone } from "@/lib/phone";
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

type Pair = { driver: DriverRecord; vehicle: VehicleRecord };

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
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string>(() =>
    initialDriverId && initialVehicleId ? `${initialDriverId}:${initialVehicleId}` : "",
  );

  const freeVehicles = useMemo(() => {
    const rows = (vehicles.data ?? []).filter(
      (v) => !vehicleBlockReason(v, passengers) || v.id === initialVehicleId,
    );
    rows.sort((a, b) => a.fleet_number.localeCompare(b.fleet_number));
    return rows;
  }, [vehicles.data, passengers, initialVehicleId]);

  const pairs = useMemo(() => {
    const rows = (drivers.data ?? []).filter(
      (d) => !driverBlockReason(d) || d.id === initialDriverId,
    );
    rows.sort((a, b) => a.full_name.localeCompare(b.full_name));

    const out: Pair[] = [];
    for (const driver of rows) {
      const linked = freeVehicles.find((v) => v.id === driver.primary_vehicle_id);
      const vehicle =
        linked ??
        (initialDriverId === driver.id
          ? freeVehicles.find((v) => v.id === initialVehicleId)
          : undefined) ??
        freeVehicles[0];
      if (!vehicle) continue;
      out.push({ driver, vehicle });
    }
    return out;
  }, [drivers.data, freeVehicles, initialDriverId, initialVehicleId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const digits = q.replace(/\D/g, "");
    return pairs.filter(({ driver, vehicle }) => {
      const name = driver.full_name.toLowerCase();
      const phone = (driver.phone ?? "").toLowerCase();
      const phoneDigits = phone.replace(/\D/g, "");
      const fleet = `${vehicle.fleet_number} ${vehicle.name}`.toLowerCase();
      if (name.includes(q) || phone.includes(q) || fleet.includes(q)) return true;
      if (digits.length >= 3 && phoneDigits.includes(digits)) return true;
      return false;
    });
  }, [pairs, query]);

  const selected = pairs.find((p) => `${p.driver.id}:${p.vehicle.id}` === picked) ?? null;
  const searchActive = query.trim().length > 0;

  if (disabled) {
    return <EmptyState compact title="Can't assign" description="This request is closed." />;
  }

  function runAssign() {
    if (!selected) {
      toast.error("Pick a driver");
      return;
    }
    assign.mutate(
      { requestId, vehicleId: selected.vehicle.id, driverId: selected.driver.id },
      {
        onSuccess: () => {
          toast.success(changeMode ? "Updated" : "Assigned");
          onAssigned?.();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  if (vehicles.isLoading || drivers.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading drivers…</p>;
  }

  if (pairs.length === 0) {
    return (
      <EmptyState
        compact
        title="No drivers free"
        description={
          freeVehicles.length === 0
            ? "No free vehicles with enough seats."
            : "No available drivers to assign."
        }
      />
    );
  }

  return (
    <section className="assign-panel min-w-0 space-y-3">
      <label className="assign-panel__search">
        <Search className="assign-panel__search-icon" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked("");
          }}
          placeholder="Search name or phone…"
          className="assign-panel__search-input"
          autoComplete="off"
          autoFocus
        />
      </label>

      {!searchActive ? (
        <p className="text-sm text-muted-foreground">
          Type a name or phone to find a driver ({pairs.length} available).
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No drivers match “{query.trim()}”.</p>
      ) : (
        <ul className="assign-panel__list" role="listbox" aria-label="Matching drivers">
          {filtered.map(({ driver, vehicle }) => {
            const key = `${driver.id}:${vehicle.id}`;
            const active = picked === key;
            const primary =
              !!driver.primary_vehicle_id && driver.primary_vehicle_id === vehicle.id;
            const phone = driver.phone?.trim();
            return (
              <li key={key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn("assign-panel__row", active && "assign-panel__row--active")}
                  onClick={() => setPicked(key)}
                >
                  <span className="assign-panel__name">{driver.full_name}</span>
                  {phone ? (
                    <span className="assign-panel__phone">{formatBdPhone(phone)}</span>
                  ) : null}
                  <span className="assign-panel__meta">
                    {vehicle.fleet_number} · {vehicle.name}
                    {primary ? " · Primary" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Button
        size="sm"
        className="min-h-10 w-full"
        disabled={assign.isPending || !selected}
        tooltip={changeMode ? "Update assignment" : "Assign driver"}
        onClick={runAssign}
      >
        {assign.isPending ? "…" : changeMode ? "Update assignment" : "Assign driver"}
      </Button>
    </section>
  );
}
