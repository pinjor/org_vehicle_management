import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { ArrowLeft, Navigation, Phone } from "lucide-react";
import { toast } from "sonner";
import { LiveTripMap } from "@/components/live-trip-map";
import { WhenBanner, WhenStamp } from "@/components/info-blocks";
import { LookupChip } from "@/components/lookup-chip";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { useAdvanceTrip, usePingTripLocation } from "@/lib/queries";
import { nextDriverActions } from "@/lib/fleet";
import { formatBdPhone } from "@/lib/phone";
import { pointTone, trackFocusIndex } from "@/lib/ride-detail";
import type { LatLng } from "@/lib/osm";
import { cn } from "@/lib/utils";

type TripPoint = {
  sequence: number;
  name: string;
  address?: string;
  latitude: number | null;
  longitude: number | null;
  point_type: string;
  expected_at?: string | null;
};

type DriverTrip = {
  id: string;
  reference: string;
  status: string;
  created_at: string;
  vehicle_id?: string;
  current_stop_index?: number;
  vehicles?: { name?: string; registration_number?: string; seat_capacity?: number } | null;
  vehicle_requests?: {
    purpose?: string;
    pickup_at?: string;
    passenger_count?: number;
    is_round_trip?: boolean;
    requester_name?: string | null;
    requester_phone?: string | null;
    request_route_points?: TripPoint[];
    request_passengers?: { id?: string; full_name: string; phone?: string | null; is_primary?: boolean }[];
  } | null;
};

type Pax = {
  id?: string;
  full_name: string;
  phone?: string | null;
  is_primary?: boolean;
};

function actionCopy(
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
  action: string,
  status: string,
  hasStops: boolean,
): { label: string; hint: string } {
  if (action === "depart" && status === "stop_reached") {
    return { label: t("driver.action.departContinue"), hint: t("driver.action.departContinueHint") };
  }
  if (action === "reach_destination" && hasStops && status === "in_transit") {
    return {
      label: t("driver.action.reach_destinationFinal"),
      hint: t("driver.action.reach_destinationFinalHint"),
    };
  }
  if (action === "complete" && status === "return_in_transit") {
    return { label: t("driver.action.complete"), hint: t("driver.action.completeReturnHint") };
  }
  const labelKey = `driver.action.${action}` as MessageKey;
  const hintKey = `driver.action.${action}Hint` as MessageKey;
  return { label: t(labelKey), hint: t(hintKey) };
}

/**
 * Driver trip detail — road-first:
 * When → next stop → passengers + call → map → route (collapsed) → one big CTA
 */
export function DriverTripPanel({ trip }: { trip: DriverTrip }) {
  const { t } = useI18n();
  const advance = useAdvanceTrip();
  const ping = usePingTripLocation();
  const lastPingAt = useRef(0);
  const lastPos = useRef<LatLng | null>(null);

  const request = trip.vehicle_requests;
  const points = (request?.request_route_points ?? []).slice().sort((a, b) => a.sequence - b.sequence);
  const hasStops = points.some((p) => p.point_type === "stop");
  const actions = nextDriverActions(trip.status, hasStops, request?.is_round_trip ?? false);
  const focusIdx = trackFocusIndex(trip.status, points, trip.current_stop_index ?? 0);
  const nextStop = points[focusIdx] ?? points[0];
  const isActive = !["completed", "cancelled", "breakdown"].includes(trip.status);
  const plate = trip.vehicles?.registration_number ?? trip.vehicles?.name;
  const paxCount = request?.passenger_count;

  const namedPassengers = (request?.request_passengers ?? []).filter((p) => p.full_name?.trim());
  const passengers: Pax[] =
    namedPassengers.length > 0
      ? namedPassengers
      : request?.requester_name
        ? [
            {
              full_name: request.requester_name,
              phone: request.requester_phone ?? null,
              is_primary: true,
            },
          ]
        : [];

  const callTargets = passengers.filter((p) => !!p.phone?.trim());
  const primaryAction = actions.find((a) => a.primary) ?? actions[0];
  const secondaryActions = actions.filter((a) => a !== primaryAction);
  const primaryCopy = primaryAction
    ? actionCopy(t, primaryAction.action, trip.status, hasStops)
    : null;

  function handlePosition(pos: LatLng) {
    lastPos.current = pos;
    const now = Date.now();
    if (now - lastPingAt.current < 5_000) return;
    lastPingAt.current = now;
    ping.mutate({ tripId: trip.id, latitude: pos[0], longitude: pos[1] });
  }

  function runAction(action: string, label: string) {
    const pos = lastPos.current;
    const payload = pos ? { latitude: pos[0], longitude: pos[1] } : undefined;
    advance.mutate(
      payload ? { tripId: trip.id, action, payload } : { tripId: trip.id, action },
      {
        onSuccess: () => toast.success(label),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  const mapPoints = points.map((p) => ({
    name: p.name,
    ...(p.address != null ? { address: p.address } : {}),
    latitude: p.latitude,
    longitude: p.longitude,
    point_type: p.point_type,
  }));

  return (
    <div
      className={cn(
        "plan-ride ride-detail ride-detail--driver",
        isActive && "ride-detail--driver-active",
      )}
    >
      <header className="plan-ride__top">
        <Link to="/my-trips" className="plan-ride__back" aria-label={t("driver.detail.back")}>
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="plan-ride__title">{t("driver.detail.assignment")}</h1>
        <span className="plan-ride__top-spacer" aria-hidden />
      </header>

      <div className="driver-trip__status-row">
        <LookupChip group="trip_status" value={trip.status} pill />
        <span className="driver-trip__ref">{trip.reference}</span>
      </div>

      {request?.pickup_at ? <WhenBanner at={request.pickup_at} className="driver-trip__when" /> : null}

      {nextStop && isActive ? (
        <section className="driver-trip__next" aria-label="Next stop">
          <div className="driver-trip__next-icon" aria-hidden>
            <Navigation className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="driver-trip__next-label">Next stop</p>
            <p className="driver-trip__next-name">{nextStop.name}</p>
            {nextStop.address ? <p className="driver-trip__next-addr">{nextStop.address}</p> : null}
            {nextStop.expected_at ? (
              <p className="driver-trip__next-due">
                Due <WhenStamp at={nextStop.expected_at} withRelative />
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="ride-detail__desk driver-trip__desk">
        <div className="ride-detail__desk-main driver-trip__main">
          {passengers.length > 0 ? (
            <section className="driver-trip__people">
              <p className="driver-trip__section-label">
                Passenger{passengers.length > 1 ? "s" : ""}
                {paxCount != null ? ` · ${paxCount}` : ""}
              </p>
              <ul className="driver-trip__pax-list">
                {passengers.map((p, i) => (
                  <li key={p.id ?? `${p.full_name}-${i}`} className="driver-trip__pax">
                    <span className="driver-trip__pax-name">{p.full_name}</span>
                    {!p.phone ? <span className="driver-trip__pax-miss">No phone</span> : null}
                  </li>
                ))}
              </ul>
              {isActive && callTargets.length > 0 ? (
                <div
                  className={cn(
                    "driver-trip__calls",
                    callTargets.length > 1 && "driver-trip__calls--split",
                  )}
                >
                  {callTargets.map((p, i) => (
                    <a
                      key={p.id ?? `call-${i}`}
                      href={`tel:${p.phone}`}
                      className="driver-trip__call"
                    >
                      <Phone className="size-4 shrink-0" />
                      <span className="driver-trip__call-text">
                        Call {p.full_name.split(" ")[0] || "passenger"}
                      </span>
                      <span className="driver-trip__call-num">{formatBdPhone(p.phone!)}</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {points.length > 0 ? (
            <details className="driver-trip__route">
              <summary className="driver-trip__route-sum">
                Full route · {points.length} stops
              </summary>
              <div className="plan-ride__route">
                {points.map((p, i) => (
                  <div
                    key={`${p.point_type}-${i}`}
                    className={cn("plan-ride__stop", i === focusIdx && "plan-ride__stop--focus")}
                  >
                    <span className={cn("plan-ride__dot", `plan-ride__dot--${pointTone(p.point_type)}`)} />
                    <span className="min-w-0 flex-1">
                      <span className="plan-ride__stop-name">
                        {p.name}
                        {i === focusIdx && isActive ? (
                          <span className="plan-ride__stop-now"> · now</span>
                        ) : null}
                      </span>
                      {p.address ? <span className="plan-ride__stop-addr">{p.address}</span> : null}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          {[plate, paxCount != null ? `${paxCount} pax` : null, request?.purpose].some(Boolean) ? (
            <p className="driver-trip__meta">
              {[plate, paxCount != null ? `${paxCount} pax` : null, request?.purpose]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>

        {mapPoints.length > 0 ? (
          <aside className="ride-detail__desk-aside driver-trip__aside" aria-label="Live map">
            <section className="ride-detail__map driver-trip__map">
              <LiveTripMap
                mapOnly
                className="ride-detail__map-el driver-trip__map-el"
                points={mapPoints}
                focusIndex={focusIdx}
                live={isActive}
                {...(isActive ? { onPosition: handlePosition } : {})}
                markerLabel="Your location"
              />
            </section>
          </aside>
        ) : null}
      </div>

      {isActive ? (
        <div className="ride-detail__driver-actions driver-trip__actions">
          {primaryAction && primaryCopy ? (
            <Button
              variant="default"
              className="ride-detail__action-btn ride-detail__action-btn--primary driver-trip__cta"
              disabled={advance.isPending}
              tooltip={primaryCopy.hint}
              onClick={() => runAction(primaryAction.action, primaryCopy.label)}
            >
              {primaryCopy.label}
            </Button>
          ) : (
            <p className="ride-detail__muted">{t("driver.panel.noActions")}</p>
          )}
          {secondaryActions.length > 0 ? (
            <div className="driver-trip__secondary">
              {secondaryActions.map((a) => {
                const copy = actionCopy(t, a.action, trip.status, hasStops);
                return (
                  <Button
                    key={a.action}
                    variant="outline"
                    className="ride-detail__action-btn"
                    disabled={advance.isPending}
                    tooltip={copy.hint}
                    onClick={() => runAction(a.action, copy.label)}
                  >
                    {copy.label}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
