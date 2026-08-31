import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { ArrowLeft, Car } from "lucide-react";
import { toast } from "sonner";
import { LiveTripMap } from "@/components/live-trip-map";
import { LookupChip } from "@/components/lookup-chip";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { useAdvanceTrip, usePingTripLocation } from "@/lib/queries";
import { formatDateTime, nextDriverActions } from "@/lib/fleet";
import { formatPickupLabel, pointTone, trackFocusIndex } from "@/lib/ride-detail";
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
    request_route_points?: TripPoint[];
  } | null;
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
  const isActive = !["completed", "cancelled", "breakdown"].includes(trip.status);

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
    <div className={cn("plan-ride ride-detail ride-detail--driver", isActive && "ride-detail--driver-active")}>
      <header className="plan-ride__top">
        <Link to="/my-trips" className="plan-ride__back" aria-label={t("driver.detail.back")}>
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="plan-ride__title">{t("driver.detail.assignment")}</h1>
        <span className="plan-ride__top-spacer" aria-hidden />
      </header>

      <div className="ride-detail__ref">
        <span className="ride-detail__ref-code">{trip.reference}</span>
        <LookupChip group="trip_status" value={trip.status} pill />
      </div>

      <div className="plan-ride__pills">
        {request?.pickup_at ? (
          <span className="plan-ride__pill">
            <span className="truncate">{formatPickupLabel(request.pickup_at)}</span>
          </span>
        ) : null}
        <span className="plan-ride__pill">
          <span className="truncate">
            {request?.passenger_count ?? 0}{" "}
            {(request?.passenger_count ?? 0) === 1 ? "passenger" : "passengers"}
          </span>
        </span>
        {trip.vehicles?.name ? (
          <span className="plan-ride__pill">
            <span className="truncate">{trip.vehicles.name}</span>
          </span>
        ) : null}
      </div>

      <div className="plan-ride__route-wrap">
        <div className="plan-ride__route">
          {points.length === 0 ? (
            <p className="ride-detail__muted p-3">No route points.</p>
          ) : (
            points.map((p, i) => (
              <div key={`${p.point_type}-${i}`} className="plan-ride__stop">
                <span className={cn("plan-ride__dot", `plan-ride__dot--${pointTone(p.point_type)}`)} />
                <span className="min-w-0 flex-1">
                  <span className="plan-ride__stop-name">{p.name}</span>
                  {p.address ? <span className="plan-ride__stop-addr">{p.address}</span> : null}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {request?.purpose ? (
        <div className="ride-detail__purpose">
          <p className="ride-detail__purpose-label">Purpose</p>
          <p className="ride-detail__purpose-text">{request.purpose}</p>
        </div>
      ) : null}

      {mapPoints.length > 0 ? (
        <section className="ride-detail__map">
          <LiveTripMap
            mapOnly
            className="ride-detail__map-el"
            points={mapPoints}
            focusIndex={focusIdx}
            live={isActive}
            {...(isActive ? { onPosition: handlePosition } : {})}
            markerLabel="Your location"
          />
        </section>
      ) : null}

      <section className="ride-detail__card">
        <p className="ride-detail__card-title">{t("driver.panel.vehicle")}</p>
        <div className="ride-detail__assign-row">
          <span className="ride-detail__assign-icon">
            <Car className="size-4" />
          </span>
          <span className="min-w-0">
            {trip.vehicle_id ? (
              <Link
                to="/fleet/$vehicleId"
                params={{ vehicleId: trip.vehicle_id }}
                className="ride-detail__assign-name ride-detail__link"
              >
                {trip.vehicles?.name ?? t("driver.panel.viewVehicle")}
              </Link>
            ) : (
              <span className="ride-detail__assign-name">{trip.vehicles?.name ?? "—"}</span>
            )}
            <span className="ride-detail__assign-sub">
              {trip.vehicles?.registration_number ?? "—"}
              {request?.passenger_count != null
                ? ` · ${request.passenger_count} pax`
                : ""}
            </span>
          </span>
        </div>
        <p className="ride-detail__assign-meta">
          {t("driver.panel.assigned", { when: formatDateTime(trip.created_at) })}
        </p>
      </section>

      {isActive ? (
        <div className="ride-detail__driver-actions">
          <p className="ride-detail__card-title">{t("driver.panel.progress")}</p>
          <div className="ride-detail__action-stack">
            {actions.map((a) => {
              const copy = actionCopy(t, a.action, trip.status, hasStops);
              return (
                <Button
                  key={a.action}
                  variant={a.primary ? "default" : "outline"}
                  className={cn(
                    "ride-detail__action-btn",
                    a.primary && "ride-detail__action-btn--primary",
                  )}
                  disabled={advance.isPending}
                  tooltip={copy.hint}
                  onClick={() => runAction(a.action, copy.label)}
                >
                  {copy.label}
                </Button>
              );
            })}
            {actions.length === 0 ? (
              <p className="ride-detail__muted">{t("driver.panel.noActions")}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
