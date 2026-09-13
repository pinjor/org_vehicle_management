import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api-client";
import type { LookupsPayload, LookupValue } from "@/lib/lookups";
import type { Recommendation } from "./fleet";

const qs = (params: Record<string, string | string[] | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export type RequestRow = {
  id: string;
  reference: string;
  status: string;
  purpose: string;
  priority: string;
  trip_type: string;
  passenger_count: number;
  pickup_at: string;
  expected_end_at?: string;
  created_at: string;
  requester_name: string;
  requester_phone?: string;
  requester_id?: string;
  requested_category?: string;
  is_round_trip?: boolean;
  assigned_vehicle_id?: string | null;
  assigned_driver_id?: string | null;
  assigned_at?: string | null;
  requires_ac?: boolean;
  cost_center?: string | null;
  special_requirements?: string | null;
  departments?: { name?: string; code?: string } | null;
  vehicles?: {
    id?: string;
    name?: string;
    registration_number?: string;
    category?: string;
    seat_capacity?: number;
  } | null;
  drivers?: {
    id?: string;
    full_name?: string;
    phone?: string;
    current_status?: string;
  } | null;
  trips?: { id: string; reference: string; status: string }[];
  request_route_points?: {
    name: string;
    address?: string | null;
    point_type: string;
    sequence: number;
  }[];
};

async function fetchRequests(filters?: { status?: string[]; requesterId?: string }) {
  return apiGet<RequestRow[]>(
    `/api/requests${qs({ status: filters?.status, requesterId: filters?.requesterId })}`,
  );
}

export function useRequests(filters?: { status?: string[]; requesterId?: string }) {
  return useQuery({
    queryKey: ["requests", filters],
    queryFn: () => fetchRequests(filters),
    refetchInterval: 30_000,
  });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: ["request", id],
    queryFn: () => apiGet<{ request: RequestRow; points: unknown[]; passengers: unknown[] }>(`/api/requests/${id}`),
    refetchInterval: 15_000,
  });
}

export function useTripHistory(tripId?: string) {
  return useQuery({
    queryKey: ["trip-history", tripId],
    enabled: !!tripId,
    queryFn: () => apiGet<unknown[]>(`/api/trips/${tripId}/history`),
  });
}

export function useAuditTrail(entityId?: string) {
  return useQuery({
    queryKey: ["audit", entityId],
    enabled: !!entityId,
    queryFn: () => apiGet<unknown[]>(`/api/audit/${entityId}`),
  });
}

export function useRecommendations(requestId?: string, enabled = true) {
  return useQuery({
    queryKey: ["recommendations", requestId],
    enabled: !!requestId && enabled,
    queryFn: () => apiGet<Recommendation[]>(`/api/requests/${requestId}/recommendations`),
  });
}

export type VehicleRecord = {
  id: string;
  registration_number: string;
  fleet_number: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  model_year: number | null;
  color: string | null;
  seat_capacity: number;
  luggage_capacity: number;
  fuel_type: string;
  transmission: string;
  has_ac: boolean;
  is_vip: boolean;
  ownership: string;
  branch: string;
  odometer_km: number;
  last_service_km: number;
  last_service_date: string | null;
  service_interval_km: number;
  registration_expiry: string | null;
  fitness_expiry: string | null;
  insurance_expiry: string | null;
  tax_token_expiry: string | null;
  last_repair_date: string | null;
  last_repair_summary: string | null;
  operational_status: string;
  notes: string | null;
  primary_driver_id: string | null;
  primary_driver_name?: string | null;
  primary_driver_code?: string | null;
  primary_driver_phone?: string | null;
};

export type DriverRecord = {
  id: string;
  user_id: string | null;
  driver_code: string;
  full_name: string;
  email: string | null;
  phone: string;
  alternate_phone: string | null;
  license_number: string;
  license_type: string;
  license_expiry: string | null;
  allowed_categories: string[];
  experience_years: number;
  shift: string;
  current_status: string;
  blood_group: string | null;
  emergency_contact: string | null;
  address: string | null;
  date_of_joining: string | null;
  rating: number;
  primary_vehicle_id?: string | null;
  primary_vehicle_fleet?: string | null;
  primary_vehicle_name?: string | null;
  primary_vehicle_reg?: string | null;
  primary_vehicle_category?: string | null;
};

export type TripRecord = {
  id: string;
  reference: string;
  status: string;
  created_at: string;
  request_id?: string;
  vehicle_id?: string;
  driver_id?: string;
  current_stop_index?: number;
  vehicles?: { name: string; registration_number?: string; seat_capacity?: number };
  drivers?: { full_name: string; phone?: string; driver_code?: string };
  vehicle_requests?: {
    id?: string;
    purpose?: string;
    pickup_at?: string;
    reference?: string;
    passenger_count?: number;
    is_round_trip?: boolean;
    requester_name?: string;
    requester_phone?: string;
    request_route_points?: {
      sequence: number;
      name: string;
      address?: string;
      latitude: number | null;
      longitude: number | null;
      point_type: string;
      expected_at?: string | null;
    }[];
    request_passengers?: {
      full_name: string;
      phone?: string | null;
      is_primary?: boolean;
    }[];
  };
};

export function useVehicles() {
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: () => apiGet<VehicleRecord[]>("/api/vehicles"),
  });
}

export function useVehicle(id: string) {
  return useQuery({
    queryKey: ["vehicle", id],
    enabled: !!id,
    queryFn: () => apiGet<VehicleRecord>(`/api/vehicles/${id}`),
  });
}

export function useDrivers() {
  return useQuery({
    queryKey: ["drivers"],
    queryFn: () => apiGet<DriverRecord[]>("/api/drivers"),
  });
}

export function useDriver(id: string) {
  return useQuery({
    queryKey: ["driver", id],
    enabled: !!id,
    queryFn: () => apiGet<DriverRecord>(`/api/drivers/${id}`),
  });
}

export function useUpdateVehicle() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: (input: { id: string; patch: Record<string, unknown> }) =>
      apiPatch<unknown>(`/api/vehicles/${input.id}`, input.patch),
    onSuccess: invalidate,
  });
}

export function useCreateVehicle() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => apiPost<unknown>("/api/vehicles", input),
    onSuccess: invalidate,
  });
}

export function useUpdateDriver() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: (input: { id: string; patch: Record<string, unknown> }) =>
      apiPatch<unknown>(`/api/drivers/${input.id}`, input.patch),
    onSuccess: invalidate,
  });
}

export function useCreateDriver() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => apiPost<unknown>("/api/drivers", input),
    onSuccess: invalidate,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch(`/api/notifications/${id}/read`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost("/api/notifications/read-all"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: () => apiGet<unknown[]>("/api/locations"),
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: () => apiGet<unknown[]>("/api/departments"),
  });
}

export type UnavailabilityRow = {
  id: string;
  reference: string;
  status: string;
  reason: string;
  severity: string;
  description?: string | null;
  admin_note?: string | null;
  created_at: string;
  vehicle_id: string;
  vehicles?: {
    registration_number?: string;
    name?: string;
    fleet_number?: string;
    operational_status?: string;
  } | null;
  drivers?: { full_name?: string; phone?: string } | null;
};

export function useUnavailabilityRequests() {
  return useQuery({
    queryKey: ["unavailability"],
    queryFn: () => apiGet<UnavailabilityRow[]>("/api/unavailability"),
  });
}

export function useNotifications(userId?: string) {
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    refetchInterval: 20_000,
    queryFn: () => apiGet<unknown[]>("/api/notifications"),
  });
}

export function useDriverTrips(driverId?: string) {
  return useQuery({
    queryKey: ["driver-trips", driverId],
    enabled: !!driverId,
    refetchInterval: 20_000,
    queryFn: () => apiGet<TripRecord[]>(`/api/trips/driver/${driverId}`),
  });
}

export function useVehicleTrips(vehicleId?: string) {
  return useQuery({
    queryKey: ["vehicle-trips", vehicleId],
    enabled: !!vehicleId,
    refetchInterval: 20_000,
    queryFn: () => apiGet<TripRecord[]>(`/api/trips/vehicle/${vehicleId}`),
  });
}

export function useActiveTrips() {
  return useQuery({
    queryKey: ["active-trips"],
    refetchInterval: 20_000,
    queryFn: () => apiGet<TripRecord[]>("/api/trips/active"),
  });
}

export type FleetTripRow = {
  id: string;
  reference: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  request_id: string;
  vehicles?: { name?: string; registration_number?: string } | null;
  drivers?: { full_name?: string; phone?: string } | null;
  vehicle_requests?: {
    id?: string;
    reference?: string;
    purpose?: string;
    pickup_at?: string;
    passenger_count?: number;
    requester_name?: string;
    requester_phone?: string;
    request_route_points?: {
      name: string;
      address?: string | null;
      point_type: string;
      sequence?: number;
    }[];
  } | null;
};

export function useFleetTrips(status: "completed" | "active" | "cancelled" | "all" = "completed") {
  return useQuery({
    queryKey: ["fleet-trips", status],
    refetchInterval: status === "active" ? 20_000 : false,
    queryFn: () => apiGet<FleetTripRow[]>(`/api/trips?status=${status}&limit=150`),
  });
}

function useInvalidateFleet() {
  const qc = useQueryClient();
  return () => {
    for (const key of [
      "requests",
      "request",
      "recommendations",
      "vehicles",
      "vehicle",
      "drivers",
      "driver",
      "active-trips",
      "fleet-trips",
      "driver-trips",
      "vehicle-trips",
      "notifications",
      "unavailability",
      "trip-history",
      "trip-location",
      "audit",
      "roster",
    ]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useAssignRequest() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: (input: { requestId: string; vehicleId: string; driverId: string }) =>
      apiPost(`/api/requests/${input.requestId}/assign`, {
        vehicleId: input.vehicleId,
        driverId: input.driverId,
      }),
    onSuccess: invalidate,
  });
}

export function useAdvanceTrip() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: (input: { tripId: string; action: string; payload?: Record<string, unknown> }) =>
      apiPost(`/api/trips/${input.tripId}/advance`, { action: input.action, payload: input.payload }),
    onSuccess: invalidate,
  });
}

export type TripLocationPayload = {
  latitude: number | null;
  longitude: number | null;
  recorded_at: string | null;
  trail: { lat: number; lng: number; at: string }[];
};

export function useTripLocation(tripId?: string, enabled = true) {
  return useQuery({
    queryKey: ["trip-location", tripId],
    enabled: !!tripId && enabled,
    refetchInterval: 5_000,
    queryFn: () => apiGet<TripLocationPayload>(`/api/trips/${tripId}/location`),
  });
}

export function usePingTripLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { tripId: string; latitude: number; longitude: number }) =>
      apiPost(`/api/trips/${input.tripId}/location`, {
        latitude: input.latitude,
        longitude: input.longitude,
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["trip-location", vars.tripId] });
    },
  });
}

export function useDecideRequest() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: (input: { requestId: string; approve: boolean; reason?: string; actorId: string }) =>
      apiPost(`/api/requests/${input.requestId}/decide`, {
        approve: input.approve,
        reason: input.reason,
      }),
    onSuccess: invalidate,
  });
}

export function useCancelRequest() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: (requestId: string) => apiPost(`/api/requests/${requestId}/cancel`),
    onSuccess: invalidate,
  });
}

export function useReportVehicleIssue() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: (input: {
      vehicleId: string;
      driverId?: string | null;
      tripId?: string | null;
      reason: string;
      description: string;
      severity: string;
      actorId: string;
    }) =>
      apiPost("/api/unavailability", {
        vehicleId: input.vehicleId,
        driverId: input.driverId,
        tripId: input.tripId,
        reason: input.reason,
        description: input.description,
        severity: input.severity,
      }),
    onSuccess: invalidate,
  });
}

export function useReviewUnavailability() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: (input: {
      id: string;
      vehicleId: string;
      decision: "approved_unavailable" | "sent_to_maintenance" | "rejected" | "resolved";
      note?: string;
      actorId: string;
    }) =>
      apiPost(`/api/unavailability/${input.id}/review`, {
        decision: input.decision,
        note: input.note,
        vehicleId: input.vehicleId,
      }),
    onSuccess: invalidate,
  });
}

export interface NewRequestInput {
  requesterId: string;
  requesterName: string;
  requesterPhone: string;
  departmentId: string | null;
  costCenter: string;
  purpose: string;
  tripType: string;
  priority: string;
  requestedCategory: string | null;
  passengerCount: number;
  pickupAt: string;
  expectedEndAt: string;
  journeyDate?: string;
  isRoundTrip: boolean;
  returnPickupAt: string | null;
  returnExpectedEndAt: string | null;
  requiresAc: boolean;
  specialRequirements: string;
  remarks: string;
  points: {
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    point_type: string;
  }[];
  passengers: { full_name: string; phone: string; passenger_type: string }[];
}

export function useCreateRequest() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: (input: NewRequestInput) => apiPost<{ id: string; reference: string }>("/api/requests", input),
    onSuccess: invalidate,
  });
}

export type RosterEntry = {
  id: string;
  full_name: string;
  phone: string;
  role: "admin_hr" | "driver" | "employee";
  user_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RosterLookup = {
  allowed: boolean;
  reason?: "invalid_phone" | "not_on_roster" | "already_registered";
  full_name?: string;
  role?: RosterEntry["role"];
};

export function useRoster() {
  return useQuery({
    queryKey: ["roster"],
    queryFn: () => apiGet<RosterEntry[]>("/api/roster"),
  });
}

export function useLookupRosterPhone(phoneLocal: string, enabled: boolean) {
  return useQuery({
    queryKey: ["roster-lookup", phoneLocal],
    enabled: enabled && phoneLocal.length >= 10,
    queryFn: () => apiGet<RosterLookup>(`/api/roster/lookup?phone=${encodeURIComponent(phoneLocal)}`),
    staleTime: 30_000,
  });
}

function useInvalidateRosterRelated() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["roster", "admin-employees", "admin-employee", "drivers", "driver"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useCreateRosterEntry() {
  const invalidate = useInvalidateRosterRelated();
  return useMutation({
    mutationFn: (input: {
      full_name: string;
      phone: string;
      role: RosterEntry["role"];
      notes?: string | null;
    }) => apiPost<RosterEntry>("/api/roster", input),
    onSuccess: invalidate,
  });
}

export function useUpdateRosterEntry() {
  const invalidate = useInvalidateRosterRelated();
  return useMutation({
    mutationFn: (input: { id: string; patch: Partial<Pick<RosterEntry, "role" | "full_name" | "notes">> }) =>
      apiPatch(`/api/roster/${input.id}`, input.patch),
    onSuccess: invalidate,
  });
}

export function useDeactivateRosterEntry() {
  const invalidate = useInvalidateRosterRelated();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/roster/${id}`),
    onSuccess: invalidate,
  });
}

export type AdminEmployee = {
  roster_id: string;
  roster_name: string;
  roster_phone: string;
  user_id: string | null;
  notes: string | null;
  roster_created_at: string;
  profile_id: string | null;
  profile_name: string | null;
  profile_phone: string | null;
  email: string | null;
  employee_code: string | null;
  department_id: string | null;
  department_name: string | null;
  department_code: string | null;
  request_count: number;
};

export function useAdminEmployees() {
  return useQuery({
    queryKey: ["admin-employees"],
    queryFn: () => apiGet<AdminEmployee[]>("/api/admin/employees"),
  });
}

export function useAdminEmployee(profileId: string) {
  return useQuery({
    queryKey: ["admin-employee", profileId],
    enabled: !!profileId,
    queryFn: () =>
      apiGet<{
        profile: UserProfile & { department_name?: string; department_code?: string };
        requests: {
          id: string;
          reference: string;
          purpose: string;
          status: string;
          pickup_at: string;
          passenger_count: number;
          request_route_points?: {
            name: string;
            point_type: string;
            sequence?: number;
          }[];
          vehicles?: { name?: string; registration_number?: string } | null;
          drivers?: { full_name?: string; phone?: string } | null;
        }[];
      }>(`/api/admin/employees/${profileId}`),
  });
}

export type UserProfile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  employee_code: string | null;
  department_id: string | null;
  department_name?: string | null;
  department_code?: string | null;
  created_at: string;
  updated_at: string;
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => apiGet<{ profile: UserProfile | null; roles: string[] }>("/api/profile"),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { full_name?: string; department_id?: string | null; phone?: string }) =>
      apiPatch<UserProfile>("/api/profile", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useLookupsQuery() {
  return useQuery({
    queryKey: ["lookups"],
    queryFn: () => apiGet<LookupsPayload>("/api/lookups"),
    staleTime: 60_000,
  });
}

export function useSaveLookupGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      groupKey: string;
      values: Array<Pick<LookupValue, "value_key" | "label" | "tone" | "sort_order" | "is_active">>;
    }) => apiPut(`/api/admin/lookups/${input.groupKey}`, { values: input.values }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["lookups"] }),
  });
}

export function useDeleteLookupValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { groupKey: string; valueKey: string }) =>
      apiDelete(`/api/admin/lookups/${input.groupKey}/${input.valueKey}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["lookups"] }),
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; code: string }) => apiPost("/api/admin/departments", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["departments"] }),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name?: string; code?: string }) =>
      apiPatch(`/api/admin/departments/${input.id}`, { name: input.name, code: input.code }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["departments"] }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/admin/departments/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["departments"] }),
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      address?: string;
      latitude?: number | null;
      longitude?: number | null;
      location_type?: string;
    }) => apiPost("/api/admin/locations", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["locations"] }),
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: Record<string, unknown> }) =>
      apiPatch(`/api/admin/locations/${input.id}`, input.patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["locations"] }),
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/admin/locations/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["locations"] }),
  });
}
