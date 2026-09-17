import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { AdminPendingActions } from "@/components/admin-pending-actions";
import { LookupChip } from "@/components/lookup-chip";
import { StatusChip } from "@/components/fleet-ui";
import {
  ListPersonCell,
  ListRouteCell,
  ListWhenCell,
} from "@/components/trip-list-table";
import { Button } from "@/components/ui/button";
import {
  passengerLabel,
  TRIP_STATUS,
  simplifiedDriverCta,
} from "@/lib/fleet";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { primaryContact } from "@/lib/route-summary";
import { useAdvanceTrip, type RequestRow, type TripRecord } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Card shell that mirrors trip-list-table columns (when | person | route | pax | status | actions). */
function MirrorShell({
  to,
  params,
  search,
  className,
  emphasize,
  children,
  footer,
}: {
  to: "/trips" | "/requests" | "/my-trips";
  params?: never;
  search?: { request: string } | { trip: string };
  className?: string;
  emphasize?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={cn("trip-mirror", emphasize && "trip-mirror--hot", className)}>
      <Link
        to={to}
        {...(search ? { search } : {})}
        className="trip-mirror__main"
      >
        {children}
        <span className="trip-mirror__chevron" aria-hidden>
          <ChevronRight className="size-4" />
        </span>
      </Link>
      {footer ? <div className="trip-mirror__footer">{footer}</div> : null}
    </div>
  );
}

/** Request card — same cells as RequestTableRow. */
export function RequestMirrorCard({
  request,
  mode = "employee",
  actions,
  showActions = true,
  className,
}: {
  request: RequestRow;
  mode?: "admin" | "employee";
  actions?: ReactNode;
  showActions?: boolean;
  className?: string;
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

  const person =
    mode === "admin"
      ? { name: employeeName, sub: request.requester_phone }
      : driverName
        ? { name: driverName, sub: plate }
        : { name: "Unassigned", sub: "Awaiting driver" };

  const paxTitle =
    mode === "admin"
      ? [passengerLabel(request.passenger_count), plate].filter(Boolean).join(" · ")
      : passengerLabel(request.passenger_count);
  const paxLabel =
    mode === "admin" && plate
      ? `${passengerLabel(request.passenger_count)} · ${plate}`
      : passengerLabel(request.passenger_count);

  const footer =
    pending || actions ? (
      <div className="trip-mirror__actions" onClick={(e) => e.stopPropagation()}>
        {actions}
        {pending ? <AdminPendingActions request={request} layout="row" /> : null}
        <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
          {mode === "admin" ? (
            <Link to="/trips" search={{ request: request.id }}>
              Open
            </Link>
          ) : (
            <Link to="/requests" search={{ request: request.id }}>
              Open
            </Link>
          )}
        </Button>
      </div>
    ) : null;

  return (
    <MirrorShell
      {...(mode === "admin"
        ? { to: "/trips" as const, search: { request: request.id } }
        : {
            to: "/requests" as const,
            search: { request: request.id },
          })}
      {...(className ? { className } : {})}
      {...(footer ? { footer } : {})}
    >
      <div className="trip-mirror__when">
        <ListWhenCell at={request.pickup_at} />
      </div>
      <div className="trip-mirror__person">
        <ListPersonCell name={person.name} {...(person.sub ? { sub: person.sub } : {})} />
      </div>
      <div className="trip-mirror__route">
        <ListRouteCell
          {...(request.request_route_points ? { points: request.request_route_points } : {})}
          {...(purpose ? { fallback: purpose } : {})}
        />
      </div>
      <div className="trip-mirror__pax">
        <span className="trip-list-table__pax" title={paxTitle}>
          {paxLabel}
        </span>
      </div>
      <div className="trip-mirror__status">
        <LookupChip group="request_status" value={request.status} />
      </div>
    </MirrorShell>
  );
}

/** Driver / trip card — same cells as DriverTripTableRow. */
export function DriverTripMirrorCard({
  trip,
  emphasize,
}: {
  trip: TripRecord;
  emphasize?: boolean;
}) {
  const { t, isDriverPortal, locale } = useI18n();
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

  const paxTitle =
    req?.passenger_count != null
      ? locale === "bn"
        ? t("driver.preview.pax", { count: req.passenger_count })
        : passengerLabel(req.passenger_count)
      : undefined;
  const paxLabel =
    req?.passenger_count != null
      ? locale === "bn"
        ? t("driver.preview.pax", { count: req.passenger_count })
        : passengerLabel(req.passenger_count)
      : "—";

  const footer = cta ? (
    <div className="trip-mirror__cta" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={cn(
          "ops-card__accept",
          cta.kind === "end" && "ops-card__accept--end",
          cta.kind === "start" && "ops-card__accept--start",
        )}
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
      </button>
    </div>
  ) : null;

  return (
    <MirrorShell
      to="/my-trips"
      search={{ trip: trip.id }}
      {...(emphasize ? { emphasize: true } : {})}
      footer={footer}
    >
      <div className="trip-mirror__when">
        <ListWhenCell at={req?.pickup_at ?? trip.created_at} />
      </div>
      <div className="trip-mirror__person">
        <ListPersonCell
          name={passenger}
          {...(contact?.phone ? { sub: contact.phone } : {})}
        />
      </div>
      <div className="trip-mirror__route">
        <ListRouteCell
          {...(req?.request_route_points ? { points: req.request_route_points } : {})}
          {...(req?.purpose ? { fallback: req.purpose } : {})}
        />
      </div>
      <div className="trip-mirror__pax">
        <span className="trip-list-table__pax" title={paxTitle}>
          {paxLabel}
        </span>
      </div>
      <div className="trip-mirror__status">
        {isDriverPortal ? (
          <StatusChip label={statusLabel} tone={TRIP_STATUS[trip.status]?.tone} />
        ) : (
          <LookupChip group="trip_status" value={trip.status} />
        )}
      </div>
    </MirrorShell>
  );
}

/** Admin live/completed trip card — mirrors TripTableRow core fields. */
export function TripMirrorCard({ trip }: { trip: TripRecord }) {
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
  const href = trip.request_id;

  const body = (
    <>
      <div className="trip-mirror__when">
        <ListWhenCell at={req?.pickup_at ?? trip.created_at} />
      </div>
      <div className="trip-mirror__person">
        <ListPersonCell
          name={employee}
          {...(contact?.phone ? { sub: contact.phone } : {})}
        />
      </div>
      <div className="trip-mirror__route">
        <ListRouteCell
          {...(req?.request_route_points ? { points: req.request_route_points } : {})}
          {...(req?.purpose ? { fallback: req.purpose } : {})}
        />
      </div>
      <div className="trip-mirror__pax">
        <span
          className="trip-list-table__pax"
          title={
            req?.passenger_count != null ? passengerLabel(req.passenger_count) : undefined
          }
        >
          {req?.passenger_count != null ? passengerLabel(req.passenger_count) : "—"}
        </span>
      </div>
      <div className="trip-mirror__person trip-mirror__person--secondary">
        <ListPersonCell
          name={driver}
          {...(trip.drivers?.phone ? { sub: trip.drivers.phone } : {})}
        />
      </div>
      <div className="trip-mirror__vehicle">
        <span className="trip-list-table__vehicle" title={vehicle || undefined}>
          {vehicle || "—"}
        </span>
      </div>
      <div className="trip-mirror__status">
        <LookupChip group="trip_status" value={trip.status} />
      </div>
    </>
  );

  if (!href) {
    return (
      <div className="trip-mirror trip-mirror--trip">
        <div className="trip-mirror__main trip-mirror__main--static">{body}</div>
      </div>
    );
  }

  return (
    <MirrorShell
      to="/trips"
      search={{ request: href }}
      className="trip-mirror--trip"
    >
      {body}
    </MirrorShell>
  );
}
