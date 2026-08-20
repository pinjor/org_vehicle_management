import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Recommendation } from "./fleet";

const REQUEST_SELECT =
  "*, departments(name, code), vehicles:assigned_vehicle_id(id, name, registration_number, category, seat_capacity, operational_status, has_ac), drivers:assigned_driver_id(id, full_name, phone, current_status, rating), trips(*)";

export type RequestRow = Awaited<ReturnType<typeof fetchRequests>>[number];

async function fetchRequests(filters?: { status?: string[]; requesterId?: string }) {
  let q = supabase.from("vehicle_requests").select(REQUEST_SELECT).order("pickup_at", { ascending: true });
  if (filters?.status?.length) q = q.in("status", filters.status);
  if (filters?.requesterId) q = q.eq("requester_id", filters.requesterId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
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
    queryFn: async () => {
      const [req, points, passengers] = await Promise.all([
        supabase.from("vehicle_requests").select(REQUEST_SELECT).eq("id", id).single(),
        supabase.from("request_route_points").select("*").eq("request_id", id).order("sequence"),
        supabase.from("request_passengers").select("*").eq("request_id", id),
      ]);
      if (req.error) throw req.error;
      return { request: req.data, points: points.data ?? [], passengers: passengers.data ?? [] };
    },
  });
}

export function useTripHistory(tripId?: string) {
  return useQuery({
    queryKey: ["trip-history", tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_status_history")
        .select("*")
        .eq("trip_id", tripId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAuditTrail(entityId?: string) {
  return useQuery({
    queryKey: ["audit", entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_id", entityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecommendations(requestId?: string, enabled = true) {
  return useQuery({
    queryKey: ["recommendations", requestId],
    enabled: !!requestId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_recommendations", { _request_id: requestId! });
      if (error) throw error;
      return (data ?? []) as unknown as Recommendation[];
    },
  });
}

export function useVehicles() {
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").order("fleet_number");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDrivers() {
  return useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*").order("driver_code");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUnavailabilityRequests() {
  return useQuery({
    queryKey: ["unavailability"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_unavailability_requests")
        .select("*, vehicles(name, registration_number), drivers(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNotifications(userId?: string) {
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDriverTrips(driverId?: string) {
  return useQuery({
    queryKey: ["driver-trips", driverId],
    enabled: !!driverId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select(
          "*, vehicles(name, registration_number, seat_capacity), vehicle_requests(*, request_route_points(*), request_passengers(*))",
        )
        .eq("driver_id", driverId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useActiveTrips() {
  return useQuery({
    queryKey: ["active-trips"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*, vehicles(name, registration_number), drivers(full_name, phone), vehicle_requests(*)")
        .not("status", "in", "(completed,cancelled)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
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
      "drivers",
      "active-trips",
      "driver-trips",
      "notifications",
      "unavailability",
      "trip-history",
      "audit",
    ]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useAssignRequest() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: async (input: { requestId: string; vehicleId: string; driverId: string }) => {
      const { data, error } = await supabase.rpc("assign_request", {
        _request_id: input.requestId,
        _vehicle_id: input.vehicleId,
        _driver_id: input.driverId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useAdvanceTrip() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: async (input: { tripId: string; action: string; payload?: Record<string, unknown> }) => {
      const { data, error } = await supabase.rpc("advance_trip", {
        _trip_id: input.tripId,
        _action: input.action,
        _payload: (input.payload ?? {}) as never,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useDecideRequest() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: async (input: { requestId: string; approve: boolean; reason?: string; actorId: string }) => {
      const { error } = await supabase
        .from("vehicle_requests")
        .update(
          input.approve
            ? { status: "approved", approved_by: input.actorId, approved_at: new Date().toISOString() }
            : { status: "rejected", rejection_reason: input.reason ?? "Not approved" },
        )
        .eq("id", input.requestId);
      if (error) throw new Error(error.message);
      await supabase.from("audit_logs").insert({
        entity_type: "vehicle_request",
        entity_id: input.requestId,
        action: input.approve ? "approve" : "reject",
        new_value: { reason: input.reason ?? null },
        actor_id: input.actorId,
      });
    },
    onSuccess: invalidate,
  });
}

export function useCancelRequest() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("vehicle_requests")
        .update({ status: "cancelled" })
        .eq("id", requestId);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
}

export function useReportVehicleIssue() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: async (input: {
      vehicleId: string;
      driverId?: string | null;
      tripId?: string | null;
      reason: string;
      description: string;
      severity: string;
      actorId: string;
    }) => {
      const { error } = await supabase.from("vehicle_unavailability_requests").insert({
        vehicle_id: input.vehicleId,
        driver_id: input.driverId ?? null,
        trip_id: input.tripId ?? null,
        reason: input.reason,
        description: input.description,
        severity: input.severity,
        created_by: input.actorId,
      });
      if (error) throw new Error(error.message);
      await supabase.from("notifications").insert({
        audience_role: "transport_admin",
        category: "maintenance",
        title: "Vehicle unavailability requested",
        body: input.description || "A driver reported a vehicle issue awaiting approval.",
        link: "/maintenance",
      });
    },
    onSuccess: invalidate,
  });
}

export function useReviewUnavailability() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      vehicleId: string;
      decision: "approved_unavailable" | "sent_to_maintenance" | "rejected" | "info_requested" | "resolved";
      note?: string;
      actorId: string;
    }) => {
      const { error } = await supabase
        .from("vehicle_unavailability_requests")
        .update({
          status: input.decision,
          admin_note: input.note ?? null,
          reviewed_by: input.actorId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw new Error(error.message);

      const nextVehicleStatus =
        input.decision === "approved_unavailable"
          ? "unavailable"
          : input.decision === "sent_to_maintenance"
            ? "under_maintenance"
            : input.decision === "resolved"
              ? "available"
              : null;
      if (nextVehicleStatus) {
        const { error: vErr } = await supabase
          .from("vehicles")
          .update({ operational_status: nextVehicleStatus })
          .eq("id", input.vehicleId);
        if (vErr) throw new Error(vErr.message);
      }
      await supabase.from("audit_logs").insert({
        entity_type: "vehicle",
        entity_id: input.vehicleId,
        action: `unavailability_${input.decision}`,
        new_value: { note: input.note ?? null },
        actor_id: input.actorId,
      });
    },
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
    mutationFn: async (input: NewRequestInput) => {
      const { data, error } = await supabase
        .from("vehicle_requests")
        .insert({
          requester_id: input.requesterId,
          requester_name: input.requesterName,
          requester_phone: input.requesterPhone,
          department_id: input.departmentId,
          cost_center: input.costCenter,
          purpose: input.purpose,
          trip_type: input.tripType,
          priority: input.priority,
          requested_category: input.requestedCategory,
          passenger_count: input.passengerCount,
          journey_date: input.pickupAt.slice(0, 10),
          pickup_at: new Date(input.pickupAt).toISOString(),
          expected_end_at: new Date(input.expectedEndAt).toISOString(),
          is_round_trip: input.isRoundTrip,
          return_pickup_at: input.returnPickupAt ? new Date(input.returnPickupAt).toISOString() : null,
          return_expected_end_at: input.returnExpectedEndAt
            ? new Date(input.returnExpectedEndAt).toISOString()
            : null,
          requires_ac: input.requiresAc,
          special_requirements: input.specialRequirements,
          remarks: input.remarks,
          status: "submitted",
        })
        .select("id, reference")
        .single();
      if (error) throw new Error(error.message);

      if (input.points.length) {
        const { error: pErr } = await supabase.from("request_route_points").insert(
          input.points.map((p, i) => ({
            request_id: data.id,
            leg: "outbound",
            sequence: i + 1,
            point_type: p.point_type,
            name: p.name,
            address: p.address,
            latitude: p.latitude,
            longitude: p.longitude,
          })),
        );
        if (pErr) throw new Error(pErr.message);
      }
      if (input.passengers.length) {
        await supabase.from("request_passengers").insert(
          input.passengers.map((p, i) => ({
            request_id: data.id,
            full_name: p.full_name,
            phone: p.phone,
            passenger_type: p.passenger_type,
            is_primary: i === 0,
          })),
        );
      }
      await supabase.from("notifications").insert({
        audience_role: "transport_admin",
        category: "request",
        title: `New vehicle request ${data.reference}`,
        body: `${input.requesterName} · ${input.passengerCount} passengers`,
        link: `/requests/${data.id}`,
      });
      await supabase.from("audit_logs").insert({
        entity_type: "vehicle_request",
        entity_id: data.id,
        action: "create",
        actor_id: input.requesterId,
        actor_name: input.requesterName,
      });
      return data;
    },
    onSuccess: invalidate,
  });
}