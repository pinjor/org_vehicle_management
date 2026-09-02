import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { formatDate, formatTime, relativeTime } from "@/lib/fleet";
import { routeEndpoints, sortRoutePoints, type RoutePointLike } from "@/lib/route-summary";
import { cn } from "@/lib/utils";

/** Short date for rails — omit year when current year. */
export function formatCardDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" as const }),
  });
}

/** Highlighted pickup clock — 12h time + date + relative. Use on every trip/request surface. */
export function WhenRail({
  at,
  className,
  size = "md",
}: {
  at?: string | null | undefined;
  className?: string | undefined;
  size?: "sm" | "md" | "lg";
}) {
  if (!at) return null;
  const rel = relativeTime(at);
  return (
    <div
      className={cn("when-rail", size === "sm" && "when-rail--sm", size === "lg" && "when-rail--lg", className)}
      aria-label={`Pickup ${formatDate(at)} ${formatTime(at)}`}
    >
      <span className="when-rail__time">{formatTime(at)}</span>
      <span className="when-rail__date">{formatCardDate(at)}</span>
      {rel ? <span className="when-rail__rel">{rel}</span> : null}
    </div>
  );
}

/** Inline when strip for detail headers (not a side rail). */
export function WhenBanner({
  at,
  className,
}: {
  at?: string | null | undefined;
  className?: string | undefined;
}) {
  if (!at) return null;
  const rel = relativeTime(at);
  return (
    <div className={cn("when-banner", className)} aria-label={`Pickup ${formatDate(at)} ${formatTime(at)}`}>
      <span className="when-banner__time">{formatTime(at)}</span>
      <span className="when-banner__date">{formatCardDate(at)}</span>
      {rel ? <span className="when-banner__rel">{rel}</span> : null}
    </div>
  );
}

export function RouteTimeline({
  pickup,
  drop,
  points,
  className,
}: {
  pickup?: RoutePointLike | undefined;
  drop?: RoutePointLike | undefined;
  points?: RoutePointLike[] | null | undefined;
  className?: string | undefined;
}) {
  const sorted = sortRoutePoints(points ?? []);
  if (sorted.length > 0) {
    return (
      <div className={cn("route-timeline", className)} aria-label="Route">
        {sorted.map((p, i) => {
          const tone =
            p.point_type === "pickup"
              ? "pick"
              : p.point_type === "destination"
                ? "drop"
                : "stop";
          return (
            <div key={`${p.point_type}-${p.sequence ?? i}-${p.name}`} className="route-timeline__stop">
              <span className={cn("route-timeline__dot", `route-timeline__dot--${tone}`)} />
              <span className="route-timeline__name">{p.name}</span>
            </div>
          );
        })}
      </div>
    );
  }

  const ends =
    pickup || drop
      ? { pickup, drop }
      : routeEndpoints(points);
  if (!ends.pickup && !ends.drop) return null;
  return (
    <div className={cn("route-timeline", className)} aria-label="Route">
      {ends.pickup ? (
        <div className="route-timeline__stop">
          <span className="route-timeline__dot route-timeline__dot--pick" />
          <span className="route-timeline__name">{ends.pickup.name}</span>
        </div>
      ) : null}
      {ends.drop ? (
        <div className="route-timeline__stop">
          <span className="route-timeline__dot route-timeline__dot--drop" />
          <span className="route-timeline__name">{ends.drop.name}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Compact highlighted time for history, audit, notifications — not a full rail. */
export function WhenStamp({
  at,
  className,
  withRelative = false,
}: {
  at?: string | null | undefined;
  className?: string | undefined;
  withRelative?: boolean;
}) {
  if (!at) return null;
  const rel = withRelative ? relativeTime(at) : "";
  return (
    <time className={cn("when-stamp", className)} dateTime={at}>
      <span className="when-stamp__time">{formatTime(at)}</span>
      <span className="when-stamp__date">{formatCardDate(at)}</span>
      {rel ? <span className="when-stamp__rel">{rel}</span> : null}
    </time>
  );
}

/**
 * Compact nested list row: when-rail + title/subtitle + trailing chip.
 * Use on employee/driver/fleet history lists, alerts, etc.
 */
export function TripListRow({
  when,
  title,
  subtitle,
  end,
  to,
  params,
  className,
}: {
  when?: string | null | undefined;
  title: ReactNode;
  subtitle?: ReactNode;
  end?: ReactNode;
  to?: LinkProps["to"];
  params?: LinkProps["params"];
  className?: string | undefined;
}) {
  const body = (
    <div className={cn("trip-list-row", className)}>
      <WhenRail at={when ?? null} size="sm" />
      <div className="trip-list-row__body">
        <div className="trip-list-row__text">
          <p className="trip-list-row__title">{title}</p>
          {subtitle ? <p className="trip-list-row__sub">{subtitle}</p> : null}
        </div>
        {end ? <div className="trip-list-row__end">{end}</div> : null}
      </div>
    </div>
  );

  if (!to) return body;
  return (
    <Link
      to={to}
      {...(params !== undefined ? { params } : {})}
      className="trip-list-row-link"
    >
      {body}
    </Link>
  );
}
