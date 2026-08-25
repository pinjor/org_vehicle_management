import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import type { AppRole } from "./fleet";

export type AuthUser = {
  id: string;
  phone: string | null;
  full_name: string;
  email: string | null;
  roles: AppRole[];
  driverId: string | null;
};

interface AuthState {
  user: { id: string } | null;
  session: { user: { id: string } } | null;
  roles: AppRole[];
  profile: { full_name: string; email: string | null; phone: string | null } | null;
  driverId: string | null;
  loading: boolean;
  isDispatcher: boolean;
  isDriver: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: next } = await apiGet<{ user: AuthUser | null }>("/api/auth/me");
      setUser(next);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo<AuthState>(() => {
    const roles = user?.roles ?? [];
    const profile = user
      ? { full_name: user.full_name, email: user.email, phone: user.phone }
      : null;
    const clientUser = user ? { id: user.id } : null;
    return {
      user: clientUser,
      session: clientUser ? { user: clientUser } : null,
      roles,
      profile,
      driverId: user?.driverId ?? null,
      loading,
      isDispatcher: roles.some((r) => ["transport_admin", "fleet_manager", "system_admin"].includes(r)),
      isAdmin: roles.some((r) => ["transport_admin", "system_admin"].includes(r)),
      isDriver: roles.includes("driver"),
      isEmployee:
        roles.includes("employee") &&
        !roles.some((r) => ["transport_admin", "system_admin", "driver"].includes(r)),
      signOut: async () => {
        await apiPost("/api/auth/logout");
        setUser(null);
      },
      refresh,
    };
  }, [user, loading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
