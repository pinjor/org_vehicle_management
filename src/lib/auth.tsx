import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./fleet";

interface AuthState {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  profile: { full_name: string; email: string | null; phone: string | null } | null;
  driverId: string | null;
  loading: boolean;
  isDispatcher: boolean;
  isDriver: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<AuthState["profile"]>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setRoles([]);
        setProfile(null);
        setDriverId(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    let cancelled = false;
    void (async () => {
      const [rolesRes, profileRes, driverRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("profiles").select("full_name, email, phone").eq("id", uid).maybeSingle(),
        supabase.from("drivers").select("id").eq("user_id", uid).maybeSingle(),
      ]);
      if (cancelled) return;
      setRoles((rolesRes.data ?? []).map((r) => r.role as AppRole));
      setProfile(profileRes.data ?? null);
      setDriverId(driverRes.data?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      roles,
      profile,
      driverId,
      loading,
      isDispatcher: roles.some((r) =>
        ["transport_admin", "fleet_manager", "system_admin"].includes(r),
      ),
      isDriver: roles.includes("driver"),
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, roles, profile, driverId, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}