import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  Bell,
  CalendarClock,
  Car,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Radar,
  Users,
  Wrench,
  Route as RouteIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { relativeTime } from "@/lib/fleet";

type NavItem = {
  to: "/dashboard" | "/requests" | "/requests/new" | "/dispatch" | "/fleet" | "/drivers" | "/maintenance" | "/my-trips";
  label: string;
  icon: typeof Car;
  roles: "all" | "dispatch" | "driver";
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: "all" },
  { to: "/requests", label: "Requests", icon: ClipboardList, roles: "all" },
  { to: "/requests/new", label: "New request", icon: RouteIcon, roles: "all" },
  { to: "/dispatch", label: "Dispatch", icon: Radar, roles: "dispatch" },
  { to: "/my-trips", label: "My trips", icon: CalendarClock, roles: "driver" },
  { to: "/fleet", label: "Fleet", icon: Car, roles: "dispatch" },
  { to: "/drivers", label: "Drivers", icon: Users, roles: "dispatch" },
  { to: "/maintenance", label: "Maintenance", icon: Wrench, roles: "dispatch" },
];

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { session, loading, profile, roles, isDispatcher, isDriver, signOut, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: notifications } = useNotifications(user?.id);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const items = NAV.filter(
    (n) => n.roles === "all" || (n.roles === "dispatch" && isDispatcher) || (n.roles === "driver" && isDriver),
  );
  const unread = (notifications ?? []).filter((n) => !n.is_read).length;

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your workspace…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Car className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-sidebar-accent-foreground">FleetOps</p>
            <p className="text-[11px] text-sidebar-foreground/70">Transport control</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {items.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
              {profile?.full_name ?? user?.email}
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/70">
              {roles.length ? roles.map((r) => r.replace(/_/g, " ")).join(" · ") : "employee"}
            </p>
          </div>
          <button
            onClick={() => void signOut()}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface/85 px-5 py-3 backdrop-blur">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="size-4" />
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <p className="border-b border-border px-3 py-2 text-sm font-semibold">Notifications</p>
                <div className="max-h-80 divide-y divide-border overflow-y-auto">
                  {(notifications ?? []).length === 0 && (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nothing new right now.</p>
                  )}
                  {(notifications ?? []).map((n) => (
                    <div key={n.id} className="px-3 py-2.5">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{relativeTime(n.created_at)}</p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 lg:hidden">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-1.5 text-xs whitespace-nowrap text-muted-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}