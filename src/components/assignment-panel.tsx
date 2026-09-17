import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState } from "@/components/fleet-ui";
import { DRIVER_STATUS, VEHICLE_STATUS } from "@/lib/fleet";
import { formatBdPhone } from "@/lib/phone";
import { apiGet } from "@/lib/api-client";
import {
  useAssignRequest,
  useDrivers,
  useVehicles,
  type DriverRecord,
  type VehicleRecord,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

function vehicleHardBlock(v: VehicleRecord, passengers: number): string | null {
  if (Number(v.seat_capacity) < passengers) return "Too few seats";
  if (["under_maintenance", "unavailable", "out_of_service", "retired"].includes(v.operational_status)) {
    return VEHICLE_STATUS[v.operational_status]?.label ?? v.operational_status;
  }
  return null;
}

function driverHardBlock(d: DriverRecord): string | null {
  if (["leave", "off_duty", "unavailable", "suspended"].includes(d.current_status)) {
    return DRIVER_STATUS[d.current_status]?.label ?? d.current_status;
  }
  return null;
}

type Pair = {
  driver: DriverRecord;
  vehicle: VehicleRecord | null;
  /** Null → selectable */
  blockReason: string | null;
};

function journeyKey(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function AssignmentPanel({
  requestId,
  passengers,
  journeyDate,
  pickupAt,
  disabled,
  onAssigned,
  initialVehicleId,
  initialDriverId,
  changeMode = false,
}: {
  requestId: string;
  passengers: number;
  /** YYYY-MM-DD — preferred for day occupancy */
  journeyDate?: string | null;
  pickupAt?: string | null;
  expectedEnd?: string;
  disabled?: boolean;
  onAssigned?: () => void;
  initialVehicleId?: string | null | undefined;
  initialDriverId?: string | null | undefined;
  /** Re-assign an existing trip pairing */
  changeMode?: boolean;
}) {
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const assign = useAssignRequest();
  const [query, setQuery] = useState("");

  const day = journeyKey(journeyDate) ?? journeyKey(pickupAt);

  const busy = useQuery({
    queryKey: ["assignments-busy", day, requestId],
    enabled: !!day,
    queryFn: () =>
      apiGet<{ driverIds: string[]; vehicleIds: string[] }>(
        `/api/assignments/busy?date=${day}&excludeRequestId=${requestId}`,
      ),
  });

  const busyDrivers = useMemo(() => new Set(busy.data?.driverIds ?? []), [busy.data]);
  const busyVehicles = useMemo(() => new Set(busy.data?.vehicleIds ?? []), [busy.data]);

  const freeVehicles = useMemo(() => {
    const rows = (vehicles.data ?? []).filter((v) => {
      if (v.id === initialVehicleId) return true;
      if (vehicleHardBlock(v, passengers)) return false;
      if (busyVehicles.has(v.id)) return false;
      return true;
    });
    rows.sort((a, b) => a.fleet_number.localeCompare(b.fleet_number));
    return rows;
  }, [vehicles.data, passengers, initialVehicleId, busyVehicles]);

  const pairs = useMemo(() => {
    const allVehicles = vehicles.data ?? [];
    const rows = [...(drivers.data ?? [])];
    rows.sort((a, b) => a.full_name.localeCompare(b.full_name));

    const out: Pair[] = [];
    for (const driver of rows) {
      const isInitial = driver.id === initialDriverId;
      const statusBlock = !isInitial ? driverHardBlock(driver) : null;
      const dayBusy = !isInitial && busyDrivers.has(driver.id);

      const freeLinked = freeVehicles.find((v) => v.id === driver.primary_vehicle_id);
      const anyLinked = allVehicles.find((v) => v.id === driver.primary_vehicle_id);
      const freeVehicle =
        freeLinked ??
        (isInitial ? freeVehicles.find((v) => v.id === initialVehicleId) : undefined) ??
        freeVehicles[0] ??
        null;
      const displayVehicle = freeVehicle ?? anyLinked ?? null;

      let blockReason: string | null = null;
      if (statusBlock) {
        blockReason = statusBlock;
      } else if (dayBusy) {
        blockReason = "Not available that day";
      } else if (!freeVehicle) {
        blockReason = "No free vehicle";
      }

      out.push({ driver, vehicle: displayVehicle, blockReason });
    }

    // Selectable first, then blocked
    out.sort((a, b) => {
      const aOk = a.blockReason ? 1 : 0;
      const bOk = b.blockReason ? 1 : 0;
      if (aOk !== bOk) return aOk - bOk;
      return a.driver.full_name.localeCompare(b.driver.full_name);
    });
    return out;
  }, [
    drivers.data,
    vehicles.data,
    freeVehicles,
    initialDriverId,
    initialVehicleId,
    busyDrivers,
  ]);

  const freeCount = useMemo(
    () => pairs.filter((p) => !p.blockReason && p.vehicle).length,
    [pairs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const digits = q.replace(/\D/g, "");
    return pairs.filter(({ driver, vehicle }) => {
      const name = driver.full_name.toLowerCase();
      const phone = (driver.phone ?? "").toLowerCase();
      const phoneDigits = phone.replace(/\D/g, "");
      const fleet = vehicle
        ? `${vehicle.fleet_number} ${vehicle.name}`.toLowerCase()
        : "";
      if (name.includes(q) || phone.includes(q) || (fleet && fleet.includes(q))) return true;
      if (digits.length >= 3 && phoneDigits.includes(digits)) return true;
      return false;
    });
  }, [pairs, query]);

  const searchActive = query.trim().length > 0;

  function runAssign(driverId: string, vehicleId: string) {
    if (assign.isPending) return;
    assign.mutate(
      { requestId, vehicleId, driverId },
      {
        onSuccess: () => {
          toast.success(changeMode ? "Updated" : "Assigned");
          onAssigned?.();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  if (disabled) {
    return <EmptyState compact title="Can't assign" description="This request is closed." />;
  }

  if (vehicles.isLoading || drivers.isLoading || (day && busy.isLoading)) {
    return <p className="text-sm text-muted-foreground">Loading drivers…</p>;
  }

  if (pairs.length === 0) {
    return (
      <EmptyState
        compact
        title="No drivers"
        description="Add drivers in the roster before assigning."
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
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or phone…"
          className="assign-panel__search-input"
          autoComplete="off"
          autoFocus
        />
      </label>

      {day ? (
        <p className="text-xs text-muted-foreground">
          Occupancy for {day} · {freeCount} free · search to pick
        </p>
      ) : null}

      {!searchActive ? (
        <p className="text-sm text-muted-foreground">
          Type a name or phone to find a driver ({freeCount} free
          {day ? " this day" : ""}
          {pairs.length > freeCount ? ` · ${pairs.length - freeCount} unavailable` : ""}).
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No drivers match “{query.trim()}”.</p>
      ) : (
        <ul className="assign-panel__list" role="listbox" aria-label="Matching drivers">
          {filtered.map(({ driver, vehicle, blockReason }) => {
            const key = `${driver.id}:${vehicle?.id ?? "none"}`;
            const primary =
              !!vehicle &&
              !!driver.primary_vehicle_id &&
              driver.primary_vehicle_id === vehicle.id;
            const phone = driver.phone?.trim();
            const canSelect = !blockReason && !!vehicle && !assign.isPending;
            return (
              <li key={key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  aria-disabled={!canSelect}
                  disabled={!canSelect}
                  className={cn(
                    "assign-panel__row",
                    blockReason && "assign-panel__row--blocked",
                    assign.isPending && "opacity-60",
                  )}
                  onClick={() => {
                    if (!canSelect || !vehicle) return;
                    runAssign(driver.id, vehicle.id);
                  }}
                >
                  <span className="assign-panel__name">{driver.full_name}</span>
                  {phone ? (
                    <span className="assign-panel__phone">{formatBdPhone(phone)}</span>
                  ) : null}
                  {vehicle ? (
                    <span className="assign-panel__meta">
                      {vehicle.fleet_number} · {vehicle.name}
                      {primary ? " · Primary" : ""}
                      {canSelect && !assign.isPending ? " · Tap to assign" : null}
                      {assign.isPending && canSelect ? " · Assigning…" : null}
                    </span>
                  ) : (
                    <span className="assign-panel__meta">No linked vehicle</span>
                  )}
                  {blockReason ? (
                    <span className="assign-panel__blocked">{blockReason}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
