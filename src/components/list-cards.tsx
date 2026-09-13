import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronRight, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { LookupChip } from "@/components/lookup-chip";
import { StatusChip } from "@/components/fleet-ui";
import { WhenRail } from "@/components/info-blocks";
import { passengerLabel, TRIP_STATUS, simplifiedDriverCta } from "@/lib/fleet";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { formatBdPhone } from "@/lib/phone";
import { primaryContact, routeEndpoints, routeLineCompact, type RoutePointLike } from "@/lib/route-summary";
import { useAdvanceTrip, type RequestRow, type TripRecord } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Ops list card — each fact once:
 * When → concrete label → title → people → meta → route (if not already title) → call bar
 */

type Person = {
  role: string;
  name: string;
  /** Omit = no phone UI. string = show number (+ call bar when open). null = "No phone". */
  phone?: string | null;
};

function OpsCardShell({
  to,
  params,
  className,
  children,
  emphasize,
  trailing,
  footer,
}: {
  to?: LinkProps["to"];
  params?: LinkProps["params"];
  className?: string;
  children: ReactNode;
  emphasize?: boolean;
  trailing?: ReactNode;
  footer?: ReactNode;
}) {
  const shellClass = cn(
    "ops-card",
    emphasize && "ops-card--hot",
    trailing && "ops-card--action",
    className,
  );

  const main = to ? (
    <Link to={to} {...(params !== undefined ? { params } : {})} className="ops-card__main">
      {children}
      <ChevronRight className="ops-card__chevron" aria-hidden />
    </Link>
  ) : (
    <div className="ops-card__main">{children}</div>
  );

  return (
    <div className={cn("ops-card-wrap", trailing && "ops-card-wrap--action")}>
      <div className={shellClass}>
        {main}
        {footer}
        {trailing ? <div className="ops-card__actions">{trailing}</div> : null}
      </div>
    </div>
  );
}

function OpsBody({
  when,
  label,
  title,
  badges,
  people,
  meta,
  route,
  reference,
  routeBeforePeople = false,
}: {
  when?: string | null;
  label?: string;
  title: string;
  badges?: ReactNode;
  people: Person[];
  meta?: ReactNode;
  route?: ReactNode;
  reference?: string;
  /** Driver cards: show A → B before passenger. */
  routeBeforePeople?: boolean;
}) {
  const peopleBlock =
    people.length > 0 ? (
      <div
        className={cn(
          "ops-card__people",
          people.length === 1 && "ops-card__people--solo",
        )}
      >
        {people.map((p) => (
          <div key={`${p.role}-${p.name}`} className="ops-card__person">
            <p className="ops-card__person-role">{p.role}</p>
            <p className="ops-card__person-name">{p.name}</p>
            {"phone" in p ? (
              p.phone ? (
                <p className="ops-card__person-phone">{formatBdPhone(p.phone)}</p>
              ) : (
                <p className="ops-card__person-miss">No phone</p>
              )
            ) : null}
          </div>
        ))}
      </div>
    ) : null;
  const routeBlock = route ? <div className="ops-card__route">{route}</div> : null;

  return (
    <>
      <WhenRail at={when ?? null} size="sm" className="ops-card__when" />
      <div className="ops-card__body min-w-0 flex-1">
        <div className="ops-card__head">
          <div className="min-w-0 flex-1">
            {label ? <p className="ops-card__label">{label}</p> : null}
            <p className="ops-card__title">{title}</p>
          </div>
          {badges ? <div className="ops-card__badges">{badges}</div> : null}
        </div>

        {routeBeforePeople ? (
          <>
            {routeBlock}
            {peopleBlock}
          </>
        ) : (
          <>
            {peopleBlock}
            {routeBlock}
          </>
        )}

        {meta ? <div className="ops-card__meta">{meta}</div> : null}
        {reference ? <p className="ops-card__ref">{reference}</p> : null}
      </div>
    </>
  );
}

function CallBars({ people }: { people: Person[] }) {
  const withPhone = people.filter(
    (p): p is Person & { phone: string } => !!p.phone?.trim(),
  );
  if (withPhone.length === 0) return null;
  return (
    <div className={cn("ops-card__calls", withPhone.length > 1 && "ops-card__calls--split")}>
      {withPhone.map((p) => (
        <a
          key={`${p.role}-call`}
          href={`tel:${p.phone}`}
          className="ops-card__call"
          onClick={(e) => e.stopPropagation()}
        >
          <Phone className="size-3.5 shrink-0" />
          <span className="ops-card__call-text">
            Call {p.name.split(" ")[0] || p.role}
          </span>
          <span className="ops-card__call-num">{formatBdPhone(p.phone)}</span>
        </a>
      ))}
    </div>
  );
}

function MetaBits({ items }: { items: Array<ReactNode | null | undefined | false> }) {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return null;
  return (
    <>
      {clean.map((item, i) => (
        <span key={i} className="ops-card__meta-bit">
          {i > 0 ? <span className="ops-card__meta-sep" aria-hidden>
            ·
          </span> : null}
          {item}
        </span>
      ))}
    </>
  );
}

function purposeTitle(
  purpose: string | null | undefined,
  fallback: string,
): string {
  const p = purpose?.trim();
  return p || fallback;
}

function driverTripLabel(status: string, emphasize?: boolean): string {
  if (emphasize) return "Next trip";
  switch (status) {
    case "driver_assigned":
    case "driver_confirmed":
      return "New trip";
    case "heading_to_pickup":
    case "arrived_pickup":
      return "To pickup";
    case "passenger_picked_up":
    case "in_transit":
    case "stop_reached":
      return "On the way";
    case "destination_reached":
    case "passenger_dropped":
      return "At drop-off";
    case "return_pending":
    case "return_in_transit":
      return "Return trip";
    case "completed":
      return "Finished";
    case "cancelled":
    case "breakdown":
      return "Ended";
    default:
      return "Your trip";
  }
}

/** Card route: A → B → C (multi-stop included). */
function RouteOnce({
  points,
  pickup,
  drop,
}: {
  points?: RoutePointLike[] | null;
  pickup?: { name: string } | null;
  drop?: { name: string } | null;
}) {
  const line =
    routeLineCompact(points) ??
    (pickup?.name && drop?.name
      ? `${pickup.name} → ${drop.name}`
      : pickup?.name?.trim() || drop?.name?.trim() || null);
  if (!line) return null;
  return <p className="ops-card__route-line route-line">{line}</p>;
}

/** Driver — where + who first (concrete), not abstract purpose-only. */
export function DriverAssignmentCard({
  trip,
  emphasize,
  showStatus = true,
}: {
  trip: TripRecord;
  emphasize?: boolean;
  showStatus?: boolean;
}) {
  const { t, isDriverPortal, locale } = useI18n();
  const advance = useAdvanceTrip();
  const request = trip.vehicle_requests;
  const routePoints = request?.request_route_points;
  const contact = primaryContact({
    ...(request?.requester_name ? { requester_name: request.requester_name } : {}),
    ...(request?.requester_phone ? { requester_phone: request.requester_phone } : {}),
    ...(request?.request_passengers
      ? { request_passengers: request.request_passengers }
      : {}),
  });
  const pickupAt = request?.pickup_at ?? trip.created_at;
  const statusKey = `tripStatus.${trip.status}` as MessageKey;
  const statusLabel = isDriverPortal
    ? t(statusKey)
    : (TRIP_STATUS[trip.status]?.label ?? trip.status);
  const where = routeLineCompact(routePoints);
  // Route once as title (A → B → C). No purpose, no second route block.
  const title = where || trip.reference;
  const passengerName = contact?.name?.trim() || "Passenger";
  const people: Person[] = [
    {
      role: "Passenger",
      name: passengerName,
      phone: contact?.phone?.trim() || null,
    },
  ];
  const cta = simplifiedDriverCta(trip.status);
  const live = !["completed", "cancelled", "breakdown"].includes(trip.status);
  const hasPhone = people.some((p) => !!p.phone?.trim());
  const showCall = live && hasPhone;
  const showFoot = !!cta || showCall;

  const ctaLabel =
    cta?.kind === "accept"
      ? t("driver.action.accept")
      : cta?.kind === "start"
        ? t("driver.action.startRide")
        : cta?.kind === "end"
          ? t("driver.action.endRide")
          : "";
  const ctaHint =
    cta?.kind === "accept"
      ? t("driver.action.acceptHint")
      : cta?.kind === "start"
        ? t("driver.action.startRideHint")
        : cta?.kind === "end"
          ? t("driver.action.endRideHint")
          : "";

  return (
    <OpsCardShell
      to="/my-trips/$tripId"
      params={{ tripId: trip.id }}
      emphasize={!!emphasize}
      footer={
        showFoot ? (
          <div
            className={cn(
              "ops-card__foot",
              cta && showCall && "ops-card__foot--split",
            )}
          >
            {showCall ? <CallBars people={people} /> : null}
            {cta ? (
              <button
                type="button"
                className={cn(
                  "ops-card__accept",
                  cta.kind === "end" && "ops-card__accept--end",
                  cta.kind === "start" && "ops-card__accept--start",
                )}
                disabled={advance.isPending}
                aria-label={ctaHint}
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
            ) : null}
          </div>
        ) : null
      }
    >
      <OpsBody
        when={pickupAt}
        label={driverTripLabel(trip.status, emphasize)}
        title={title}
        badges={
          showStatus ? (
            isDriverPortal ? (
              <StatusChip label={statusLabel} tone={TRIP_STATUS[trip.status]?.tone} />
            ) : (
              <LookupChip group="trip_status" value={trip.status} />
            )
          ) : null
        }
        people={people}
        meta={
          <MetaBits
            items={[
              request?.passenger_count != null
                ? locale === "bn"
                  ? t("driver.preview.pax", { count: request.passenger_count })
                  : passengerLabel(request.passenger_count)
                : null,
            ]}
          />
        }
        reference={trip.reference}
      />
    </OpsCardShell>
  );
}

/** Employee — driver when assigned; route once. Phone as text, no call. */
export function EmployeeRequestCard({
  request,
}: {
  request: RequestRow & { request_route_points?: RoutePointLike[] };
}) {
  const { pickup, drop } = routeEndpoints(request.request_route_points);
  const driverName = request.drivers?.full_name?.trim() || null;
  const driverPhone = request.drivers?.phone?.trim() || null;
  const plate = request.vehicles?.registration_number ?? request.vehicles?.name;
  const assigned = !!(driverName || plate);
  const title = purposeTitle(request.purpose, "Your trip");
  const people: Person[] =
    assigned && driverName
      ? [
          {
            role: "Driver",
            name: driverName,
            // Always surface number when known (incl. completed). Omit key if missing — no "No phone".
            ...(driverPhone ? { phone: driverPhone } : {}),
          },
        ]
      : [];

  return (
    <OpsCardShell to="/requests/$requestId" params={{ requestId: request.id }}>
      <OpsBody
        when={request.pickup_at}
        title={title}
        badges={<LookupChip group="request_status" value={request.status} />}
        people={people}
        meta={<MetaBits items={[passengerLabel(request.passenger_count), plate]} />}
        route={<RouteOnce points={request.request_route_points} pickup={pickup} drop={drop} />}
        reference={request.reference}
      />
    </OpsCardShell>
  );
}

/** Admin request — parties once; route once. No call bar. */
export function AdminRequestCard({
  request,
  trailing,
  className,
}: {
  request: RequestRow & { request_route_points?: RoutePointLike[] };
  trailing?: ReactNode;
  className?: string;
}) {
  const { pickup, drop } = routeEndpoints(request.request_route_points);
  const employeeName = request.requester_name?.trim() || "Employee";
  const employeePhone = request.requester_phone?.trim() || null;
  const driverName = request.drivers?.full_name?.trim() || null;
  const driverPhone = request.drivers?.phone?.trim() || null;
  const plate = request.vehicles?.registration_number ?? request.vehicles?.name;
  const assigned = !!(driverName || plate);
  const title = purposeTitle(request.purpose, request.reference);

  const people: Person[] = [
    {
      role: "Employee",
      name: employeeName,
      ...(employeePhone ? { phone: employeePhone } : {}),
    },
    ...(assigned
      ? [
          {
            role: "Driver",
            name: driverName ?? "Unassigned",
            ...(driverPhone ? { phone: driverPhone } : {}),
          },
        ]
      : []),
  ];

  const label = assigned
    ? "Assigned"
    : request.status === "approved"
      ? "Assign"
      : "Pending";

  return (
    <OpsCardShell
      to="/requests/$requestId"
      params={{ requestId: request.id }}
      {...(trailing != null ? { trailing } : {})}
      {...(className ? { className } : {})}
    >
      <OpsBody
        when={request.pickup_at}
        label={label}
        title={title}
        badges={<LookupChip group="request_status" value={request.status} />}
        people={people}
        meta={<MetaBits items={[passengerLabel(request.passenger_count), plate]} />}
        route={<RouteOnce points={request.request_route_points} pickup={pickup} drop={drop} />}
        reference={request.reference}
      />
    </OpsCardShell>
  );
}

/** Admin trip — parties once; route once. No call bar. */
export function LiveTripCard({ trip }: { trip: TripRecord }) {
  const routePoints = trip.vehicle_requests?.request_route_points;
  const { pickup, drop } = routeEndpoints(routePoints);
  const driverName = trip.drivers?.full_name?.trim() || null;
  const driverPhone = trip.drivers?.phone?.trim() || null;
  const vehicle = trip.vehicles?.registration_number ?? trip.vehicles?.name;
  const pickupAt = trip.vehicle_requests?.pickup_at;
  const contact = primaryContact({
    ...(trip.vehicle_requests?.requester_name
      ? { requester_name: trip.vehicle_requests.requester_name }
      : {}),
    ...(trip.vehicle_requests?.requester_phone
      ? { requester_phone: trip.vehicle_requests.requester_phone }
      : {}),
    ...(trip.vehicle_requests?.request_passengers
      ? { request_passengers: trip.vehicle_requests.request_passengers }
      : {}),
  });
  const employeeName =
    contact?.name?.trim() ||
    trip.vehicle_requests?.requester_name?.trim() ||
    "Employee";
  const employeePhone =
    contact?.phone?.trim() || trip.vehicle_requests?.requester_phone?.trim() || null;
  const passengerCount = trip.vehicle_requests?.passenger_count;
  const purpose = trip.vehicle_requests?.purpose;
  const title = purposeTitle(purpose, trip.reference);
  const live = !["completed", "cancelled", "breakdown"].includes(trip.status);

  const people: Person[] = [
    {
      role: "Employee",
      name: employeeName,
      ...(employeePhone ? { phone: employeePhone } : {}),
    },
    {
      role: "Driver",
      name: driverName ?? "Unassigned",
      ...(driverPhone ? { phone: driverPhone } : {}),
    },
  ];

  return (
    <OpsCardShell
      to={trip.request_id ? "/requests/$requestId" : undefined}
      params={trip.request_id ? { requestId: trip.request_id } : undefined}
    >
      <OpsBody
        when={pickupAt ?? null}
        label={live ? "Live" : "Done"}
        title={title}
        badges={<LookupChip group="trip_status" value={trip.status} />}
        people={people}
        meta={<MetaBits items={[passengerCount != null ? passengerLabel(passengerCount) : null, vehicle]} />}
        route={<RouteOnce points={routePoints} pickup={pickup} drop={drop} />}
        reference={trip.reference}
      />
    </OpsCardShell>
  );
}
