import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { AdminPendingActions } from "@/components/admin-pending-actions";
import { LookupChip } from "@/components/lookup-chip";
import { StatusChip } from "@/components/fleet-ui";
import { formatCardDate } from "@/components/info-blocks";
import {
  daysLeftLabel,
  formatWeekday,
  TRIP_STATUS,
  simplifiedDriverCta,
  formatTime,
  whenRelTone,
  personAttnTone,
  attnClass,
} from "@/lib/fleet";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { primaryContact, routeLineCompact, sortRoutePoints } from "@/lib/route-summary";
import { useAdvanceTrip, type RequestRow, type TripRecord } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Shared headered trip/request table for md+ viewports. */

export function TripListTable({
  headers,
  children,
  fill,
  className,
}: {
  headers: string[];
  children: ReactNode;
  fill?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("trip-list-board", fill && "trip-list-board--fill", className)}>
      <div className="trip-list-board__scroll">
        <table className="data-table trip-list-table w-full">
          <thead>
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className={cn(
                    h === "Actions" && "text-right trip-list-table__col-actions",
                    h === "Time" && "trip-list-table__col-time",
                    h === "Route" && "trip-list-table__col-route",
                    (h === "Employee" || h === "Driver" || h === "Passenger") &&
                      "trip-list-table__col-person",
                    (h === "Pax" || h === "Passengers" || h === "Pax / Vehicle") &&
                      "trip-list-table__col-pax",
                    h === "Vehicle" && "trip-list-table__col-vehicle",
                    h === "Status" && "trip-list-table__col-status",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function personInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

/** Shared When column — weekday, time, date, relative pill. */
export function ListWhenCell({ at }: { at?: string | null }) {
  if (!at) return <span className="trip-list-table__empty">—</span>;
  const days = daysLeftLabel(at);
  const dow = formatWeekday(at);
  const date = formatCardDate(at);
  return (
    <div
      className="trip-list-table__when"
      aria-label={`${dow} ${date} ${formatTime(at)}${days ? `, ${days}` : ""}`}
    >
      {dow ? <span className="trip-list-table__when-dow">{dow}</span> : null}
      <p className="trip-list-table__when-time">{formatTime(at)}</p>
      {date ? <p className="trip-list-table__when-date">{date}</p> : null}
      {days ? (
        <span className={cn("trip-list-table__when-rel", `trip-list-table__when-rel--${whenRelTone(at)}`)}>
          {days}
        </span>
      ) : null}
    </div>
  );
}

function WhenCell({ at }: { at?: string | null }) {
  return at == null ? <ListWhenCell /> : <ListWhenCell at={at} />;
}

function stopDotClass(pointType: string, index: number, total: number): string {
  if (pointType === "pickup" || (index === 0 && pointType !== "destination")) {
    return "trip-list-table__stop-dot--pick";
  }
  if (pointType === "destination" || index === total - 1) {
    return "trip-list-table__stop-dot--drop";
  }
  return "trip-list-table__stop-dot--stop";
}

export function ListRouteCell({
  points,
  fallback,
}: {
  points?: Parameters<typeof routeLineCompact>[0];
  fallback?: string | null;
}) {
  const stops = sortRoutePoints(points ?? []).filter((p) => p.name?.trim());
  const line = routeLineCompact(points) ?? (fallback?.trim() || null);

  if (stops.length > 0) {
    return (
      <div className="trip-list-table__route-flow" title={line || undefined}>
        {stops.map((stop, i) => (
          <div key={`${stop.point_type}-${stop.sequence ?? i}-${stop.name}`} className="trip-list-table__stop">
            <span
              className={cn(
                "trip-list-table__stop-dot",
                stopDotClass(stop.point_type, i, stops.length),
              )}
              aria-hidden
            />
            <span className="trip-list-table__stop-name">{stop.name.trim()}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className="trip-list-table__route" title={line || undefined}>
      {line || "—"}
    </p>
  );
}

function RouteCell(props: Parameters<typeof ListRouteCell>[0]) {
  return <ListRouteCell {...props} />;
}

export function ListPersonCell({
  name,
  sub,
  avatar = true,
}: {
  name: string;
  sub?: string | null;
  /** Initials badge — off in dense tables. */
  avatar?: boolean;
}) {
  const tone = personAttnTone(name, sub);
  return (
    <div className="trip-list-table__person">
      {avatar ? (
        <span
          className={cn(
            "trip-list-table__avatar",
            tone === "warn" && "trip-list-table__avatar--warn",
            tone === "danger" && "trip-list-table__avatar--danger",
          )}
          aria-hidden
        >
          {personInitials(name)}
        </span>
      ) : null}
      <div className="trip-list-table__person-text min-w-0">
        <p className={cn("trip-list-table__person-name truncate", tone && attnClass(tone))}>{name}</p>
        {sub ? (
          <p className={cn("trip-list-table__muted truncate", tone && attnClass(tone))}>{sub}</p>
        ) : null}
      </div>
    </div>
  );
}

function PersonCell(props: Parameters<typeof ListPersonCell>[0]) {
  return <ListPersonCell {...props} avatar={false} />;
}

function personProps(name: string, sub?: string | null) {
  return sub ? { name, sub } : { name };
}

function routeProps(
  points?: Parameters<typeof routeLineCompact>[0] | null,
  fallback?: string | null,
) {
  return {
    ...(points ? { points } : {}),
    ...(fallback ? { fallback } : {}),
  };
}

/** Admin / employee request row. */
export function RequestTableRow({
  request,
  mode = "admin",
  actions,
  showActions = true,
}: {
  request: RequestRow & { request_route_points?: Parameters<typeof routeLineCompact>[0] };
  mode?: "admin" | "employee";
  actions?: ReactNode;
  showActions?: boolean;
}) {
  const driverName = request.drivers?.full_name?.trim();
  const plate = request.vehicles?.registration_number ?? request.vehicles?.name;
  const employeeName = request.requester_name?.trim() || "Employee";
  const purpose = request.purpose?.trim();
  const pending =
    showActions &&
    mode === "admin" &&
    !driverName &&
    !plate &&
    ["submitted", "approved"].includes(request.status);
  const navigate = useNavigate();

  return (
    <tr
      className="trip-list-table__row--link"
      onClick={() => {
        if (mode === "admin") {
          navigate({ to: "/trips", search: { request: request.id } });
        } else {
          navigate({ to: "/requests/$requestId", params: { requestId: request.id } });
        }
      }}
    >
      <td className="trip-list-table__col-time">
        <WhenCell at={request.pickup_at} />
      </td>
      <td className="trip-list-table__col-person">
        {mode === "admin" ? (
          <PersonCell {...personProps(employeeName, request.requester_phone)} />
        ) : driverName ? (
          <PersonCell {...personProps(driverName, plate)} />
        ) : (
          <PersonCell {...personProps("Unassigned", "Awaiting driver")} />
        )}
      </td>
      <td className="trip-list-table__col-route">
        <RouteCell {...routeProps(request.request_route_points, purpose)} />
      </td>
      <td className="trip-list-table__col-pax">
        <span
          className="trip-list-table__pax"
          title={
            mode === "admin"
              ? [String(request.passenger_count), plate].filter(Boolean).join(" · ")
              : String(request.passenger_count)
          }
        >
          {mode === "admin" && plate
            ? `${request.passenger_count} · ${plate}`
            : request.passenger_count}
        </span>
      </td>
      <td className="trip-list-table__col-status">
        <LookupChip group="request_status" value={request.status} />
      </td>
      {showActions ? (
        <td className="trip-list-table__col-actions text-right">
          <div className="trip-list-table__actions" onClick={(e) => e.stopPropagation()}>
            {actions}
            {pending ? <AdminPendingActions request={request} layout="row" /> : null}
            <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
              {mode === "admin" ? (
                <Link to="/trips" search={{ request: request.id }} className="trip-list-table__link">
                  Open
                </Link>
              ) : (
                <Link
                  to="/requests/$requestId"
                  params={{ requestId: request.id }}
                  className="trip-list-table__link"
                >
                  Open
                </Link>
              )}
            </Button>
          </div>
        </td>
      ) : null}
    </tr>
  );
}

/** Live / completed trip row (admin). */
export function TripTableRow({
  trip,
  showActions = true,
}: {
  trip: TripRecord;
  showActions?: boolean;
}) {
  const req = trip.vehicle_requests;
  const contact = primaryContact({
    ...(req?.requester_name ? { requester_name: req.requester_name } : {}),
    ...(req?.requester_phone ? { requester_phone: req.requester_phone } : {}),
    ...(req?.request_passengers ? { request_passengers: req.request_passengers } : {}),
  });
  const employee =
    contact?.name?.trim() || req?.requester_name?.trim() || "Employee";
  const driver = trip.drivers?.full_name?.trim() || "Unassigned";
  const vehicle = trip.vehicles?.registration_number ?? trip.vehicles?.name;
  const href = trip.request_id
    ? ({ to: "/trips" as const, search: { request: trip.request_id } })
    : null;
  const navigate = useNavigate();

  return (
    <tr
      className={cn(href && "trip-list-table__row--link")}
      onClick={() => {
        if (!href) return;
        navigate(href);
      }}
    >
      <td className="trip-list-table__col-time">
        <WhenCell at={req?.pickup_at ?? trip.created_at} />
      </td>
      <td className="trip-list-table__col-person">
        <PersonCell {...personProps(employee, contact?.phone)} />
      </td>
      <td className="trip-list-table__col-route">
        <RouteCell {...routeProps(req?.request_route_points, req?.purpose)} />
      </td>
      <td className="trip-list-table__col-pax">
        <span
          className="trip-list-table__pax"
          title={req?.passenger_count != null ? String(req.passenger_count) : undefined}
        >
          {req?.passenger_count != null ? req.passenger_count : "—"}
        </span>
      </td>
      <td className="trip-list-table__col-person">
        <PersonCell {...personProps(driver, trip.drivers?.phone)} />
      </td>
      <td className="trip-list-table__col-vehicle">
        <span className="trip-list-table__vehicle" title={vehicle || undefined}>
          {vehicle || "—"}
        </span>
      </td>
      <td className="trip-list-table__col-status">
        <LookupChip group="trip_status" value={trip.status} />
      </td>
      {showActions ? (
        <td className="trip-list-table__col-actions text-right" onClick={(e) => e.stopPropagation()}>
          {href ? (
            <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
              <Link {...href} className="trip-list-table__link">
                Open
              </Link>
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      ) : null}
    </tr>
  );
}

/** Driver my-trips row with inline CTA. */
export function DriverTripTableRow({
  trip,
  emphasize,
}: {
  trip: TripRecord;
  emphasize?: boolean;
}) {
  const { t, isDriverPortal } = useI18n();
  const navigate = useNavigate();
  const advance = useAdvanceTrip();
  const req = trip.vehicle_requests;
  const contact = primaryContact({
    ...(req?.requester_name ? { requester_name: req.requester_name } : {}),
    ...(req?.requester_phone ? { requester_phone: req.requester_phone } : {}),
    ...(req?.request_passengers ? { request_passengers: req.request_passengers } : {}),
  });
  const passenger = contact?.name?.trim() || "Passenger";
  const cta = simplifiedDriverCta(trip.status);
  const statusKey = `tripStatus.${trip.status}` as MessageKey;
  const statusLabel = isDriverPortal
    ? t(statusKey)
    : (TRIP_STATUS[trip.status]?.label ?? trip.status);

  const ctaLabel =
    cta?.kind === "accept"
      ? t("driver.action.accept")
      : cta?.kind === "start"
        ? t("driver.action.startRide")
        : cta?.kind === "end"
          ? t("driver.action.endRide")
          : "";

  return (
    <tr
      className={cn("trip-list-table__row--link", emphasize && "trip-list-table__row--hot")}
      onClick={() => navigate({ to: "/my-trips/$tripId", params: { tripId: trip.id } })}
    >
      <td className="trip-list-table__col-time">
        <WhenCell at={req?.pickup_at ?? trip.created_at} />
      </td>
      <td className="trip-list-table__col-person">
        <PersonCell {...personProps(passenger, contact?.phone)} />
      </td>
      <td className="trip-list-table__col-route">
        <RouteCell {...routeProps(req?.request_route_points, req?.purpose)} />
      </td>
      <td className="trip-list-table__col-pax">
        <span
          className="trip-list-table__pax"
          title={req?.passenger_count != null ? String(req.passenger_count) : undefined}
        >
          {req?.passenger_count != null ? req.passenger_count : "—"}
        </span>
      </td>
      <td className="trip-list-table__col-status">
        {isDriverPortal ? (
          <StatusChip label={statusLabel} tone={TRIP_STATUS[trip.status]?.tone} />
        ) : (
          <LookupChip group="trip_status" value={trip.status} />
        )}
      </td>
      <td className="trip-list-table__col-actions text-right">
        <div className="trip-list-table__actions" onClick={(e) => e.stopPropagation()}>
          {cta ? (
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={advance.isPending}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                advance.mutate(
                  { tripId: trip.id, action: cta.action },
                  {
                    onSuccess: () => toast.success(ctaLabel),
                    onError: (err) => toast.error(err.message),
                  },
                );
              }}
            >
              {advance.isPending ? "…" : ctaLabel}
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
            <Link to="/my-trips/$tripId" params={{ tripId: trip.id }} className="trip-list-table__link">
              Open
            </Link>
          </Button>
        </div>
      </td>
    </tr>
  );
}

/** Mobile card list + desktop table pair. */
export function DualList({
  cards,
  table,
  fill = true,
}: {
  cards: ReactNode;
  table: ReactNode;
  /** When false, list hugs content (no tall empty stretch). */
  fill?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col", fill && "min-h-0 flex-1")}>
      <div className="md:hidden">{cards}</div>
      <div className={cn("hidden min-w-0 flex-col md:flex", fill && "min-h-0 flex-1")}>{table}</div>
    </div>
  );
}
