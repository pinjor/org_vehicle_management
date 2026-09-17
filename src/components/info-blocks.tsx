import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { daysLeftLabel, formatDate, formatTime, formatWeekday, relativeTime, whenRelTone } from "@/lib/fleet";
import { routeLine, type RoutePointLike } from "@/lib/route-summary";
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

/** Highlighted pickup clock — weekday, date, time, days left (full-height left rail on cards). */
export function WhenRail({
  at,
  className,
  size = "md",
}: {
  at?: string | null | undefined;
  className?: string | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const railClass = cn(
    "when-rail",
    size === "sm" && "when-rail--sm",
    size === "lg" && "when-rail--lg",
    className,
  );
  if (!at) {
    return (
      <div className={railClass} aria-hidden>
        <span className="when-rail__time">—</span>
      </div>
    );
  }
  const dow = formatWeekday(at);
  const days = daysLeftLabel(at);
  const tone = whenRelTone(at);
  return (
    <div
      className={railClass}
      aria-label={`Pickup ${dow} ${formatDate(at)} ${formatTime(at)}${days ? `, ${days}` : ""}`}
    >
      {dow ? <span className="when-rail__dow">{dow}</span> : null}
      <span className="when-rail__date">{formatCardDate(at)}</span>
      <span className="when-rail__time">{formatTime(at)}</span>
      {days ? <span className={cn("when-rail__rel", `when-rail__rel--${tone}`)}>{days}</span> : null}
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
  const tone = whenRelTone(at);
  return (
    <div className={cn("when-banner", className)} aria-label={`Pickup ${formatDate(at)} ${formatTime(at)}`}>
      <span className="when-banner__date">{formatCardDate(at)}</span>
      <span className="when-banner__time">{formatTime(at)}</span>
      {rel ? <span className={cn("when-banner__rel", `when-banner__rel--${tone}`)}>{rel}</span> : null}
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
  const line =
    routeLine(points) ??
    (pickup?.name && drop?.name
      ? `${pickup.name} → ${drop.name}`
      : pickup?.name?.trim() || drop?.name?.trim() || null);
  if (!line) return null;
  return (
    <p className={cn("route-line", className)} aria-label="Route">
      {line}
    </p>
  );
}

/** Detail pages: each stop wraps on its own so long multi-stop routes never overflow. */
export function RouteFlow({
  points,
  focusIndex,
  className,
}: {
  points: { name?: string | null; point_type?: string }[];
  focusIndex?: number;
  className?: string;
}) {
  const stops = points.map((p) => p.name?.trim()).filter((n): n is string => !!n);
  if (stops.length === 0) return null;
  return (
    <div className={cn("route-flow", className)} aria-label="Route">
      {stops.map((name, i) => (
        <span key={`${name}-${i}`} className="route-flow__item">
          {i > 0 ? (
            <span className="route-flow__sep" aria-hidden>
              →
            </span>
          ) : null}
          <span
            className={cn(
              "route-flow__stop",
              focusIndex === i && "route-flow__stop--now",
            )}
          >
            {name}
            {focusIndex === i ? <span className="route-flow__now"> · now</span> : null}
          </span>
        </span>
      ))}
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
  const tone = withRelative ? whenRelTone(at) : null;
  return (
    <time className={cn("when-stamp", className)} dateTime={at}>
      <span className="when-stamp__date">{formatCardDate(at)}</span>
      <span className="when-stamp__time">{formatTime(at)}</span>
      {rel ? (
        <span className={cn("when-stamp__rel", tone && `when-stamp__rel--${tone}`)}>{rel}</span>
      ) : null}
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
  search,
  className,
}: {
  when?: string | null | undefined;
  title: ReactNode;
  subtitle?: ReactNode;
  end?: ReactNode;
  to?: LinkProps["to"];
  params?: LinkProps["params"];
  search?: LinkProps["search"];
  className?: string | undefined;
}) {
  const body = (
    <div className={cn("trip-list-row", className)}>
      <WhenRail at={when ?? null} size="sm" className="trip-list-row__when" />
      <div className="trip-list-row__content min-w-0">
        <div className="trip-list-row__head">
          <div className="trip-list-row__text">
            <p className="trip-list-row__title">{title}</p>
          </div>
          {end ? <div className="trip-list-row__end">{end}</div> : null}
        </div>
        {subtitle ? <p className="trip-list-row__sub">{subtitle}</p> : null}
      </div>
    </div>
  );

  if (!to) return body;
  return (
    <Link
      to={to}
      {...(params !== undefined ? { params } : {})}
      {...(search !== undefined ? { search } : {})}
      className="trip-list-row-link"
    >
      {body}
    </Link>
  );
}
