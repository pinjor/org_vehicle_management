import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Car,
  ClipboardList,
  Radar,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { EmptyState, MetaChip, StatusChip } from "@/components/fleet-ui";
import { ListWhenCell } from "@/components/trip-list-table";
import { Button } from "@/components/ui/button";
import { DRIVER_STATUS, VEHICLE_STATUS, tipAttnTone, personAttnTone } from "@/lib/fleet";
import { routeLineCompact } from "@/lib/route-summary";
import type { TripRecord, UnavailabilityRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function DashModule({
  title,
  count,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  count?: number | string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("dash-mod", className)}>
      <header className="dash-mod__head">
        <div className="dash-mod__title-row min-w-0">
          <h2 className="dash-mod__title">{title}</h2>
          {count != null ? <span className="dash-mod__count">{count}</span> : null}
        </div>
        {action ? <div className="dash-mod__action shrink-0">{action}</div> : null}
      </header>
      <div className={cn("dash-mod__body", bodyClassName)}>{children}</div>
    </section>
  );
}

export function DashStatBar({
  label,
  value,
  total,
  tone = "neutral",
}: {
  label: string;
  value: number;
  total: number;
  tone?: "success" | "warning" | "danger" | "info" | "primary" | "neutral";
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="dash-stat">
      <div className="dash-stat__meta">
        <span className="dash-stat__label">{label}</span>
        <span className="dash-stat__value tabular-nums">
          {value}
          <span className="dash-stat__pct"> · {pct}%</span>
        </span>
      </div>
      <div className="dash-stat__track" aria-hidden>
        <span
          className={cn("dash-stat__fill", `dash-stat__fill--${tone}`)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const QUICK: { to: "/trips" | "/fleet" | "/drivers" | "/maintenance" | "/admin/employees"; label: string; icon: LucideIcon }[] = [
  { to: "/trips", label: "Trips", icon: Radar },
  { to: "/fleet", label: "Fleet", icon: Car },
  { to: "/drivers", label: "Drivers", icon: Users },
  { to: "/maintenance", label: "Maintenance", icon: Wrench },
  { to: "/admin/employees", label: "Employees", icon: ClipboardList },
];

export function DashQuickActions({ onLogIssue }: { onLogIssue: () => void }) {
  return (
    <DashModule title="Quick actions" className="dash-mod--quick">
      <div className="dash-home__actions" role="navigation" aria-label="Quick actions">
        {QUICK.map(({ to, label, icon: Icon }) => (
          <Button
            key={to}
            asChild
            size="sm"
            variant="outline"
            className="dash-home__chip h-9 min-w-0 flex-1 gap-1.5 sm:flex-none"
          >
            <Link to={to}>
              <Icon className="size-3.5 shrink-0" />
              {label}
            </Link>
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          className="dash-home__chip h-9 min-w-0 flex-1 gap-1.5 sm:flex-none"
          onClick={onLogIssue}
        >
          <Wrench className="size-3.5 shrink-0" />
          Log issue
        </Button>
      </div>
    </DashModule>
  );
}

export function FleetHealthModule({
  total,
  available,
  maintenance,
  unavailable,
}: {
  total: number;
  available: number;
  maintenance: number;
  unavailable: number;
}) {
  return (
    <DashModule
      title="Fleet health"
      count={total}
      action={
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link to="/fleet">Open fleet</Link>
        </Button>
      }
      className="dash-mod--fleet"
    >
      {total === 0 ? (
        <EmptyState compact title="No vehicles" description="Add fleet units to track health." />
      ) : (
        <div className="dash-mod__stack">
          <DashStatBar label={VEHICLE_STATUS["available"]?.label ?? "Available"} value={available} total={total} tone="success" />
          <DashStatBar
            label={VEHICLE_STATUS["under_maintenance"]?.label ?? "Maintenance"}
            value={maintenance}
            total={total}
            tone="warning"
          />
          <DashStatBar
            label={VEHICLE_STATUS["unavailable"]?.label ?? "Unavailable"}
            value={unavailable}
            total={total}
            tone="danger"
          />
          <div className="dash-mod__chips">
            <MetaChip label={`${available} free`} tone={available === 0 ? "warning" : "success"} />
            <MetaChip label={`${maintenance} in shop`} tone={maintenance > 0 ? "warning" : "neutral"} />
            <MetaChip label={`${unavailable} down`} tone={unavailable > 0 ? "danger" : "neutral"} />
          </div>
        </div>
      )}
    </DashModule>
  );
}

export function DriverStatusModule({
  total,
  available,
  driving,
  away,
}: {
  total: number;
  available: number;
  driving: number;
  away: number;
}) {
  return (
    <DashModule
      title="Drivers"
      count={total}
      action={
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link to="/drivers">Open drivers</Link>
        </Button>
      }
      className="dash-mod--drivers"
    >
      {total === 0 ? (
        <EmptyState compact title="No drivers" description="Add drivers to the roster." />
      ) : (
        <div className="dash-mod__stack">
          <DashStatBar label={DRIVER_STATUS["available"]?.label ?? "Available"} value={available} total={total} tone="success" />
          <DashStatBar label={DRIVER_STATUS["driving"]?.label ?? "Driving"} value={driving} total={total} tone="info" />
          <DashStatBar label="Away / leave" value={away} total={total} tone="neutral" />
          <div className="dash-mod__chips">
            <MetaChip label={`${available} free`} tone={available === 0 ? "warning" : "success"} />
            <MetaChip label={`${driving} on trip`} tone={driving > 0 ? "info" : "neutral"} />
            <MetaChip label={`${away} away`} />
          </div>
        </div>
      )}
    </DashModule>
  );
}

export function LiveTripsModule({ trips, loading }: { trips: TripRecord[]; loading?: boolean }) {
  return (
    <DashModule
      title="Live trips"
      count={trips.length}
      action={
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link to="/trips">Open trips</Link>
        </Button>
      }
      className="dash-mod--live"
      bodyClassName="dash-mod__body--list"
    >
      {loading ? (
        <p className="dash-mod__muted">Loading trips…</p>
      ) : trips.length === 0 ? (
        <EmptyState compact title="No live trips" description="Active assignments show here." />
      ) : (
        <ul className="dash-live">
          {trips.map((t) => {
            const req = t.vehicle_requests;
            const route =
              routeLineCompact(req?.request_route_points) ||
              req?.purpose?.trim() ||
              "Trip";
            const driver = t.drivers?.full_name?.trim() || "Unassigned";
            const plate = t.vehicles?.registration_number || t.vehicles?.name || "—";
            const requestId = t.request_id || req?.id;
            const driverWarn = Boolean(personAttnTone(driver));
            const inner = (
              <>
                <ListWhenCell at={req?.pickup_at ?? t.created_at} />
                <div className="dash-live__main min-w-0">
                  <p className="dash-live__route truncate">{route}</p>
                  <p
                    className={cn(
                      "dash-live__meta truncate",
                      driverWarn && "dash-live__meta--warn",
                    )}
                  >
                    {driver} · {plate}
                  </p>
                </div>
                <StatusChip label={t.status.replace(/_/g, " ")} tone="info" />
              </>
            );
            return (
              <li key={t.id}>
                {requestId ? (
                  <Link
                    to="/trips"
                    search={{ request: requestId }}
                    className="dash-live__row"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="dash-live__row dash-live__row--static">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DashModule>
  );
}

export function MaintenanceModule({
  pendingReports,
  inShop,
  preview,
  loading,
}: {
  pendingReports: number;
  inShop: number;
  preview: UnavailabilityRow[];
  loading?: boolean;
}) {
  return (
    <DashModule
      title="Maintenance"
      count={pendingReports + inShop}
      action={
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link to="/maintenance">Open desk</Link>
        </Button>
      }
      className="dash-mod--maint"
    >
      <div className="dash-mod__chips dash-mod__chips--pad">
        <MetaChip
          label={`${pendingReports} pending`}
          tone={pendingReports > 0 ? "warning" : "neutral"}
        />
        <MetaChip
          label={`${inShop} in shop`}
          tone={inShop > 0 ? "warning" : "neutral"}
        />
      </div>
      {loading ? (
        <p className="dash-mod__muted">Loading reports…</p>
      ) : preview.length === 0 ? (
        <EmptyState compact title="Shop clear" description="No open downtime reports." />
      ) : (
        <ul className="dash-maint">
          {preview.map((r) => (
            <li key={r.id} className="dash-maint__row">
              <div className="min-w-0">
                <p className="dash-maint__plate truncate">
                  {r.vehicles?.registration_number ?? r.vehicles?.name ?? "Vehicle"}
                </p>
                <p className="dash-maint__reason truncate capitalize">
                  {r.reason.replace(/_/g, " ")}
                </p>
              </div>
              <StatusChip
                label={r.status.replace(/_/g, " ")}
                tone={r.status === "pending" ? "warning" : "info"}
              />
            </li>
          ))}
        </ul>
      )}
    </DashModule>
  );
}

export function GlanceModule({
  tips,
}: {
  tips: string[];
}) {
  return (
    <DashModule title="At a glance" className="dash-mod--glance">
      {tips.length === 0 ? (
        <p className="dash-mod__muted">Ops quiet — nothing urgent right now.</p>
      ) : (
        <ul className="dash-glance">
          {tips.map((tip) => {
            const tone = tipAttnTone(tip);
            return (
              <li key={tip} className={cn("dash-glance__item", `dash-glance__item--${tone}`)}>
                {tip}
              </li>
            );
          })}
        </ul>
      )}
    </DashModule>
  );
}

export function greetingForNow(name: string) {
  const h = new Date().getHours();
  const hello = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${hello}, ${name}`;
}

export function todayLabel() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}
