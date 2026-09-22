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
import { tipAttnTone, personAttnTone } from "@/lib/fleet";
import { routeLineCompact } from "@/lib/route-summary";
import type { RequestRow, TripRecord, UnavailabilityRow } from "@/lib/queries";
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

const QUICK: {
  to: "/trips" | "/fleet" | "/drivers" | "/maintenance" | "/admin/employees";
  label: string;
  icon: LucideIcon;
}[] = [
  { to: "/trips", label: "Trips", icon: Radar },
  { to: "/fleet", label: "Fleet", icon: Car },
  { to: "/drivers", label: "Drivers", icon: Users },
  { to: "/maintenance", label: "Maint", icon: Wrench },
  { to: "/admin/employees", label: "Staff", icon: ClipboardList },
];

/** Inline strip for hero — no card chrome. */
export function DashQuickStrip({ onLogIssue }: { onLogIssue: () => void }) {
  return (
    <div
      className="dash-home__actions dash-home__actions--hero"
      role="navigation"
      aria-label="Quick actions"
    >
      {QUICK.map(({ to, label, icon: Icon }) => (
        <Button
          key={to}
          asChild
          size="sm"
          variant="outline"
          className="dash-home__chip h-8 min-w-0 gap-1 px-2.5 text-xs"
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
        className="dash-home__chip h-8 min-w-0 gap-1 px-2.5 text-xs"
        onClick={onLogIssue}
      >
        <Wrench className="size-3.5 shrink-0" />
        Log issue
      </Button>
    </div>
  );
}

/** Squircle tile board — sits beside At a glance. */
export function DashQuickActions({ onLogIssue }: { onLogIssue: () => void }) {
  return (
    <DashModule title="Quick actions" className="dash-mod--quick" bodyClassName="dash-mod__body--quick">
      <div className="dash-quick" role="navigation" aria-label="Quick actions">
        {QUICK.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="dash-quick__tile">
            <Icon className="dash-quick__icon" aria-hidden />
            <span className="dash-quick__label">{label}</span>
          </Link>
        ))}
        <button type="button" className="dash-quick__tile dash-quick__tile--accent" onClick={onLogIssue}>
          <Wrench className="dash-quick__icon" aria-hidden />
          <span className="dash-quick__label">Log issue</span>
        </button>
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
      title="Fleet"
      count={total}
      action={
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link to="/fleet">Open</Link>
        </Button>
      }
      className="dash-mod--fleet dash-mod--compact"
    >
      {total === 0 ? (
        <EmptyState compact title="No vehicles" />
      ) : (
        <div className="dash-mod__chips dash-mod__chips--dense">
          <MetaChip
            label={`${available} free`}
            tone={available === 0 ? "warning" : "success"}
          />
          <MetaChip
            label={`${maintenance} shop`}
            tone={maintenance > 0 ? "warning" : "neutral"}
          />
          <MetaChip
            label={`${unavailable} down`}
            tone={unavailable > 0 ? "danger" : "neutral"}
          />
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
          <Link to="/drivers">Open</Link>
        </Button>
      }
      className="dash-mod--drivers dash-mod--compact"
    >
      {total === 0 ? (
        <EmptyState compact title="No drivers" />
      ) : (
        <div className="dash-mod__chips dash-mod__chips--dense">
          <MetaChip
            label={`${available} free`}
            tone={available === 0 ? "warning" : "success"}
          />
          <MetaChip
            label={`${driving} on trip`}
            tone={driving > 0 ? "info" : "neutral"}
          />
          <MetaChip label={`${away} away`} tone="neutral" />
        </div>
      )}
    </DashModule>
  );
}

/** Dense pending queue — same row density as Live. */
export function PendingQueueModule({
  requests,
  total,
  loading,
}: {
  requests: RequestRow[];
  total: number;
  loading?: boolean;
}) {
  const more = Math.max(0, total - requests.length);
  return (
    <DashModule
      title="Pending"
      count={total}
      action={
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link to="/trips">{more > 0 ? `All (+${more})` : "Open"}</Link>
        </Button>
      }
      className="dash-mod--pending"
      bodyClassName="dash-mod__body--list"
    >
      {loading ? (
        <p className="dash-mod__muted">Loading…</p>
      ) : requests.length === 0 ? (
        <EmptyState compact title="Queue clear" />
      ) : (
        <ul className="dash-live dash-pending">
          {requests.map((r) => {
            const route =
              routeLineCompact(r.request_route_points) || r.purpose?.trim() || "Request";
            const name = r.requester_name?.trim() || "Employee";
            const needsAssign = r.status === "submitted" || r.status === "approved";
            return (
              <li key={r.id}>
                <Link to="/trips" search={{ request: r.id }} className="dash-live__row">
                  <ListWhenCell at={r.pickup_at} />
                  <div className="dash-live__main min-w-0">
                    <p className="dash-live__route truncate">{route}</p>
                    <p className="dash-live__meta truncate">
                      {name} · {r.passenger_count} pax
                    </p>
                  </div>
                  <StatusChip
                    label={needsAssign ? "Assign" : r.status.replace(/_/g, " ")}
                    tone={needsAssign ? "warning" : "info"}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashModule>
  );
}

export function LiveTripsModule({ trips, loading }: { trips: TripRecord[]; loading?: boolean }) {
  return (
    <DashModule
      title="Live"
      count={trips.length}
      action={
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link to="/trips">Open</Link>
        </Button>
      }
      className="dash-mod--live"
      bodyClassName="dash-mod__body--list"
    >
      {loading ? (
        <p className="dash-mod__muted">Loading…</p>
      ) : trips.length === 0 ? (
        <EmptyState compact title="No live trips" />
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

export type UpcomingItem = {
  id: string;
  at: string;
  label: string;
  meta: string;
  kind: "pending" | "live";
};

export function UpcomingModule({ items }: { items: UpcomingItem[] }) {
  return (
    <DashModule
      title="Next up"
      count={items.length}
      action={
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link to="/trips">Open</Link>
        </Button>
      }
      className="dash-mod--upcoming"
      bodyClassName="dash-mod__body--list"
    >
      {items.length === 0 ? (
        <EmptyState compact title="Nothing soon" />
      ) : (
        <ul className="dash-live">
          {items.map((item) => (
            <li key={item.id}>
              <Link to="/trips" search={{ request: item.id }} className="dash-live__row">
                <ListWhenCell at={item.at} />
                <div className="dash-live__main min-w-0">
                  <p className="dash-live__route truncate">{item.label}</p>
                  <p className="dash-live__meta truncate">{item.meta}</p>
                </div>
                <StatusChip
                  label={item.kind === "pending" ? "Queue" : "Live"}
                  tone={item.kind === "pending" ? "warning" : "info"}
                />
              </Link>
            </li>
          ))}
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
      title="Shop"
      count={pendingReports + inShop}
      action={
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link to="/maintenance">Open</Link>
        </Button>
      }
      className="dash-mod--maint dash-mod--compact"
    >
      {loading ? (
        <p className="dash-mod__muted">Loading…</p>
      ) : (
        <div className="dash-mod__chips dash-mod__chips--dense">
          <MetaChip
            label={`${pendingReports} reports`}
            tone={pendingReports > 0 ? "warning" : "neutral"}
          />
          <MetaChip
            label={`${inShop} in shop`}
            tone={inShop > 0 ? "warning" : "neutral"}
          />
          {preview[0] ? (
            <MetaChip
              label={
                preview[0].vehicles?.registration_number ??
                preview[0].vehicles?.name ??
                "Unit"
              }
              tone="info"
            />
          ) : null}
        </div>
      )}
    </DashModule>
  );
}

export type GlanceTip = {
  id: string;
  label: string;
  detail?: string;
  to: "/trips" | "/fleet" | "/drivers" | "/maintenance";
  tone?: "warn" | "info" | "ok" | "focus" | "danger";
};

const GLANCE_DEST: Record<GlanceTip["to"], string> = {
  "/trips": "Trips",
  "/fleet": "Fleet",
  "/drivers": "Drivers",
  "/maintenance": "Maintenance",
};

export function GlanceModule({ tips }: { tips: GlanceTip[] }) {
  return (
    <DashModule title="At a glance" className="dash-mod--glance" bodyClassName="dash-mod__body--glance">
      {tips.length === 0 ? (
        <p className="dash-mod__muted dash-glance__quiet">All clear — nothing urgent.</p>
      ) : (
        <ul className="dash-glance">
          {tips.map((tip) => {
            const tone = tip.tone ?? tipAttnTone(tip.label);
            return (
              <li key={tip.id}>
                <Link
                  to={tip.to}
                  className={cn("dash-glance__row", `dash-glance__row--${tone}`)}
                >
                  <span className="dash-glance__rail" aria-hidden />
                  <span className="dash-glance__copy min-w-0">
                    <span className="dash-glance__title truncate">{tip.label}</span>
                    <span className="dash-glance__meta truncate">
                      {tip.detail ?? `Open ${GLANCE_DEST[tip.to]}`}
                    </span>
                  </span>
                  <span className="dash-glance__go" aria-hidden>
                    →
                  </span>
                </Link>
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
