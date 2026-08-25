import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { query } from "./db";
import type { AppRole } from "@/lib/fleet";

const COOKIE = "fleetops_session";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "fleetops-dev-secret-change-me");

export type SessionUser = {
  id: string;
  phone: string | null;
  full_name: string;
  email: string | null;
  roles: AppRole[];
  driverId: string | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

async function signToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const { rows } = await query<{
    id: string;
    phone: string | null;
    full_name: string;
    email: string | null;
    driver_id: string | null;
  }>(
    `select p.id, p.phone, p.full_name, p.email, d.id as driver_id
     from profiles p
     left join drivers d on d.user_id = p.id
     where p.id = $1`,
    [userId],
  );
  const profile = rows[0];
  if (!profile) return null;

  const rolesRes = await query<{ role: AppRole }>(`select role from user_roles where user_id = $1`, [userId]);
  return {
    id: profile.id,
    phone: profile.phone,
    full_name: profile.full_name,
    email: profile.email,
    roles: rolesRes.rows.map((r) => r.role),
    driverId: profile.driver_id,
  };
}

export async function signupUser(phone: string, password: string) {
  const lookup = await query(`select public.lookup_roster_phone($1) as lookup_roster_phone`, [phone]);
  const info = lookup.rows[0]?.lookup_roster_phone as {
    allowed: boolean;
    reason?: string;
    full_name?: string;
    role?: string;
  };
  if (!info?.allowed) {
    if (info?.reason === "already_registered") throw new Error("An account already exists for this phone. Please sign in.");
    throw new Error("This phone number is not registered. Contact admin or HR.");
  }

  const passwordHash = await hashPassword(password);
  const userRes = await query<{ id: string }>(
    `insert into app_users (phone, password_hash) values ($1, $2) returning id`,
    [phone, passwordHash],
  );
  const userId = userRes.rows[0]!.id;
  const fullName = info.full_name ?? "User";

  await query(`insert into profiles (id, full_name, phone) values ($1, $2, $3)`, [userId, fullName, phone]);
  await query(`insert into user_roles (user_id, role) values ($1, 'employee') on conflict do nothing`, [userId]);

  if (info.role === "admin_hr") {
    await query(
      `insert into user_roles (user_id, role) values ($1, 'transport_admin'), ($1, 'system_admin') on conflict do nothing`,
      [userId],
    );
  } else if (info.role === "driver") {
    await query(`insert into user_roles (user_id, role) values ($1, 'driver') on conflict do nothing`, [userId]);
    await query(`update drivers set user_id = $1 where phone = $2 and user_id is null`, [userId, phone]);
  }

  await query(`update user_roster set user_id = $1, updated_at = now() where phone = $2`, [userId, phone]);

  const token = await signToken(userId);
  const user = await loadSessionUser(userId);
  return { token, user };
}

export async function loginUser(phone: string, password: string) {
  const { rows } = await query<{ id: string; password_hash: string }>(
    `select id, password_hash from app_users where phone = $1`,
    [phone],
  );
  const row = rows[0];
  if (!row) throw new Error("Invalid phone or password");
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) throw new Error("Invalid phone or password");
  const token = await signToken(row.id);
  const user = await loadSessionUser(row.id);
  if (!user) throw new Error("Profile not found");
  return { token, user };
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE, { path: "/" });
}

export async function getUserFromRequest(c: Context): Promise<SessionUser | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sub = payload.sub;
    if (!sub) return null;
    return loadSessionUser(sub);
  } catch {
    return null;
  }
}

export function requireUser(c: Context) {
  const user = c.get("user") as SessionUser | undefined;
  if (!user) throw new Error("Authentication required");
  return user;
}

export function isDispatcher(roles: AppRole[]) {
  return roles.some((r) => ["transport_admin", "fleet_manager", "system_admin"].includes(r));
}
