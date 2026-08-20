export type AppRole = "employee" | "transport_admin" | "fleet_manager" | "driver" | "system_admin";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

export const REQUEST_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Awaiting review", tone: "warning" },
  under_review: { label: "Under review", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  rejected: { label: "Rejected", tone: "danger" },
  assigned: { label: "Assigned", tone: "primary" },
  in_progress: { label: "In progress", tone: "success" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const TRIP_STATUS: Record<string, { label: string; tone: Tone }> = {
  driver_assigned: { label: "Driver assigned", tone: "primary" },
  driver_confirmed: { label: "Driver confirmed", tone: "primary" },
  heading_to_pickup: { label: "Heading to pickup", tone: "info" },
  arrived_pickup: { label: "Arrived at pickup", tone: "info" },
  passenger_picked_up: { label: "Passenger on board", tone: "success" },
  in_transit: { label: "In transit", tone: "success" },
  stop_reached: { label: "Stop reached", tone: "info" },
  destination_reached: { label: "At destination", tone: "info" },
  passenger_dropped: { label: "Passenger dropped", tone: "success" },
  return_pending: { label: "Return pending", tone: "warning" },
  return_in_transit: { label: "Return journey", tone: "success" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
  no_show: { label: "No show", tone: "danger" },
  breakdown: { label: "Breakdown", tone: "danger" },
  emergency_stop: { label: "Emergency stop", tone: "danger" },
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

export const VEHICLE_CATEGORIES = [
  "sedan",
  "suv",
  "microbus",
  "minibus",
  "bus",
  "pickup",
  "ambulance",
  "truck",
] as const;

/** Driver action buttons derived from the server-side trip state machine. */
export function nextDriverActions(
  status: string,
  hasStops: boolean,
  isRoundTrip: boolean,
): { action: string; label: string; primary?: boolean }[] {
  switch (status) {
    case "driver_assigned":
      return [{ action: "confirm", label: "Confirm assignment", primary: true }];
    case "driver_confirmed":
      return [{ action: "head_to_pickup", label: "Start heading to pickup", primary: true }];
    case "heading_to_pickup":
      return [{ action: "arrive_pickup", label: "I have arrived", primary: true }];
    case "arrived_pickup":
      return [{ action: "confirm_pickup", label: "Confirm passenger pickup", primary: true }];
    case "passenger_picked_up":
      return hasStops
        ? [{ action: "depart", label: "Start journey", primary: true }]
        : [{ action: "reach_destination", label: "Reached destination", primary: true }];
    case "in_transit":
      return hasStops
        ? [
            { action: "reach_stop", label: "Confirm stop reached", primary: true },
            { action: "reach_destination", label: "Reached final destination" },
          ]
        : [{ action: "reach_destination", label: "Reached destination", primary: true }];
    case "stop_reached":
      return [{ action: "depart", label: "Continue to next point", primary: true }];
    case "destination_reached":
      return [{ action: "confirm_drop", label: "Confirm passenger drop", primary: true }];
    case "passenger_dropped":
      return [{ action: "complete", label: "Complete trip", primary: true }];
    case "return_pending":
      return [{ action: "start_return", label: "Start return journey", primary: true }];
    case "return_in_transit":
      return [{ action: "complete", label: "Complete trip", primary: true }];
    default:
      return isRoundTrip ? [] : [];
  }
}

export function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
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