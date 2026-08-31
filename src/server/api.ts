import { Hono } from "hono";
import { query, pool } from "./db";
import {
  clearSessionCookie,
  getUserFromRequest,
  isDispatcher,
  loginUser,
  requireUser,
  setSessionCookie,
  signupUser,
  type SessionUser,
} from "./auth";
import { normalizeBdPhone } from "@/lib/phone";
import { CACHE_KEYS, cacheDel, withCache } from "./redis";

type Variables = { user?: SessionUser };

const app = new Hono<{ Variables: Variables }>();

const REQUEST_SELECT = `
  select vr.*,
    json_build_object('name', dep.name, 'code', dep.code) as departments,
    case when v.id is not null then json_build_object(
      'id', v.id, 'name', v.name, 'registration_number', v.registration_number,
      'category', v.category, 'seat_capacity', v.seat_capacity,
      'operational_status', v.operational_status, 'has_ac', v.has_ac
    ) end as vehicles,
    case when dr.id is not null then json_build_object(
      'id', dr.id, 'full_name', dr.full_name, 'phone', dr.phone,
      'current_status', dr.current_status, 'rating', dr.rating
    ) end as drivers,
    coalesce((
      select json_agg(t order by t.created_at)
      from trips t where t.request_id = vr.id
    ), '[]'::json) as trips
  from vehicle_requests vr
  left join departments dep on dep.id = vr.department_id
  left join vehicles v on v.id = vr.assigned_vehicle_id
  left join drivers dr on dr.id = vr.assigned_driver_id
`;

app.use("*", async (c, next) => {
  const user = await getUserFromRequest(c);
  if (user) c.set("user", user);
  await next();
});

app.onError((err, c) => {
  console.error(err);
  const msg = err instanceof Error ? err.message : "Request failed";
  const status = msg === "Authentication required" || msg === "Not authorised" ? 401 : 400;
  return c.json({ error: msg }, status);
});

function json<T>(c: { json: (data: T) => Response }, data: T) {
  return c.json(data);
}

// ——— Auth ———
app.post("/api/auth/signup", async (c) => {
  const { phone, password } = await c.req.json<{ phone: string; password: string }>();
  const normalized = normalizeBdPhone(phone);
  if (!normalized) return c.json({ error: "Invalid phone" }, 400);
  const { token, user } = await signupUser(normalized, password);
  setSessionCookie(c, token);
  return json(c, { user });
});

app.post("/api/auth/login", async (c) => {
  const { phone, password } = await c.req.json<{ phone: string; password: string }>();
  const normalized = normalizeBdPhone(phone);
  if (!normalized) return c.json({ error: "Invalid phone" }, 400);
  const { token, user } = await loginUser(normalized, password);
  setSessionCookie(c, token);
  return json(c, { user });
});

app.post("/api/auth/logout", (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

app.get("/api/auth/me", (c) => {
  const user = c.get("user");
  if (!user) return c.json({ user: null });
  return json(c, { user });
});

// ——— Profile ———
app.get("/api/profile", async (c) => {
  const user = requireUser(c);
  const { rows } = await query(
    `select p.*, d.name as department_name, d.code as department_code
     from profiles p
     left join departments d on d.id = p.department_id
     where p.id = $1`,
    [user.id],
  );
  return json(c, { profile: rows[0] ?? null, roles: user.roles });
});

app.patch("/api/profile", async (c) => {
  const user = requireUser(c);
  const body = await c.req.json<{ full_name?: string; department_id?: string | null; phone?: string }>();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (body.full_name !== undefined) {
    vals.push(body.full_name);
    sets.push(`full_name = $${vals.length}`);
  }
  if (body.department_id !== undefined) {
    vals.push(body.department_id);
    sets.push(`department_id = $${vals.length}`);
  }
  if (body.phone !== undefined && body.phone) {
    const { normalizeBdPhone } = await import("@/lib/phone");
    const normalized = normalizeBdPhone(body.phone);
    if (!normalized) throw new Error("Invalid phone number");
    vals.push(normalized);
    sets.push(`phone = $${vals.length}`);
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(user.id);
  sets.push("updated_at = now()");
  const { rows } = await query(
    `update profiles set ${sets.join(", ")} where id = $${vals.length} returning *`,
    vals,
  );
  return json(c, rows[0]);
});

// ——— Roster ———
app.get("/api/roster/lookup", async (c) => {
  const phone = c.req.query("phone") ?? "";
  const { rows } = await query<{ lookup_roster_phone: unknown }>(
    `select public.lookup_roster_phone($1) as lookup_roster_phone`,
    [phone],
  );
  return json(c, rows[0]?.lookup_roster_phone ?? { allowed: false });
});

app.get("/api/roster", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  const { rows } = await query(`select * from user_roster where is_active = true order by full_name`);
  return json(c, rows);
});

app.post("/api/roster", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  const body = await c.req.json<{ full_name: string; phone: string; role: string; notes?: string }>();
  const phone = normalizeBdPhone(body.phone) ?? body.phone;
  const { rows } = await query(
    `insert into user_roster (full_name, phone, role, notes) values ($1, $2, $3, $4) returning *`,
    [body.full_name, phone, body.role, body.notes ?? null],
  );
  const entry = rows[0] as {
    id: string;
    full_name: string;
    phone: string;
    role: string;
    user_id: string | null;
  };
  await syncRosterRoleSideEffects({
    phone: entry.phone,
    full_name: entry.full_name,
    user_id: entry.user_id,
    newRole: entry.role,
    oldRole: null,
  });
  return json(c, entry);
});

app.patch("/api/roster/:id", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  const id = c.req.param("id");
  const patch = await c.req.json<Record<string, unknown>>();
  const { rows: beforeRows } = await query<{
    id: string;
    full_name: string;
    phone: string;
    role: string;
    user_id: string | null;
  }>(`select id, full_name, phone, role, user_id from user_roster where id = $1`, [id]);
  const before = beforeRows[0];
  if (!before) return c.json({ error: "Not found" }, 404);

  const allowed = ["role", "full_name", "notes"] as const;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const key of allowed) {
    if (key in patch) {
      vals.push(patch[key]);
      sets.push(`${key} = $${vals.length}`);
    }
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(id);
  await query(`update user_roster set ${sets.join(", ")}, updated_at = now() where id = $${vals.length}`, vals);

  const { rows: afterRows } = await query<{
    id: string;
    full_name: string;
    phone: string;
    role: string;
    user_id: string | null;
  }>(`select id, full_name, phone, role, user_id from user_roster where id = $1`, [id]);
  const after = afterRows[0]!;

  await syncRosterRoleSideEffects({
    phone: after.phone,
    full_name: after.full_name,
    user_id: after.user_id,
    newRole: after.role,
    oldRole: before.role,
  });

  return c.json({ ok: true });
});

/** Keep drivers table + user_roles aligned when roster role changes. */
async function syncRosterRoleSideEffects(input: {
  phone: string;
  full_name: string;
  user_id: string | null;
  newRole: string;
  oldRole: string | null;
}) {
  const roleChanged = input.oldRole !== input.newRole;

  if (input.newRole === "driver") {
    await ensureDriverRecord(input.phone, input.full_name, input.user_id);
  } else if (roleChanged && input.oldRole === "driver") {
    await removeUnusedDriverStub(input.phone);
  }

  if (input.user_id && (roleChanged || input.oldRole === null)) {
    await syncAppRolesFromRoster(input.user_id, input.newRole);
  }
}

async function ensureDriverRecord(phone: string, fullName: string, userId: string | null) {
  const { rows: existing } = await query<{ id: string }>(
    `select id from drivers where phone = $1 order by created_at asc limit 1`,
    [phone],
  );
  if (existing[0]) {
    await query(
      `update drivers
       set full_name = $1,
           user_id = coalesce(user_id, $2::uuid),
           updated_at = now()
       where id = $3`,
      [fullName, userId, existing[0].id],
    );
    return;
  }

  const digits = phone.replace(/\D/g, "");
  const base = `D${digits.slice(-8) || Date.now().toString().slice(-8)}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = attempt === 0 ? base : `${base}-${attempt}`;
    try {
      await query(
        `insert into drivers (full_name, driver_code, phone, license_number, user_id)
         values ($1, $2, $3, '', $4)`,
        [fullName, code, phone, userId],
      );
      return;
    } catch {
      /* unique driver_code collision — retry */
    }
  }
  throw new Error("Could not create driver record for roster role");
}

async function removeUnusedDriverStub(phone: string) {
  await query(
    `delete from drivers d
     where d.phone = $1
       and not exists (select 1 from trips t where t.driver_id = d.id)
       and not exists (select 1 from vehicle_requests vr where vr.assigned_driver_id = d.id)
       and coalesce(nullif(trim(d.license_number), ''), '') = ''`,
    [phone],
  );
}

async function syncAppRolesFromRoster(userId: string, rosterRole: string) {
  await query(`insert into user_roles (user_id, role) values ($1, 'employee') on conflict do nothing`, [userId]);

  if (rosterRole === "driver") {
    await query(`insert into user_roles (user_id, role) values ($1, 'driver') on conflict do nothing`, [userId]);
    await query(
      `delete from user_roles where user_id = $1 and role in ('transport_admin', 'fleet_manager', 'system_admin')`,
      [userId],
    );
  } else if (rosterRole === "admin_hr") {
    await query(
      `insert into user_roles (user_id, role) values ($1, 'transport_admin'), ($1, 'system_admin') on conflict do nothing`,
      [userId],
    );
    await query(`delete from user_roles where user_id = $1 and role = 'driver'`, [userId]);
  } else {
    await query(
      `delete from user_roles
       where user_id = $1 and role in ('driver', 'transport_admin', 'fleet_manager', 'system_admin')`,
      [userId],
    );
  }
}

app.delete("/api/roster/:id", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  await query(`update user_roster set is_active = false, updated_at = now() where id = $1`, [c.req.param("id")]);
  return c.json({ ok: true });
});

// ——— Admin employees ———
app.get("/api/admin/employees", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  const { rows } = await query(
    `select
      r.id as roster_id,
      r.full_name as roster_name,
      r.phone as roster_phone,
      r.user_id,
      r.notes,
      r.created_at as roster_created_at,
      p.id as profile_id,
      p.full_name as profile_name,
      p.phone as profile_phone,
      p.email,
      p.employee_code,
      p.department_id,
      d.name as department_name,
      d.code as department_code,
      coalesce((
        select count(*)::int from vehicle_requests vr where vr.requester_id = p.id
      ), 0) as request_count
    from user_roster r
    left join profiles p on p.id = r.user_id
    left join departments d on d.id = p.department_id
    where r.role = 'employee' and r.is_active = true
    order by coalesce(p.full_name, r.full_name)`,
  );
  return json(c, rows);
});

app.get("/api/admin/employees/:id", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  const id = c.req.param("id");
  const { rows: profiles } = await query(
    `select p.*, d.name as department_name, d.code as department_code
     from profiles p
     left join departments d on d.id = p.department_id
     where p.id = $1
       and exists (select 1 from user_roles ur where ur.user_id = p.id and ur.role = 'employee')`,
    [id],
  );
  if (!profiles[0]) return c.json({ error: "Not found" }, 404);
  const { rows: requests } = await query(
    `select id, reference, purpose, status, pickup_at, passenger_count
     from vehicle_requests where requester_id = $1
     order by pickup_at desc nulls last limit 12`,
    [id],
  );
  return json(c, { profile: profiles[0], requests });
});

// ——— Requests ———
app.get("/api/requests", async (c) => {
  requireUser(c);
  const status = c.req.queries("status");
  const requesterId = c.req.query("requesterId");
  let sql = `${REQUEST_SELECT} where 1=1`;
  const params: unknown[] = [];
  if (status?.length) {
    params.push(status);
    sql += ` and vr.status = any($${params.length}::text[])`;
  }
  if (requesterId) {
    params.push(requesterId);
    sql += ` and vr.requester_id = $${params.length}`;
  }
  sql += ` order by vr.pickup_at asc`;
  const { rows } = await query(sql, params);
  return json(c, rows);
});

app.get("/api/requests/:id", async (c) => {
  requireUser(c);
  const id = c.req.param("id");
  const { rows } = await query(`${REQUEST_SELECT} where vr.id = $1`, [id]);
  const request = rows[0];
  if (!request) return c.json({ error: "Not found" }, 404);
  const [points, passengers] = await Promise.all([
    query(`select * from request_route_points where request_id = $1 order by sequence`, [id]),
    query(`select * from request_passengers where request_id = $1`, [id]),
  ]);
  return json(c, { request, points: points.rows, passengers: passengers.rows });
});

app.post("/api/requests", async (c) => {
  const user = requireUser(c);
  const input = await c.req.json<Record<string, unknown>>();
  const { rows } = await query<{ id: string; reference: string }>(
    `insert into vehicle_requests (
      requester_id, requester_name, requester_phone, department_id, cost_center, purpose,
      trip_type, priority, requested_category, passenger_count, journey_date, pickup_at,
      expected_end_at, is_round_trip, return_pickup_at, return_expected_end_at,
      requires_ac, special_requirements, remarks, status
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'submitted')
    returning id, reference`,
    [
      input.requesterId ?? user.id,
      input.requesterName,
      input.requesterPhone,
      input.departmentId,
      input.costCenter,
      input.purpose,
      input.tripType,
      input.priority,
      input.requestedCategory,
      input.passengerCount,
      String(input.pickupAt).slice(0, 10),
      new Date(String(input.pickupAt)).toISOString(),
      new Date(String(input.expectedEndAt)).toISOString(),
      input.isRoundTrip,
      input.returnPickupAt ? new Date(String(input.returnPickupAt)).toISOString() : null,
      input.returnExpectedEndAt ? new Date(String(input.returnExpectedEndAt)).toISOString() : null,
      input.requiresAc,
      input.specialRequirements,
      input.remarks,
    ],
  );
  const data = rows[0]!;
  const points = (input.points as { name: string; address: string; latitude: number | null; longitude: number | null; point_type: string }[]) ?? [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    await query(
      `insert into request_route_points (request_id, leg, sequence, point_type, name, address, latitude, longitude)
       values ($1,'outbound',$2,$3,$4,$5,$6,$7)`,
      [data.id, i + 1, p.point_type, p.name, p.address, p.latitude, p.longitude],
    );
  }
  const passengers = (input.passengers as { full_name: string; phone: string; passenger_type: string }[]) ?? [];
  for (let i = 0; i < passengers.length; i++) {
    const p = passengers[i]!;
    await query(
      `insert into request_passengers (request_id, full_name, phone, passenger_type, is_primary) values ($1,$2,$3,$4,$5)`,
      [data.id, p.full_name, p.phone, p.passenger_type, i === 0],
    );
  }
  await query(
    `insert into notifications (audience_role, category, title, body, link) values ($1,'request',$2,$3,'/dispatch')`,
    [
      "transport_admin",
      `New vehicle request ${data.reference}`,
      `${input.requesterName} · ${input.passengerCount} passengers · ${
        input.tripType === "round_trip" ? "Round trip" : input.tripType === "multi_stop" ? "Multi-stop" : "One-way"
      }`,
    ],
  );
  return json(c, data);
});

app.post("/api/requests/:id/decide", async (c) => {
  const user = requireUser(c);
  const id = c.req.param("id");
  const { approve, reason } = await c.req.json<{ approve: boolean; reason?: string }>();
  if (approve) {
    await query(
      `update vehicle_requests set status = 'approved', approved_by = $1, approved_at = now() where id = $2`,
      [user.id, id],
    );
  } else {
    await query(`update vehicle_requests set status = 'rejected', rejection_reason = $1 where id = $2`, [
      reason ?? "Not approved",
      id,
    ]);
  }
  await query(
    `insert into audit_logs (entity_type, entity_id, action, new_value, actor_id) values ('vehicle_request',$1,$2,$3,$4)`,
    [id, approve ? "approve" : "reject", JSON.stringify({ reason: reason ?? null }), user.id],
  );
  return c.json({ ok: true });
});

app.post("/api/requests/:id/cancel", async (c) => {
  requireUser(c);
  await query(`update vehicle_requests set status = 'cancelled' where id = $1`, [c.req.param("id")]);
  return c.json({ ok: true });
});

app.post("/api/requests/:id/assign", async (c) => {
  const user = requireUser(c);
  const { vehicleId, driverId } = await c.req.json<{ vehicleId: string; driverId: string }>();
  const { rows } = await query<{ assign_request: unknown }>(
    `select public.assign_request($1, $2, $3, $4) as assign_request`,
    [c.req.param("id"), vehicleId, driverId, user.id],
  );
  return json(c, rows[0]?.assign_request);
});

app.get("/api/requests/:id/recommendations", async (c) => {
  requireUser(c);
  const { rows } = await query<{ get_recommendations: unknown }>(
    `select public.get_recommendations($1) as get_recommendations`,
    [c.req.param("id")],
  );
  return json(c, rows[0]?.get_recommendations ?? []);
});

// ——— Trips ———
app.get("/api/trips", async (c) => {
  const user = requireUser(c);
  if (!isDispatcher(user.roles)) throw new Error("Not authorised");
  const status = c.req.query("status") ?? "completed";
  const limit = Math.min(Number(c.req.query("limit") ?? 100) || 100, 300);

  let whereSql = "t.status = 'completed'";
  if (status === "all") whereSql = "true";
  else if (status === "active") whereSql = "t.status not in ('completed','cancelled')";
  else if (status === "cancelled") whereSql = "t.status = 'cancelled'";
  else if (status === "completed") whereSql = "t.status = 'completed'";

  const { rows } = await query(
    `
    select t.id, t.reference, t.status, t.created_at, t.completed_at, t.request_id,
      json_build_object('name', v.name, 'registration_number', v.registration_number) as vehicles,
      json_build_object('full_name', d.full_name, 'phone', d.phone) as drivers,
      json_build_object(
        'id', vr.id, 'reference', vr.reference, 'purpose', vr.purpose,
        'pickup_at', vr.pickup_at, 'requester_name', vr.requester_name
      ) as vehicle_requests
    from trips t
    join vehicles v on v.id = t.vehicle_id
    join drivers d on d.id = t.driver_id
    join vehicle_requests vr on vr.id = t.request_id
    where ${whereSql}
    order by coalesce(t.completed_at, t.created_at) desc
    limit $1
  `,
    [limit],
  );
  return json(c, rows);
});

app.get("/api/trips/active", async (c) => {
  requireUser(c);
  const { rows } = await query(`
    select t.*,
      json_build_object('name', v.name, 'registration_number', v.registration_number) as vehicles,
      json_build_object('full_name', d.full_name, 'phone', d.phone) as drivers,
      row_to_json(vr.*) as vehicle_requests
    from trips t
    join vehicles v on v.id = t.vehicle_id
    join drivers d on d.id = t.driver_id
    join vehicle_requests vr on vr.id = t.request_id
    where t.status not in ('completed','cancelled')
    order by t.created_at desc
  `);
  return json(c, rows);
});

app.get("/api/trips/driver/:driverId", async (c) => {
  requireUser(c);
  const driverId = c.req.param("driverId");
  const { rows } = await query(`
    select t.*,
      json_build_object('name', v.name, 'registration_number', v.registration_number, 'seat_capacity', v.seat_capacity) as vehicles,
      (
        select row_to_json(rq) from (
          select vr.*,
            coalesce((select json_agg(rp order by rp.sequence) from request_route_points rp where rp.request_id = vr.id), '[]') as request_route_points,
            coalesce((select json_agg(rpass) from request_passengers rpass where rpass.request_id = vr.id), '[]') as request_passengers
          from vehicle_requests vr where vr.id = t.request_id
        ) rq
      ) as vehicle_requests
    from trips t
    join vehicles v on v.id = t.vehicle_id
    where t.driver_id = $1
    order by t.created_at desc
  `, [driverId]);
  return json(c, rows);
});

app.get("/api/trips/vehicle/:vehicleId", async (c) => {
  requireUser(c);
  const vehicleId = c.req.param("vehicleId");
  const { rows } = await query(
    `
    select t.*,
      json_build_object('full_name', d.full_name, 'phone', d.phone, 'driver_code', d.driver_code) as drivers,
      (
        select row_to_json(rq) from (
          select vr.id, vr.reference, vr.purpose, vr.pickup_at
          from vehicle_requests vr where vr.id = t.request_id
        ) rq
      ) as vehicle_requests
    from trips t
    join drivers d on d.id = t.driver_id
    where t.vehicle_id = $1
    order by t.created_at desc
  `,
    [vehicleId],
  );
  return json(c, rows);
});

app.post("/api/trips/:id/advance", async (c) => {
  const user = requireUser(c);
  const { action, payload } = await c.req.json<{ action: string; payload?: Record<string, unknown> }>();
  const { rows } = await query<{ advance_trip: unknown }>(
    `select public.advance_trip($1, $2, $3, $4::jsonb) as advance_trip`,
    [c.req.param("id"), action, user.id, JSON.stringify(payload ?? {})],
  );
  return json(c, rows[0]?.advance_trip);
});

app.post("/api/trips/:id/location", async (c) => {
  const user = requireUser(c);
  const tripId = c.req.param("id");
  const body = await c.req.json<{ latitude: number; longitude: number }>();
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return c.json({ error: "Invalid coordinates" }, 400);
  }

  const { rows: tripRows } = await query<{
    id: string;
    vehicle_id: string;
    driver_user_id: string | null;
    status: string;
  }>(
    `select t.id, t.vehicle_id, t.status, d.user_id as driver_user_id
     from trips t
     join drivers d on d.id = t.driver_id
     where t.id = $1`,
    [tripId],
  );
  const trip = tripRows[0];
  if (!trip) return c.json({ error: "Trip not found" }, 404);
  if (["completed", "cancelled"].includes(trip.status)) {
    return c.json({ error: "Trip is not active" }, 400);
  }
  const allowed = trip.driver_user_id === user.id || isDispatcher(user.roles);
  if (!allowed) return c.json({ error: "Not authorised" }, 403);

  const { rows: recent } = await query<{ recorded_at: string }>(
    `select recorded_at from trip_location_pings
     where trip_id = $1 order by recorded_at desc limit 1`,
    [tripId],
  );
  const lastAt = recent[0]?.recorded_at ? new Date(recent[0].recorded_at).getTime() : 0;
  if (lastAt && Date.now() - lastAt < 3000) {
    return json(c, { ok: true, throttled: true });
  }

  await query(
    `update vehicles set current_latitude = $1, current_longitude = $2, updated_at = now() where id = $3`,
    [lat, lng, trip.vehicle_id],
  );
  await query(
    `insert into trip_location_pings (trip_id, latitude, longitude) values ($1, $2, $3)`,
    [tripId, lat, lng],
  );

  return json(c, { ok: true, latitude: lat, longitude: lng });
});

app.get("/api/trips/:id/location", async (c) => {
  const user = requireUser(c);
  const tripId = c.req.param("id");

  const { rows: tripRows } = await query<{
    id: string;
    status: string;
    vehicle_id: string;
    requester_id: string | null;
    driver_user_id: string | null;
    current_latitude: number | null;
    current_longitude: number | null;
  }>(
    `select t.id, t.status, t.vehicle_id, vr.requester_id, d.user_id as driver_user_id,
            v.current_latitude, v.current_longitude
     from trips t
     join vehicle_requests vr on vr.id = t.request_id
     join drivers d on d.id = t.driver_id
     join vehicles v on v.id = t.vehicle_id
     where t.id = $1`,
    [tripId],
  );
  const trip = tripRows[0];
  if (!trip) return c.json({ error: "Trip not found" }, 404);

  const allowed =
    isDispatcher(user.roles) ||
    trip.requester_id === user.id ||
    trip.driver_user_id === user.id;
  if (!allowed) return c.json({ error: "Not authorised" }, 403);

  const { rows: trail } = await query<{
    latitude: number;
    longitude: number;
    recorded_at: string;
  }>(
    `select latitude, longitude, recorded_at
     from trip_location_pings
     where trip_id = $1
     order by recorded_at desc
     limit 50`,
    [tripId],
  );

  const latest = trail[0];
  return json(c, {
    latitude: latest?.latitude ?? trip.current_latitude,
    longitude: latest?.longitude ?? trip.current_longitude,
    recorded_at: latest?.recorded_at ?? null,
    trail: [...trail].reverse().map((p) => ({
      lat: Number(p.latitude),
      lng: Number(p.longitude),
      at: p.recorded_at,
    })),
  });
});

app.get("/api/trips/:id/history", async (c) => {
  requireUser(c);
  const { rows } = await query(
    `select * from trip_status_history where trip_id = $1 order by created_at`,
    [c.req.param("id")],
  );
  return json(c, rows);
});

// ——— Fleet ———
app.get("/api/vehicles", async (c) => {
  requireUser(c);
  const { rows } = await query(`
    select v.*,
      d.id as primary_driver_id,
      d.full_name as primary_driver_name,
      d.driver_code as primary_driver_code,
      d.phone as primary_driver_phone
    from vehicles v
    left join drivers d on d.id = v.primary_driver_id
    order by v.fleet_number
  `);
  return json(c, rows);
});

app.get("/api/vehicles/:id", async (c) => {
  requireUser(c);
  const { rows } = await query(
    `select v.*,
      d.full_name as primary_driver_name,
      d.driver_code as primary_driver_code,
      d.phone as primary_driver_phone
     from vehicles v
     left join drivers d on d.id = v.primary_driver_id
     where v.id = $1`,
    [c.req.param("id")],
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  return json(c, rows[0]);
});

app.patch("/api/vehicles/:id", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  const patch = await c.req.json<Record<string, unknown>>();
  const vehicleId = c.req.param("id");

  const client = await pool.connect();
  try {
    await client.query("begin");
    if ("primary_driver_id" in patch) {
      const driverId = patch.primary_driver_id ? String(patch.primary_driver_id) : null;
      if (driverId) {
        await client.query(
          `update vehicles set primary_driver_id = null where primary_driver_id = $1 and id <> $2`,
          [driverId, vehicleId],
        );
      }
    }
    const keys = Object.keys(patch);
    const sets = keys.map((k, i) => `${k} = $${i + 1}`);
    const vals = [...Object.values(patch), vehicleId];
    const { rows } = await client.query(
      `update vehicles set ${sets.join(", ")} where id = $${vals.length} returning *`,
      vals,
    );
    const vehicle = rows[0] as { id: string; category: string; primary_driver_id: string | null };
    // Driver category follows linked vehicle category
    if (vehicle.primary_driver_id) {
      await client.query(`update drivers set allowed_categories = ARRAY[$1]::text[] where id = $2`, [
        vehicle.category,
        vehicle.primary_driver_id,
      ]);
    }
    await client.query("commit");
    return json(c, vehicle);
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
});

app.post("/api/vehicles", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  const body = await c.req.json<{
    registration_number: string;
    fleet_number: string;
    name: string;
    category: string;
    brand?: string;
    model?: string;
    model_year?: number | null;
    color?: string | null;
    seat_capacity: number;
    luggage_capacity?: number;
    fuel_type?: string;
    transmission?: string;
    has_ac?: boolean;
    is_vip?: boolean;
    ownership?: string;
    branch?: string;
    primary_driver_id?: string | null;
    registration_expiry?: string | null;
    fitness_expiry?: string | null;
    insurance_expiry?: string | null;
    tax_token_expiry?: string | null;
    odometer_km?: number;
    last_service_km?: number;
    last_service_date?: string | null;
    service_interval_km?: number;
    last_repair_date?: string | null;
    last_repair_summary?: string | null;
    operational_status?: string;
    notes?: string | null;
  }>();
  const primaryDriverId = body.primary_driver_id ? String(body.primary_driver_id) : null;
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (primaryDriverId) {
      await client.query(`update vehicles set primary_driver_id = null where primary_driver_id = $1`, [
        primaryDriverId,
      ]);
    }
    const { rows } = await client.query(
      `insert into vehicles (
        registration_number, fleet_number, name, category, brand, model, model_year, color,
        seat_capacity, luggage_capacity, fuel_type, transmission, has_ac, is_vip, ownership, branch,
        primary_driver_id, registration_expiry, fitness_expiry, insurance_expiry, tax_token_expiry,
        odometer_km, last_service_km, last_service_date, service_interval_km,
        last_repair_date, last_repair_summary, operational_status, notes
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
        $22,$23,$24,$25,$26,$27,$28,$29
      ) returning *`,
      [
        body.registration_number.trim(),
        body.fleet_number.trim(),
        body.name.trim(),
        body.category,
        body.brand?.trim() ?? "",
        body.model?.trim() ?? "",
        body.model_year ?? null,
        body.color?.trim() || null,
        body.seat_capacity,
        body.luggage_capacity ?? 2,
        body.fuel_type ?? "petrol",
        body.transmission ?? "manual",
        body.has_ac ?? true,
        body.is_vip ?? false,
        body.ownership ?? "owned",
        body.branch?.trim() || "Head Office",
        primaryDriverId,
        body.registration_expiry || null,
        body.fitness_expiry || null,
        body.insurance_expiry || null,
        body.tax_token_expiry || null,
        body.odometer_km ?? 0,
        body.last_service_km ?? 0,
        body.last_service_date || null,
        body.service_interval_km ?? 10000,
        body.last_repair_date || null,
        body.last_repair_summary?.trim() || null,
        body.operational_status ?? "available",
        body.notes?.trim() || null,
      ],
    );
    if (primaryDriverId) {
      await client.query(`update drivers set allowed_categories = ARRAY[$1]::text[] where id = $2`, [
        body.category,
        primaryDriverId,
      ]);
    }
    await client.query("commit");
    return json(c, rows[0]);
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
});

app.get("/api/drivers", async (c) => {
  requireUser(c);
  const { rows } = await query(`
    select d.*,
      v.id as primary_vehicle_id,
      v.fleet_number as primary_vehicle_fleet,
      v.name as primary_vehicle_name,
      v.registration_number as primary_vehicle_reg,
      v.category as primary_vehicle_category
    from drivers d
    left join vehicles v on v.primary_driver_id = d.id
    order by d.driver_code
  `);
  return json(c, rows);
});

app.get("/api/drivers/:id", async (c) => {
  requireUser(c);
  const { rows } = await query(
    `select d.*,
      v.id as primary_vehicle_id,
      v.fleet_number as primary_vehicle_fleet,
      v.name as primary_vehicle_name,
      v.registration_number as primary_vehicle_reg,
      v.category as primary_vehicle_category
    from drivers d
    left join vehicles v on v.primary_driver_id = d.id
    where d.id = $1`,
    [c.req.param("id")],
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  return json(c, rows[0]);
});

app.patch("/api/drivers/:id", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  const patch = await c.req.json<Record<string, unknown>>();
  const driverId = c.req.param("id");
  const primaryVehicleId =
    "primary_vehicle_id" in patch
      ? patch.primary_vehicle_id
        ? String(patch.primary_vehicle_id)
        : null
      : undefined;
  // Categories come from primary vehicle — ignore client toggles
  const { primary_vehicle_id: _drop, allowed_categories: _cats, ...driverPatch } = patch;

  const client = await pool.connect();
  try {
    await client.query("begin");
    if (primaryVehicleId !== undefined) {
      await client.query(`update vehicles set primary_driver_id = null where primary_driver_id = $1`, [
        driverId,
      ]);
      if (primaryVehicleId) {
        await client.query(`update vehicles set primary_driver_id = $1 where id = $2`, [
          driverId,
          primaryVehicleId,
        ]);
        const { rows: veh } = await client.query<{ category: string }>(
          `select category from vehicles where id = $1`,
          [primaryVehicleId],
        );
        if (veh[0]?.category) {
          driverPatch.allowed_categories = [veh[0].category];
        }
      } else {
        driverPatch.allowed_categories = [];
      }
    }

    let row: Record<string, unknown> | undefined;
    const keys = Object.keys(driverPatch);
    if (keys.length > 0) {
      const sets = keys.map((k, i) => `${k} = $${i + 1}`);
      const vals = [...Object.values(driverPatch), driverId];
      const { rows } = await client.query(
        `update drivers set ${sets.join(", ")} where id = $${vals.length} returning *`,
        vals,
      );
      row = rows[0] as Record<string, unknown>;
    } else {
      const { rows } = await client.query(`select * from drivers where id = $1`, [driverId]);
      row = rows[0] as Record<string, unknown>;
    }

    const { rows: linked } = await client.query(
      `select id as primary_vehicle_id, fleet_number as primary_vehicle_fleet,
        name as primary_vehicle_name, registration_number as primary_vehicle_reg,
        category as primary_vehicle_category
       from vehicles where primary_driver_id = $1 limit 1`,
      [driverId],
    );
    await client.query("commit");
    return json(c, { ...row, ...(linked[0] ?? { primary_vehicle_id: null, primary_vehicle_category: null }) });
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
});

app.post("/api/drivers", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  const body = await c.req.json<{
    full_name: string;
    driver_code: string;
    phone: string;
    alternate_phone?: string | null;
    email?: string | null;
    license_number: string;
    license_type?: string;
    license_expiry?: string | null;
    shift?: string;
    experience_years?: number;
    blood_group?: string | null;
    emergency_contact?: string | null;
    address?: string | null;
    date_of_joining?: string | null;
    rating?: number;
    current_status?: string;
    primary_vehicle_id?: string | null;
  }>();
  const phone = normalizeBdPhone(body.phone);
  if (!phone) return c.json({ error: "Invalid phone number" }, 400);
  const altPhone = body.alternate_phone ? normalizeBdPhone(body.alternate_phone) : null;
  if (body.alternate_phone && !altPhone) return c.json({ error: "Invalid alternate phone" }, 400);

  const primaryVehicleId = body.primary_vehicle_id ? String(body.primary_vehicle_id) : null;
  const client = await pool.connect();
  try {
    await client.query("begin");
    let categories: string[] = [];
    if (primaryVehicleId) {
      const { rows: veh } = await client.query<{ category: string }>(
        `select category from vehicles where id = $1`,
        [primaryVehicleId],
      );
      if (veh[0]?.category) categories = [veh[0].category];
    }
    const { rows } = await client.query(
      `insert into drivers (
        full_name, driver_code, phone, alternate_phone, email, license_number, license_type,
        license_expiry, shift, allowed_categories, experience_years, blood_group, emergency_contact,
        address, date_of_joining, rating, current_status
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning *`,
      [
        body.full_name.trim(),
        body.driver_code.trim(),
        phone,
        altPhone,
        body.email?.trim() || null,
        body.license_number.trim(),
        body.license_type?.trim() || "Professional",
        body.license_expiry || null,
        body.shift ?? "day",
        categories,
        body.experience_years ?? 0,
        body.blood_group?.trim() || null,
        body.emergency_contact?.trim() || null,
        body.address?.trim() || null,
        body.date_of_joining || null,
        body.rating ?? 4.5,
        body.current_status ?? "available",
      ],
    );
    const driver = rows[0] as { id: string; full_name: string };
    if (primaryVehicleId) {
      await client.query(`update vehicles set primary_driver_id = null where primary_driver_id = $1`, [
        driver.id,
      ]);
      await client.query(`update vehicles set primary_driver_id = $1 where id = $2`, [
        driver.id,
        primaryVehicleId,
      ]);
    }
    await client.query(
      `insert into user_roster (full_name, phone, role) values ($1, $2, 'driver')
       on conflict (phone) do update set full_name = excluded.full_name, role = 'driver', is_active = true, updated_at = now()`,
      [body.full_name.trim(), phone],
    );
    await client.query("commit");
    return json(c, driver);
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
});

// ——— Reference data ———
app.get("/api/locations", async (c) => {
  requireUser(c);
  const rows = await withCache(CACHE_KEYS.locations, 120, async () => {
    const { rows: data } = await query(`select * from locations where is_active = true order by name`);
    return data;
  });
  return json(c, rows);
});

app.get("/api/departments", async (c) => {
  requireUser(c);
  const rows = await withCache(CACHE_KEYS.departments, 120, async () => {
    const { rows: data } = await query(`select * from departments order by name`);
    return data;
  });
  return json(c, rows);
});

// ——— Notifications ———
app.get("/api/notifications", async (c) => {
  const user = requireUser(c);
  const { rows } = await query(
    `select * from notifications
     where user_id = $1 or (audience_role is not null and exists (
       select 1 from user_roles ur where ur.user_id = $1 and ur.role = audience_role
     ))
     order by created_at desc limit 30`,
    [user.id],
  );
  return json(c, rows);
});

app.patch("/api/notifications/:id/read", async (c) => {
  const user = requireUser(c);
  await query(
    `update notifications set is_read = true
     where id = $1
       and is_read = false
       and (
         user_id = $2
         or (
           audience_role is not null
           and exists (
             select 1 from user_roles ur
             where ur.user_id = $2 and ur.role = audience_role
           )
         )
       )`,
    [c.req.param("id"), user.id],
  );
  return c.json({ ok: true });
});

app.post("/api/notifications/read-all", async (c) => {
  const user = requireUser(c);
  await query(
    `update notifications set is_read = true
     where is_read = false
       and (
         user_id = $1
         or (
           audience_role is not null
           and exists (
             select 1 from user_roles ur
             where ur.user_id = $1 and ur.role = audience_role
           )
         )
       )`,
    [user.id],
  );
  return c.json({ ok: true });
});

// ——— Maintenance ———
app.get("/api/unavailability", async (c) => {
  requireUser(c);
  const { rows } = await query(`
    select u.*,
      json_build_object('name', v.name, 'registration_number', v.registration_number) as vehicles,
      json_build_object('full_name', d.full_name) as drivers
    from vehicle_unavailability_requests u
    left join vehicles v on v.id = u.vehicle_id
    left join drivers d on d.id = u.driver_id
    order by u.created_at desc
  `);
  return json(c, rows);
});

app.post("/api/unavailability", async (c) => {
  const user = requireUser(c);
  const input = await c.req.json<Record<string, unknown>>();
  await query(
    `insert into vehicle_unavailability_requests (vehicle_id, driver_id, trip_id, reason, description, severity, created_by)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [input.vehicleId, input.driverId ?? null, input.tripId ?? null, input.reason, input.description, input.severity, user.id],
  );
  await query(
    `insert into notifications (audience_role, category, title, body, link)
     values ('transport_admin','maintenance','Vehicle unavailability requested',$1,'/maintenance')`,
    [input.description || "A driver reported a vehicle issue awaiting approval."],
  );
  return c.json({ ok: true });
});

app.post("/api/unavailability/:id/review", async (c) => {
  const user = requireUser(c);
  if (!isDispatcher(user.roles)) throw new Error("Not authorised");
  const { decision, note, vehicleId } = await c.req.json<{
    decision: string;
    note?: string;
    vehicleId: string;
  }>();
  await query(
    `update vehicle_unavailability_requests set status = $1, admin_note = $2, reviewed_by = $3, reviewed_at = now() where id = $4`,
    [decision, note ?? null, user.id, c.req.param("id")],
  );
  const nextVehicleStatus =
    decision === "approved_unavailable"
      ? "unavailable"
      : decision === "sent_to_maintenance"
        ? "under_maintenance"
        : decision === "resolved"
          ? "available"
          : null;
  if (nextVehicleStatus) {
    await query(`update vehicles set operational_status = $1 where id = $2`, [nextVehicleStatus, vehicleId]);
  }
  await query(
    `insert into audit_logs (entity_type, entity_id, action, new_value, actor_id) values ('vehicle',$1,$2,$3,$4)`,
    [vehicleId, `unavailability_${decision}`, JSON.stringify({ note: note ?? null }), user.id],
  );
  return c.json({ ok: true });
});

// ——— Audit ———
app.get("/api/audit/:entityId", async (c) => {
  requireUser(c);
  const { rows } = await query(
    `select * from audit_logs where entity_id = $1 order by created_at desc`,
    [c.req.param("entityId")],
  );
  return json(c, rows);
});

// ——— Dynamic lookups (settings) ———
async function loadLookupsPayload() {
  const { rows: groups } = await query<{
    key: string;
    label: string;
    description: string | null;
    sort_order: number;
  }>(`select key, label, description, sort_order from app_lookup_groups order by sort_order, label`);
  const { rows: values } = await query<{
    id: string;
    group_key: string;
    value_key: string;
    label: string;
    tone: string;
    sort_order: number;
    is_active: boolean;
  }>(
    `select id, group_key, value_key, label, tone, sort_order, is_active
     from app_lookup_values order by group_key, sort_order, label`,
  );
  return {
    groups: groups.map((g) => ({
      ...g,
      values: values.filter((v) => v.group_key === g.key),
    })),
  };
}

app.get("/api/lookups", async (c) => {
  requireUser(c);
  const payload = await withCache(CACHE_KEYS.lookups, 300, loadLookupsPayload);
  return json(c, payload);
});

app.put("/api/admin/lookups/:groupKey", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  const groupKey = c.req.param("groupKey");
  const body = await c.req.json<{
    values: Array<{
      value_key: string;
      label: string;
      tone: string;
      sort_order: number;
      is_active: boolean;
    }>;
  }>();
  const tones = new Set(["success", "warning", "danger", "info", "neutral", "primary"]);
  for (const v of body.values) {
    if (!tones.has(v.tone)) throw new Error(`Invalid tone: ${v.tone}`);
    await query(
      `insert into app_lookup_values (group_key, value_key, label, tone, sort_order, is_active)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (group_key, value_key) do update set
         label = excluded.label,
         tone = excluded.tone,
         sort_order = excluded.sort_order,
         is_active = excluded.is_active`,
      [groupKey, v.value_key, v.label, v.tone, v.sort_order, v.is_active],
    );
  }
  await cacheDel(CACHE_KEYS.lookups);
  return c.json({ ok: true });
});

app.delete("/api/admin/lookups/:groupKey/:valueKey", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  await query(`delete from app_lookup_values where group_key = $1 and value_key = $2`, [
    c.req.param("groupKey"),
    c.req.param("valueKey"),
  ]);
  await cacheDel(CACHE_KEYS.lookups);
  return c.json({ ok: true });
});

// ——— Admin reference data ———
app.post("/api/admin/departments", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  const { name, code } = await c.req.json<{ name: string; code: string }>();
  const { rows } = await query(
    `insert into departments (name, code) values ($1, $2) returning *`,
    [name.trim(), code.trim().toUpperCase()],
  );
  await cacheDel(CACHE_KEYS.departments);
  return json(c, rows[0]);
});

app.patch("/api/admin/departments/:id", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  const { name, code } = await c.req.json<{ name?: string; code?: string }>();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (name !== undefined) {
    vals.push(name.trim());
    sets.push(`name = $${vals.length}`);
  }
  if (code !== undefined) {
    vals.push(code.trim().toUpperCase());
    sets.push(`code = $${vals.length}`);
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(c.req.param("id"));
  const { rows } = await query(`update departments set ${sets.join(", ")} where id = $${vals.length} returning *`, vals);
  await cacheDel(CACHE_KEYS.departments);
  return json(c, rows[0]);
});

app.delete("/api/admin/departments/:id", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  await query(`delete from departments where id = $1`, [c.req.param("id")]);
  await cacheDel(CACHE_KEYS.departments);
  return c.json({ ok: true });
});

app.post("/api/admin/locations", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  const body = await c.req.json<{
    name: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
    location_type?: string;
  }>();
  const { rows } = await query(
    `insert into locations (name, address, latitude, longitude, location_type)
     values ($1, $2, $3, $4, $5) returning *`,
    [
      body.name.trim(),
      body.address?.trim() ?? "",
      body.latitude ?? null,
      body.longitude ?? null,
      body.location_type ?? "office",
    ],
  );
  await cacheDel(CACHE_KEYS.locations);
  return json(c, rows[0]);
});

app.patch("/api/admin/locations/:id", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  const body = await c.req.json<Record<string, unknown>>();
  const allowed = ["name", "address", "latitude", "longitude", "location_type", "is_active"] as const;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const key of allowed) {
    if (key in body) {
      vals.push(body[key]);
      sets.push(`${key} = $${vals.length}`);
    }
  }
  if (!sets.length) return c.json({ ok: true });
  vals.push(c.req.param("id"));
  const { rows } = await query(`update locations set ${sets.join(", ")} where id = $${vals.length} returning *`, vals);
  await cacheDel(CACHE_KEYS.locations);
  return json(c, rows[0]);
});

app.delete("/api/admin/locations/:id", async (c) => {
  requireUser(c);
  if (!isDispatcher(c.get("user")!.roles)) throw new Error("Not authorised");
  await query(`update locations set is_active = false where id = $1`, [c.req.param("id")]);
  await cacheDel(CACHE_KEYS.locations);
  return c.json({ ok: true });
});

export { app as apiApp };
