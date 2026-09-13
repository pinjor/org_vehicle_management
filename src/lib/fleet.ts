export type AppRole = "employee" | "transport_admin" | "fleet_manager" | "driver" | "system_admin";

/** UI label for passenger count — avoid airline jargon "pax". */
export function passengerLabel(count: number): string {
  const n = Math.max(0, Math.floor(Number(count)) || 0);
  return n === 1 ? "1 passenger" : `${n} passengers`;
}

export type Tone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "primary"
  | "violet"
  | "coral"
  | "rose"
  | "sky";

export type RosterRole = "admin_hr" | "driver" | "employee";

export const ROSTER_ROLE: Record<RosterRole, { label: string; tone: Tone }> = {
  admin_hr: { label: "Admin / HR", tone: "primary" },
  driver: { label: "Driver", tone: "info" },
  employee: { label: "Employee", tone: "neutral" },
};

export const REQUEST_STATUS: Record<string, { label: string; tone: Tone }> = {
  submitted: { label: "Pending", tone: "warning" },
  under_review: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  rejected: { label: "Rejected", tone: "danger" },
  assigned: { label: "Assigned", tone: "primary" },
  in_progress: { label: "Active", tone: "success" },
  completed: { label: "Done", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const TRIP_STATUS: Record<string, { label: string; tone: Tone }> = {
  driver_assigned: { label: "Assigned", tone: "primary" },
  driver_confirmed: { label: "Confirmed", tone: "primary" },
  heading_to_pickup: { label: "To pickup", tone: "info" },
  arrived_pickup: { label: "At pickup", tone: "info" },
  passenger_picked_up: { label: "On board", tone: "success" },
  in_transit: { label: "On way", tone: "success" },
  stop_reached: { label: "At stop", tone: "info" },
  destination_reached: { label: "At drop", tone: "info" },
  passenger_dropped: { label: "Dropped", tone: "success" },
  return_pending: { label: "Return soon", tone: "warning" },
  return_in_transit: { label: "Returning", tone: "success" },
  completed: { label: "Done", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
  breakdown: { label: "Breakdown", tone: "danger" },
};

export const VEHICLE_STATUS: Record<string, { label: string; tone: Tone }> = {
  available: { label: "Available", tone: "success" },
  reserved: { label: "Reserved", tone: "primary" },
  on_trip: { label: "On trip", tone: "info" },
  under_maintenance: { label: "Under maintenance", tone: "warning" },
  unavailable: { label: "Unavailable", tone: "danger" },
  out_of_service: { label: "Out of service", tone: "danger" },
  retired: { label: "Retired", tone: "neutral" },
};

export const DRIVER_STATUS: Record<string, { label: string; tone: Tone }> = {
  available: { label: "Available", tone: "success" },
  reserved: { label: "Reserved", tone: "primary" },
  driving: { label: "Driving", tone: "info" },
  break: { label: "On break", tone: "warning" },
  off_duty: { label: "Off duty", tone: "neutral" },
  leave: { label: "On leave", tone: "neutral" },
  unavailable: { label: "Unavailable", tone: "danger" },
  suspended: { label: "Suspended", tone: "danger" },
};

export const PRIORITY: Record<string, { label: string; tone: Tone }> = {
  normal: { label: "Normal", tone: "neutral" },
  important: { label: "Important", tone: "info" },
  high: { label: "High", tone: "warning" },
  emergency: { label: "Emergency", tone: "danger" },
  vip: { label: "VIP", tone: "primary" },
};

/** Lower = handle first (emergency before normal). */
const PRIORITY_RANK: Record<string, number> = {
  emergency: 0,
  vip: 1,
  high: 2,
  important: 3,
  normal: 4,
};

/** Dispatch queue: priority → soonest pickup → oldest created. */
export function sortDispatchQueue<
  T extends { priority?: string; pickup_at?: string; created_at: string },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority ?? "normal"] ?? 9;
    const pb = PRIORITY_RANK[b.priority ?? "normal"] ?? 9;
    if (pa !== pb) return pa - pb;
    const ta = new Date(a.pickup_at ?? a.created_at).getTime();
    const tb = new Date(b.pickup_at ?? b.created_at).getTime();
    if (ta !== tb) return ta - tb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

const CLOSED_REQUEST = new Set(["completed", "cancelled", "rejected"]);
const CLOSED_TRIP = new Set(["completed", "cancelled", "breakdown"]);

/** All-requests / history lists: open first, closed last; newest first inside each. */
export function sortRequestsList<
  T extends { status: string; pickup_at?: string | null; created_at: string },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = CLOSED_REQUEST.has(a.status) ? 1 : 0;
    const pb = CLOSED_REQUEST.has(b.status) ? 1 : 0;
    if (pa !== pb) return pa - pb;
    const ta = new Date(a.created_at || a.pickup_at || 0).getTime();
    const tb = new Date(b.created_at || b.pickup_at || 0).getTime();
    return tb - ta;
  });
}

/** Trip lists: active first, done last; newest first inside each. */
export function sortTripsList<
  T extends { status: string; created_at: string; completed_at?: string | null },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = CLOSED_TRIP.has(a.status) ? 1 : 0;
    const pb = CLOSED_TRIP.has(b.status) ? 1 : 0;
    if (pa !== pb) return pa - pb;
    const ta = new Date(a.completed_at || a.created_at).getTime();
    const tb = new Date(b.completed_at || b.created_at).getTime();
    return tb - ta;
  });
}

export const TRIP_TYPE: Record<string, { label: string; tone: Tone }> = {
  one_way: { label: "One-way", tone: "info" },
  round_trip: { label: "Round trip", tone: "primary" },
  multi_stop: { label: "Multi-stop", tone: "warning" },
};

export const SHIFT: Record<string, { label: string; tone: Tone }> = {
  day: { label: "Day", tone: "warning" },
  evening: { label: "Evening", tone: "primary" },
  night: { label: "Night", tone: "info" },
  flexible: { label: "Flexible", tone: "neutral" },
};

export const SEVERITY: Record<string, { label: string; tone: Tone }> = {
  low: { label: "Low", tone: "neutral" },
  medium: { label: "Medium", tone: "warning" },
  high: { label: "High", tone: "danger" },
  critical: { label: "Critical", tone: "danger" },
};

export const APP_ROLE_CHIP: Record<AppRole, { label: string; tone: Tone }> = {
  employee: { label: "Employee", tone: "info" },
  transport_admin: { label: "Transport admin", tone: "primary" },
  fleet_manager: { label: "Fleet manager", tone: "primary" },
  driver: { label: "Driver", tone: "success" },
  system_admin: { label: "System admin", tone: "warning" },
};

export const UNAVAILABILITY_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pending review", tone: "warning" },
  approved_unavailable: { label: "Unavailable", tone: "danger" },
  sent_to_maintenance: { label: "In maintenance", tone: "info" },
  rejected: { label: "Rejected", tone: "neutral" },
  resolved: { label: "Resolved", tone: "success" },
};

const CATEGORY_TONE: Record<string, Tone> = {
  sedan: "info",
  car: "info",
  suv: "primary",
  mpv: "primary",
  microbus: "warning",
  minibus: "warning",
  bus: "warning",
  pickup: "neutral",
  ambulance: "danger",
  truck: "neutral",
};

export function categoryTone(category: string | null | undefined): Tone {
  if (!category) return "neutral";
  return CATEGORY_TONE[category] ?? "neutral";
}

export function categoryChipLabel(category: string | null | undefined) {
  if (!category) return "Any category";
  return VEHICLE_CATEGORY_LABELS[category as VehicleCategory] ?? category;
}

export const VEHICLE_CATEGORIES = [
  "sedan",
  "car",
  "suv",
  "mpv",
  "microbus",
  "minibus",
  "bus",
  "pickup",
  "ambulance",
  "truck",
] as const;

export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

export const VEHICLE_CATEGORY_LABELS: Record<VehicleCategory, string> = {
  sedan: "Sedan",
  car: "Car",
  suv: "SUV",
  mpv: "MPV",
  microbus: "Microbus",
  minibus: "Minibus",
  bus: "Bus",
  pickup: "Pickup",
  ambulance: "Ambulance",
  truck: "Truck",
};

/** Typical passenger capacity for category suggestions (fits N or fewer). */
export const VEHICLE_CATEGORY_CAPACITY: Record<string, number> = {
  sedan: 4,
  car: 4,
  pickup: 4,
  ambulance: 4,
  truck: 3,
  suv: 6,
  mpv: 7,
  microbus: 12,
  minibus: 25,
  bus: 40,
};

const SUGGEST_ORDER = ["sedan", "car", "suv", "mpv", "microbus", "minibus", "bus"] as const;

/** Smallest passenger-fit category from available lookup keys. */
export function suggestCategoryForPassengers(passengerCount: number, availableKeys: string[]): string {
  const n = Math.max(1, Math.floor(passengerCount) || 1);
  const keys = new Set(availableKeys);
  for (const key of SUGGEST_ORDER) {
    if (!keys.has(key)) continue;
    if ((VEHICLE_CATEGORY_CAPACITY[key] ?? 0) >= n) return key;
  }
  // Prefer largest capacity among remaining keys
  let best = availableKeys[0] ?? "sedan";
  let bestCap = VEHICLE_CATEGORY_CAPACITY[best] ?? 0;
  for (const key of availableKeys) {
    const cap = VEHICLE_CATEGORY_CAPACITY[key] ?? 0;
    if (cap > bestCap) {
      best = key;
      bestCap = cap;
    }
  }
  return best;
}

export function categoryFitsPassengers(category: string, passengerCount: number): boolean {
  const cap = VEHICLE_CATEGORY_CAPACITY[category];
  if (cap == null) return true;
  return cap >= Math.max(1, passengerCount);
}

export const FUEL_TYPE_LABELS: Record<string, string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  cng: "CNG",
  hybrid: "Hybrid",
  electric: "Electric",
};

/** Days until a date; negative = overdue. */
export function daysUntil(value?: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

export function complianceTone(days: number | null): Tone {
  if (days === null) return "neutral";
  if (days < 0) return "danger";
  if (days < 45) return "warning";
  return "success";
}

export function complianceLabel(days: number | null, label: string) {
  if (days === null) return `${label}: not set`;
  if (days < 0) return `${label}: expired ${Math.abs(days)}d ago`;
  if (days === 0) return `${label}: expires today`;
  return `${label}: ${days}d left`;
}

export function kmUntilService(odometer: number, lastServiceKm: number, intervalKm: number) {
  const nextAt = lastServiceKm + intervalKm;
  return nextAt - odometer;
}

export function serviceTone(kmRemaining: number): Tone {
  if (kmRemaining < 0) return "danger";
  if (kmRemaining < 1000) return "warning";
  return "success";
}

/** Driver action buttons derived from the server-side trip state machine. */
export function nextDriverActions(
  status: string,
  hasStops: boolean,
  isRoundTrip: boolean,
  /** Intermediate stops still ahead (stopCount - current_stop_index). */
  remainingStops = 0,
): { action: string; label: string; primary?: boolean; hint?: string }[] {
  switch (status) {
    case "driver_assigned":
      return [{ action: "confirm", label: "Confirm assignment", primary: true, hint: "Accept this trip and notify dispatch you're ready" }];
    case "driver_confirmed":
      return [{ action: "head_to_pickup", label: "Start heading to pickup", primary: true, hint: "Mark that you're driving to the pickup location" }];
    case "heading_to_pickup":
      return [{ action: "arrive_pickup", label: "I have arrived", primary: true, hint: "Tell dispatch you've reached the pickup point" }];
    case "arrived_pickup":
      return [{ action: "confirm_pickup", label: "Confirm passenger pickup", primary: true, hint: "Passengers are onboard — start the journey" }];
    case "passenger_picked_up":
      return hasStops
        ? [{ action: "depart", label: "Start journey", primary: true, hint: "Leave pickup and head toward the next stop" }]
        : [{ action: "reach_destination", label: "Reached destination", primary: true, hint: "You've arrived at the drop-off location" }];
    case "in_transit":
      // Intermediate stop ahead → At stop only. Last leg / final drop → destination only.
      if (remainingStops > 0) {
        return [
          { action: "reach_stop", label: "Confirm stop reached", primary: true, hint: "Mark this intermediate stop as complete" },
        ];
      }
      return [
        {
          action: "reach_destination",
          label: hasStops ? "Reached final destination" : "Reached destination",
          primary: true,
          hint: hasStops ? "Arrive at final drop" : "You've arrived at the drop-off location",
        },
      ];
    case "stop_reached":
      return [{ action: "depart", label: "Continue to next point", primary: true, hint: "Resume driving toward the next route point" }];
    case "destination_reached":
      return [{ action: "confirm_drop", label: "Confirm passenger drop", primary: true, hint: "Passengers have exited the vehicle" }];
    case "passenger_dropped":
      return [{ action: "complete", label: "Complete trip", primary: true, hint: "Close this trip and return vehicle to available pool" }];
    case "return_pending":
      return [{ action: "start_return", label: "Start return journey", primary: true, hint: "Begin the return leg of a round trip" }];
    case "return_in_transit":
      return [{ action: "complete", label: "Complete trip", primary: true, hint: "Finish the return journey and close the trip" }];
    default:
      return isRoundTrip ? [] : [];
  }
}

/** Dashboard / panel: Accept → Start ride → End ride (red). */
export type SimplifiedDriverCta = {
  action: "confirm" | "start_ride" | "end_ride";
  kind: "accept" | "start" | "end";
};

export function simplifiedDriverCta(status: string): SimplifiedDriverCta | null {
  if (status === "driver_assigned") {
    return { action: "confirm", kind: "accept" };
  }
  if (
    ["driver_confirmed", "heading_to_pickup", "arrived_pickup", "passenger_picked_up"].includes(
      status,
    )
  ) {
    return { action: "start_ride", kind: "start" };
  }
  if (
    [
      "in_transit",
      "stop_reached",
      "destination_reached",
      "passenger_dropped",
      "return_pending",
      "return_in_transit",
    ].includes(status)
  ) {
    return { action: "end_ride", kind: "end" };
  }
  return null;
}

export function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return `${formatDate(value)} · ${formatTime(value)}`;
}

/** "Pickup in 38 minutes" style micro-copy. */
export function relativeTime(value?: string | null) {
  if (!value) return "";
  const diff = new Date(value).getTime() - Date.now();
  const mins = Math.round(Math.abs(diff) / 60000);
  const suffix = diff >= 0 ? "" : " ago";
  const prefix = diff >= 0 ? "in " : "";
  if (mins < 1) return "now";
  if (mins < 60) return `${prefix}${mins} min${suffix}`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return `${prefix}${hours}h${rem ? ` ${rem}m` : ""}${suffix}`;
  return `${prefix}${Math.round(hours / 24)}d${suffix}`;
}

export function durationBetween(from: string, to: string) {
  const mins = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h ? `${h}h ` : ""}${m}m`;
}

export function toLocalInput(value: Date) {
  const tz = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - tz).toISOString().slice(0, 16);
}

/**
 * Convert a datetime-local wall clock (`YYYY-MM-DDTHH:mm`) to a real UTC ISO
 * using the browser's local timezone. Avoids Docker/UTC servers treating the
 * naive string as UTC (which shifts Asia/Dhaka by +6h).
 */
export function localInputToIso(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local.trim());
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const h = Number(m[4]);
    const mi = Number(m[5]);
    return new Date(y, mo - 1, d, h, mi, 0, 0).toISOString();
  }
  const parsed = new Date(local);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime: ${local}`);
  }
  return parsed.toISOString();
}

/** Parse client datetime — ISO with offset, or naive → Asia/Dhaka wall clock. */
export function clientDateTimeToIso(value: string): string {
  const s = String(value).trim();
  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)) {
    return new Date(s).toISOString();
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
  if (m) {
    // Bangladesh has no DST; naive booking times are Dhaka wall clock.
    return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+06:00`).toISOString();
  }
  return new Date(s).toISOString();
}

/** Human explanation of a recommendation score returned by the matching engine. */
export interface Recommendation {
  score: number;
  vid: string;
  did: string;
  vname: string;
  vreg: string;
  vcat: string;
  vseat: number;
  vstatus: string;
  dist_km: number | null;
  dname: string;
  dphone: string;
  dstatus: string;
  rating: number;
  trips_today: number;
  experience_years: number;
  next_assignment_at: string | null;
  license_expiry: string | null;
  last_service_date: string | null;
  has_ac: boolean;
  is_vip: boolean;
}

export function explainMatch(rec: Recommendation, passengers: number, expectedEnd: string) {
  const reasons: string[] = [];
  const warnings: string[] = [];
  reasons.push(`Available for the full requested window`);
  reasons.push(`${rec.vseat} seats for ${passengers} passenger${passengers > 1 ? "s" : ""}`);
  if (rec.dist_km != null) reasons.push(`${rec.dist_km} km from the pickup point`);
  reasons.push(`Driver ${rec.dname} is ${DRIVER_STATUS[rec.dstatus]?.label.toLowerCase() ?? rec.dstatus}`);
  if (rec.experience_years >= 10) reasons.push(`${rec.experience_years} years driving experience`);
  if (rec.trips_today === 0) reasons.push("No other trips today");
  else warnings.push(`Driver already has ${rec.trips_today} trip(s) today`);
  if (rec.next_assignment_at) {
    const gap = Math.round(
      (new Date(rec.next_assignment_at).getTime() - new Date(expectedEnd).getTime()) / 60000,
    );
    if (gap < 60) warnings.push(`Low buffer — next booking starts in ${gap} min after this trip`);
    else reasons.push(`Next booking only ${Math.round(gap / 60)}h after completion`);
  }
  if (rec.license_expiry) {
    const days = Math.round((new Date(rec.license_expiry).getTime() - Date.now()) / 86400000);
    if (days < 60) warnings.push(`Driver licence expires in ${days} days`);
  }
  if (rec.vseat - passengers > 6) warnings.push("Vehicle is larger than needed for this trip");
  return { reasons, warnings };
}