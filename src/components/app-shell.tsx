import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  Briefcase,
  CalendarClock,
  Car,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Radar,
  Settings2,
  Shield,
  User,
  Users,
  Wrench,
  Route as RouteIcon,
} from "lucide-react";
import { AdminRequestAlert } from "@/components/admin-request-alert";
import { WorkspaceSkeleton } from "@/components/loading-skeletons";
import { AppIcon } from "@/components/app-icon";
import { LanguageToggle } from "@/components/language-toggle";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/fleet";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBdPhone } from "@/lib/phone";

type AppNotification = {
  id: string;
  title: string;
  body: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
  category?: string | null;
};

type NavItem = {
  to:
    | "/dashboard"
    | "/requests"
    | "/requests/new"
    | "/dispatch"
    | "/fleet"
    | "/drivers"
    | "/maintenance"
    | "/my-trips"
    | "/trips"
    | "/profile"
    | "/admin/users"
    | "/admin/employees"
    | "/admin/settings";
  label: string;
  shortLabel?: string;
  labelKey?: MessageKey;
  shortLabelKey?: MessageKey;
  icon: typeof Car;
  roles: "all" | "dispatch" | "driver" | "admin" | "employee";
  section?: "main" | "ops" | "admin";
};

const NAV: NavItem[] = [
  {
    to: "/dashboard",
    label: "Home",
    shortLabel: "Home",
    labelKey: "nav.home",
    shortLabelKey: "nav.homeShort",
    icon: LayoutDashboard,
    roles: "all",
    section: "main",
  },
  { to: "/requests", label: "My rides", shortLabel: "Rides", icon: ClipboardList, roles: "employee", section: "main" },
  { to: "/requests/new", label: "Book", shortLabel: "Book", icon: RouteIcon, roles: "employee", section: "main" },
  { to: "/profile", label: "Account", shortLabel: "Account", icon: User, roles: "employee", section: "main" },
  {
    to: "/my-trips",
    label: "My trips",
    shortLabel: "Trips",
    labelKey: "nav.myTrips",
    shortLabelKey: "nav.tripsShort",
    icon: CalendarClock,
    roles: "driver",
    section: "main",
  },
  { to: "/dispatch", label: "Dispatch", icon: Radar, roles: "dispatch", section: "ops" },
  { to: "/trips", label: "Trips", shortLabel: "Trips", icon: CalendarClock, roles: "dispatch", section: "ops" },
  { to: "/fleet", label: "Fleet", icon: Car, roles: "dispatch", section: "ops" },
  { to: "/drivers", label: "Drivers", icon: Users, roles: "dispatch", section: "ops" },
  { to: "/maintenance", label: "Maintenance", shortLabel: "Maint.", icon: Wrench, roles: "dispatch", section: "ops" },
  { to: "/admin/users", label: "Users", shortLabel: "Users", icon: Shield, roles: "admin", section: "admin" },
  { to: "/admin/employees", label: "Employees", shortLabel: "Staff", icon: Briefcase, roles: "dispatch", section: "admin" },
  { to: "/admin/settings", label: "Settings", shortLabel: "Settings", icon: Settings2, roles: "dispatch", section: "admin" },
];

const SECTION_LABELS: Record<NonNullable<NavItem["section"]>, string> = {
  main: "Workspace",
  ops: "Operations",
  admin: "Administration",
};

/** Pick the single best-matching nav route (longest prefix wins). */
function resolveActiveNav(pathname: string, candidates: string[]) {
  const sorted = [...new Set(candidates)].sort((a, b) => b.length - a.length);
  for (const to of sorted) {
    if (pathname === to || pathname.startsWith(`${to}/`)) return to;
  }
  return null;
}

const SIDEBAR_COLLAPSED_KEY = "fleetops.sidebarCollapsed";

function SidebarNavLink({
  to,
  params,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  to: NavItem["to"] | "/drivers/$driverId";
  params?: { driverId: string };
  label: string;
  icon: typeof Car;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      to={to}
      {...(params ? { params } : {})}
      onClick={onNavigate}
      className={cn(
        "app-nav-link",
        active && "app-nav-link--active",
        collapsed && "app-nav-link--collapsed",
      )}
      title={collapsed ? label : undefined}
    >
      <span className="app-nav-icon" aria-hidden>
        <Icon />
      </span>
      {!collapsed && <span className="app-nav-label">{label}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarNavSections({
  items,
  collapsed,
  activeNav,
  onNavigate,
  resolveLabel,
}: {
  items: NavItem[];
  collapsed: boolean;
  activeNav: string | null;
  onNavigate?: () => void;
  resolveLabel: (item: NavItem) => string;
}) {
  const { t, isDriverPortal } = useI18n();
  const sections = ["main", "ops", "admin"] as const;

  return (
    <>
      {sections.map((section) => {
        const sectionItems = items.filter((item) => item.section === section);
        if (sectionItems.length === 0) return null;

        return (
          <div key={section} className="app-sidebar-section">
            {!collapsed && (
              <p className="app-sidebar-section-label">
                {section === "main" && isDriverPortal ? t("nav.workspace") : SECTION_LABELS[section]}
              </p>
            )}
            <div className="app-sidebar-section-links">
              {sectionItems.map((item) => (
                <SidebarNavLink
                  key={item.to}
                  to={item.to}
                  label={resolveLabel(item)}
                  icon={item.icon}
                  active={activeNav === item.to}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function bottomNavOrder(isDispatcher: boolean, isDriver: boolean, isAdmin: boolean, isEmployee: boolean): NavItem["to"][] {
  if (isAdmin) return ["/dashboard", "/admin/employees", "/dispatch", "/admin/settings"];
  if (isDispatcher) return ["/dashboard", "/dispatch", "/fleet", "/requests/new"];
  if (isDriver) return ["/dashboard", "/my-trips"];
  if (isEmployee) return ["/dashboard", "/requests", "/profile"];
  return ["/dashboard"];
}

export function AppShell({
  title,
  subtitle,
  actions,
  fillViewport,
  /** Show header back control. Prefer browser history; fall back to this path. */
  backTo,
  backLabel = "Back",
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Lock main content to viewport height on lg+ — inner panels scroll instead of the page. */
  fillViewport?: boolean;
  backTo?:
    | "/dashboard"
    | "/requests"
    | "/drivers"
    | "/fleet"
    | "/admin/employees"
    | "/my-trips"
    | "/trips"
    | "/dispatch"
    | "/admin/users"
    | "/admin/settings"
    | "/maintenance";
  backLabel?: string;
  children: ReactNode;
}) {
  const { session, loading, profile, roles, isDispatcher, isDriver, isAdmin, isEmployee, signOut, user, driverId } = useAuth();
  const { t, isDriverPortal } = useI18n();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const shellMainRef = useRef<HTMLDivElement>(null);
  const { data: notificationsRaw } = useNotifications(user?.id);
  const notifications = (notificationsRaw ?? []) as AppNotification[];
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const { pullDistance, refreshing, threshold } = usePullToRefresh(
    shellMainRef,
    async () => {
      await Promise.all([queryClient.invalidateQueries(), router.invalidate()]);
    },
  );

  const resolveLabel = (item: NavItem) =>
    isDriverPortal && item.labelKey ? t(item.labelKey) : item.label;
  const resolveShort = (item: NavItem) =>
    isDriverPortal && item.shortLabelKey
      ? t(item.shortLabelKey)
      : (item.shortLabel ?? item.label);
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (mq.matches) setMenuOpen(false);
    };
    closeOnDesktop();
    mq.addEventListener("change", closeOnDesktop);
    return () => mq.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const items = NAV.filter((n) => {
    if (n.roles === "all") return true;
    if (n.roles === "dispatch" && isDispatcher) return true;
    if (n.roles === "driver" && isDriver) return true;
    if (n.roles === "admin" && isAdmin) return true;
    if (n.roles === "employee" && (isEmployee || isDispatcher)) return true;
    return false;
  });

  const showHeaderRequests = isDispatcher;
  const sidebarItems = showHeaderRequests
    ? items.filter(
        (n) => n.to !== "/requests" && n.to !== "/requests/new" && n.to !== "/profile",
      )
    : items.filter((n) => !(isEmployee && !isDispatcher && n.to === "/requests/new"));

  const bottomKeys = useMemo(
    () => bottomNavOrder(isDispatcher, isDriver, isAdmin, isEmployee),
    [isDispatcher, isDriver, isAdmin, isEmployee],
  );
  const bottomItems = bottomKeys
    .map((key) => items.find((i) => i.to === key))
    .filter((i): i is NavItem => !!i);

  const navCandidates = useMemo(() => {
    const paths = sidebarItems.map((i) => i.to);
    if (showHeaderRequests) {
      paths.push("/requests", "/requests/new");
    }
    return paths;
  }, [sidebarItems, showHeaderRequests]);

  const activeNav = useMemo(() => resolveActiveNav(pathname, navCandidates), [pathname, navCandidates]);

  const unread = notifications.filter((n) => !n.is_read).length;
  const displayPhone = profile?.phone;
  /** Mobile portal (employee / driver): bottom nav only — no hamburger / sheet. Desktop keeps sidebar. */
  const hideMobileSidebar = (isEmployee || isDriver) && !isDispatcher && !isAdmin;
  const employeeRideChrome = isEmployee && !isDispatcher && !isAdmin;
  const isPlanRidePage = pathname === "/requests/new";
  /** Pages that draw their own top bar (plan-ride__top / driver trip). Admin request detail uses shell header. */
  const isSelfTitledRidePage =
    isPlanRidePage ||
    (employeeRideChrome && /^\/requests\/[^/]+$/.test(pathname)) ||
    /^\/my-trips\/[^/]+$/.test(pathname);
  const hideMobileShellHeader =
    isSelfTitledRidePage ||
    (employeeRideChrome && (pathname === "/dashboard" || pathname === "/"));

  if (loading) return <WorkspaceSkeleton />;
  if (!session) return null;

  return (
    <TooltipProvider delayDuration={0}>
    <div
      className={cn(
        "app-shell-root flex min-h-screen bg-background",
        hideMobileSidebar && "employee-portal",
        employeeRideChrome && "employee-portal--ride",
        hideMobileShellHeader && "app-shell--no-mobile-header",
        isSelfTitledRidePage && "app-shell--plan-ride",
      )}
    >
      {isDispatcher && <AdminRequestAlert />}

      <aside
        className={cn(
          "app-sidebar hidden shrink-0 flex-col lg:flex",
          sidebarCollapsed && "app-sidebar--collapsed",
        )}
      >
        <div className="app-sidebar-brand">
          <AppIcon className="app-sidebar-logo" />
          {!sidebarCollapsed && (
            <div className="app-sidebar-brand-text">
              <p className="truncate text-sm font-bold tracking-tight">FleetOps</p>
              <p className="truncate text-[11px] text-sidebar-foreground/55">
                {isDriverPortal ? t("shell.vehicleMgmt") : "FleetOps"}
              </p>
            </div>
          )}
        </div>

        <nav className="app-sidebar-nav">
          <SidebarNavSections
            items={sidebarItems}
            collapsed={sidebarCollapsed}
            activeNav={activeNav}
            resolveLabel={resolveLabel}
          />
        </nav>

        <div className="app-sidebar-footer">
          <button
            type="button"
            className="app-sidebar-footer-btn"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={
              sidebarCollapsed
                ? isDriverPortal
                  ? t("nav.expand")
                  : "Expand sidebar"
                : isDriverPortal
                  ? t("nav.collapse")
                  : "Collapse sidebar"
            }
            aria-expanded={!sidebarCollapsed}
          >
            <span className="app-sidebar-footer-btn__icon" aria-hidden>
              <PanelLeftClose className="size-4" />
            </span>
            <span className="app-sidebar-footer-btn__label">
              {isDriverPortal ? t("nav.collapse") : "Collapse"}
            </span>
          </button>
        </div>
      </aside>

      <div
        ref={shellMainRef}
        className={cn(
          "app-shell-main flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip",
          fillViewport && "lg:h-svh lg:max-h-svh lg:overflow-hidden",
        )}
      >
        <div
          className={cn(
            "pull-refresh",
            (pullDistance > 0 || refreshing) && "pull-refresh--visible",
            refreshing && "pull-refresh--busy",
            pullDistance >= threshold && !refreshing && "pull-refresh--armed",
          )}
          style={{
            height: refreshing ? 44 : pullDistance,
            opacity: refreshing || pullDistance > 8 ? 1 : pullDistance / 24,
          }}
          aria-hidden={!refreshing && pullDistance < 8}
        >
          <Loader2
            className={cn(
              "pull-refresh__icon size-5",
              (refreshing || pullDistance >= threshold) && "pull-refresh__icon--spin",
            )}
          />
          <span className="pull-refresh__label">
            {refreshing ? "Refreshing…" : pullDistance >= threshold ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
        <header
          className={cn(
            "app-page-header sticky top-0 z-20 flex flex-nowrap items-center justify-between gap-x-2",
            employeeRideChrome && "app-page-header--ride",
          )}
        >
          {employeeRideChrome ? null : (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {backTo ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label={backLabel}
                  tooltip={backLabel}
                  tooltipSide="bottom"
                  onClick={() => {
                    if (typeof window !== "undefined" && window.history.length > 1) {
                      router.history.back();
                      return;
                    }
                    void navigate({ to: backTo });
                  }}
                >
                  <ArrowLeft className="size-4" />
                </Button>
              ) : null}
              {!hideMobileSidebar && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn("size-8 shrink-0 lg:hidden", backTo && "hidden")}
                  aria-label="Open menu"
                  tooltip="Open navigation menu"
                  onClick={() => setMenuOpen(true)}
                >
                  <Menu className="size-4" />
                </Button>
              )}
              <div className="app-page-header__titles min-w-0 flex-1">
                <h1 className="app-page-header__title">{title}</h1>
                {subtitle && <p className="app-page-header__subtitle">{subtitle}</p>}
              </div>
            </div>
          )}
          <div
            className={cn(
              "flex shrink-0 items-center justify-end gap-1.5 sm:gap-2",
              employeeRideChrome && "ride-header-actions",
              !employeeRideChrome && "ml-auto",
            )}
          >
            {actions}
            {showHeaderRequests && (
              <>
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  className={cn(
                    "size-8 sm:hidden",
                    activeNav === "/requests" && "border-primary/40 bg-primary/8 text-primary",
                  )}
                  tooltip="My rides"
                >
                  <Link to="/requests">
                    <ClipboardList className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={cn(
                    "hidden h-8 gap-1.5 px-2.5 sm:inline-flex",
                    activeNav === "/requests" && "border-primary/40 bg-primary/8 text-primary",
                  )}
                  tooltip="My rides"
                >
                  <Link to="/requests">
                    <ClipboardList className="size-3.5 shrink-0" />
                    <span className="text-xs">My rides</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className={cn(
                    "h-8 gap-1 px-2",
                    activeNav === "/requests/new" && "ring-2 ring-primary/30",
                  )}
                  tooltip="Book a ride"
                >
                  <Link to="/requests/new">
                    <Plus className="size-3.5 shrink-0" />
                    <span className="hidden text-xs sm:inline">Book</span>
                  </Link>
                </Button>
              </>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn("notif-bell relative size-8", unread > 0 && "notif-bell--hot")}
                  aria-label={isDriverPortal ? t("shell.notifications") : "Notifications"}
                  tooltip={
                    unread > 0
                      ? `${unread} unread notification${unread === 1 ? "" : "s"}`
                      : isDriverPortal
                        ? t("shell.notifications")
                        : "View notifications"
                  }
                >
                  <Bell className="size-4" />
                  {unread > 0 && (
                    <span className="notif-bell__badge" aria-hidden>
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="bottom"
                sideOffset={8}
                collisionPadding={12}
                className="notif-panel p-0"
              >
                <div className="notif-panel__head">
                  <div className="min-w-0">
                    <p className="notif-panel__title">
                      {isDriverPortal ? t("shell.notifications") : "Notifications"}
                    </p>
                    <p className="notif-panel__sub">
                      {unread > 0
                        ? `${unread} unread`
                        : isDriverPortal
                          ? t("shell.nothingNew")
                          : "You're all caught up"}
                    </p>
                  </div>
                  {unread > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="notif-panel__mark-all"
                      disabled={markAllRead.isPending}
                      tooltip={
                        isDriverPortal ? t("shell.markAllRead") : "Mark all notifications as read"
                      }
                      onClick={() => void markAllRead.mutateAsync()}
                    >
                      {isDriverPortal ? t("shell.markAllRead") : "Mark all read"}
                    </Button>
                  ) : null}
                </div>

                <div className="notif-panel__list">
                  {notifications.length === 0 ? (
                    <div className="notif-panel__empty">
                      <span className="notif-panel__empty-icon" aria-hidden>
                        <Bell className="size-5" />
                      </span>
                      <p className="notif-panel__empty-title">
                        {isDriverPortal ? t("shell.nothingNew") : "No notifications"}
                      </p>
                      <p className="notif-panel__empty-desc">
                        Trip updates and assignments show here.
                      </p>
                    </div>
                  ) : (
                    <ul className="notif-panel__ul">
                      {notifications.map((n) => {
                        const rel = relativeTime(n.created_at);
                        return (
                          <li key={n.id}>
                            <button
                              type="button"
                              className={cn(
                                "notif-item",
                                n.is_read ? "notif-item--read" : "notif-item--unread",
                              )}
                              onClick={() => {
                                if (!n.is_read) void markRead.mutateAsync(n.id);
                                if (n.link?.startsWith("/")) {
                                  router.history.push(n.link);
                                } else if (n.link) {
                                  window.location.href = n.link;
                                }
                              }}
                            >
                              <span
                                className="notif-item__dot"
                                aria-hidden
                                data-unread={!n.is_read || undefined}
                              />
                              <span className="notif-item__body min-w-0">
                                <span className="notif-item__top">
                                  <span className="notif-item__title">{n.title}</span>
                                  {rel ? (
                                    <time className="notif-item__when" dateTime={n.created_at}>
                                      {rel}
                                    </time>
                                  ) : null}
                                </span>
                                {n.body ? (
                                  <span className="notif-item__text">{n.body}</span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {!employeeRideChrome && (
            <Popover open={accountOpen} onOpenChange={setAccountOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-8 max-w-[11rem] gap-2 border-2 px-2 ring-1 sm:max-w-[14rem]",
                    pathname === "/profile"
                      ? "border-primary/40 bg-primary/8 ring-primary/25"
                      : "ring-primary/15",
                  )}
                  aria-label="Account menu"
                  tooltip="Account and profile"
                  tooltipSide="bottom"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {(profile?.full_name ?? "U").charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden min-w-0 truncate text-xs font-semibold sm:inline">
                    {profile?.full_name ?? (isDriverPortal ? t("shell.account") : "Account")}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="bottom"
                sideOffset={6}
                collisionPadding={12}
                className="w-[min(100vw-1.5rem,14rem)] max-h-[min(70dvh,20rem)] overflow-y-auto p-0"
              >
                <div className="border-b border-border px-3 py-2.5">
                  <p className="truncate text-sm font-medium">
                    {profile?.full_name ?? (isDriverPortal ? t("shell.signedIn") : "Signed in")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {displayPhone
                      ? formatBdPhone(displayPhone)
                      : roles.map((r) => r.replace(/_/g, " ")).join(" · ") || "employee"}
                  </p>
                </div>
                <div className="p-1">
                  {isDriverPortal && (
                    <div className="mb-1 border-b border-border px-2.5 py-2">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("shell.language")}
                      </p>
                      <LanguageToggle className="w-full justify-stretch [&_button]:flex-1" />
                    </div>
                  )}
                  {!isAdmin && (
                    <Link
                      to="/profile"
                      onClick={() => setAccountOpen(false)}
                      className={cn(
                        "flex min-h-9 items-center gap-2 rounded-md px-2.5 text-sm transition-colors hover:bg-accent",
                        pathname === "/profile" && "bg-primary/8 font-semibold text-primary",
                      )}
                    >
                      <User className="size-4 shrink-0 text-muted-foreground" />
                      {isDriverPortal ? t("shell.myProfile") : "My profile"}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      void signOut();
                    }}
                    className="flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <LogOut className="size-4 shrink-0" />
                    {isDriverPortal ? t("shell.signOut") : "Sign out"}
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            )}
            {employeeRideChrome ? (
              <Link
                to="/profile"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-2 ring-black/5"
                aria-label="Account"
              >
                {(profile?.full_name ?? "U").charAt(0).toUpperCase()}
              </Link>
            ) : null}
          </div>
        </header>

        <main
          className={cn(
            "app-main-canvas flex flex-1 flex-col px-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:px-4 lg:px-5 lg:pb-4",
            hideMobileSidebar ? "pt-4 sm:pt-5 lg:pt-5" : "py-3 sm:py-4",
            fillViewport && "min-h-0 lg:overflow-hidden",
          )}
        >
          <div
            key={pathname}
            className={cn(
              "page-route-enter flex min-h-0 flex-1 flex-col",
              fillViewport && "lg:overflow-hidden",
            )}
          >
            {children}
          </div>
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_-8px_oklch(0.35_0.08_42/0.12)] backdrop-blur lg:hidden"
          aria-label="Primary"
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${bottomItems.length + (hideMobileSidebar ? 0 : 1)}, minmax(0, 1fr))`,
            }}
          >
            {bottomItems.map((item) => {
              const active = activeNav === item.to;
              const Icon =
                employeeRideChrome && item.to === "/dashboard" ? Car : item.icon;
              const label =
                employeeRideChrome && item.to === "/dashboard"
                  ? "Ride"
                  : resolveShort(item);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "relative flex min-h-11 flex-col items-center justify-center gap-px px-1 py-1.5 text-[10px] font-semibold transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                    active && employeeRideChrome && "is-ride-active",
                  )}
                >
                  {active && (
                    <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" />
                  )}
                  <Icon className={cn("size-5", active && "stroke-[2.5px]")} />
                  <span className="max-w-full truncate">{label}</span>
                </Link>
              );
            })}
            {!hideMobileSidebar && (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex min-h-11 flex-col items-center justify-center gap-px px-1 py-1.5 text-[10px] font-medium text-muted-foreground"
            >
              <MoreHorizontal className="size-5" />
              {isDriverPortal ? t("nav.more") : "More"}
            </button>
            )}
          </div>
        </nav>

        {!hideMobileSidebar && (
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="app-sidebar-sheet w-[min(100vw-3rem,17rem)] p-0 pb-[env(safe-area-inset-bottom)]">
            <SheetHeader className="app-sidebar-brand border-0 p-0 text-left shadow-none">
              <AppIcon className="app-sidebar-logo" />
              <div className="app-sidebar-brand-text min-w-0">
                <SheetTitle className="text-sm font-bold">FleetOps</SheetTitle>
                <p className="truncate text-left text-xs text-sidebar-foreground/55">
                  {profile?.full_name ?? (isDriverPortal ? t("shell.signedIn") : "Signed in")}
                  {displayPhone ? ` · ${formatBdPhone(displayPhone)}` : ""}
                </p>
              </div>
            </SheetHeader>
            <nav className="app-sidebar-nav flex-1">
              <SidebarNavSections
                items={sidebarItems}
                collapsed={false}
                activeNav={activeNav}
                onNavigate={() => setMenuOpen(false)}
                resolveLabel={resolveLabel}
              />
            </nav>
            <div className="app-sidebar-footer border-t border-sidebar-border">
              <button
                type="button"
                onClick={() => void signOut()}
                className="app-sidebar-footer-btn text-destructive/85 hover:bg-destructive/8 hover:text-destructive"
              >
                <LogOut className="size-4 shrink-0" />
                <span>{isDriverPortal ? t("shell.signOut") : "Sign out"}</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
