import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, Navigation, Phone, Wrench } from "lucide-react";
import { toast } from "sonner";
import { LiveTripMap } from "@/components/live-trip-map";
import { ReportVehicleIssueDialog } from "@/components/report-vehicle-issue-dialog";
import { WhenBanner, WhenStamp, RouteFlow } from "@/components/info-blocks";
import { LookupChip } from "@/components/lookup-chip";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useAdvanceTrip, usePingTripLocation } from "@/lib/queries";
import { passengerLabel, simplifiedDriverCta } from "@/lib/fleet";
import { formatBdPhone } from "@/lib/phone";
import { trackFocusIndex } from "@/lib/ride-detail";
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
  driver_id?: string;
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

/**
 * Driver trip detail — road-first:
 * When → next stop → passengers + call → map → Accept / Start / End CTA
 */
export function DriverTripPanel({ trip }: { trip: DriverTrip }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const advance = useAdvanceTrip();
  const ping = usePingTripLocation();
  const lastPingAt = useRef(0);
  const lastPos = useRef<LatLng | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const request = trip.vehicle_requests;
  const points = (request?.request_route_points ?? []).slice().sort((a, b) => a.sequence - b.sequence);
  const hasRoute = points.some((p) => p.name?.trim());
  const focusIdx = trackFocusIndex(trip.status, points, trip.current_stop_index ?? 0);
  const nextStop = points[focusIdx] ?? points[0];
  const cta = simplifiedDriverCta(trip.status);
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

  function handlePosition(pos: LatLng) {
    lastPos.current = pos;
    const now = Date.now();
    if (now - lastPingAt.current < 5_000) return;
    lastPingAt.current = now;
    ping.mutate({ tripId: trip.id, latitude: pos[0], longitude: pos[1] });
  }

  function runCta() {
    if (!cta) return;
    const pos = lastPos.current;
    const payload = pos ? { latitude: pos[0], longitude: pos[1] } : undefined;
    advance.mutate(
      payload ? { tripId: trip.id, action: cta.action, payload } : { tripId: trip.id, action: cta.action },
      {
        onSuccess: () => toast.success(ctaLabel),
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
        <Link to="/dashboard" className="plan-ride__back" aria-label={t("driver.detail.back")}>
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

      {hasRoute ? (
        <div className="driver-trip__where">
          <RouteFlow points={points} {...(isActive ? { focusIndex: focusIdx } : {})} />
        </div>
      ) : null}

      {nextStop && isActive ? (
        <section className="driver-trip__next" aria-label="Next stop">
          <div className="driver-trip__next-icon" aria-hidden>
            <Navigation className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="driver-trip__next-label">
              {nextStop.point_type === "destination"
                ? "Final drop"
                : nextStop.point_type === "pickup"
                  ? "Pickup"
                  : "Next stop"}
            </p>
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

          {[plate, paxCount != null ? passengerLabel(paxCount) : null].some(Boolean) ? (
            <p className="driver-trip__meta">
              {[plate, paxCount != null ? passengerLabel(paxCount) : null]
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
          {trip.vehicle_id ? (
            <Button
              type="button"
              variant="outline"
              className="ride-detail__action-btn"
              onClick={() => setReportOpen(true)}
            >
              <Wrench className="size-4" />
              {t("driver.action.reportIssue")}
            </Button>
          ) : null}
          {cta ? (
            <Button
              variant={cta.kind === "end" ? "destructive" : "default"}
              className={cn(
                "ride-detail__action-btn ride-detail__action-btn--primary driver-trip__cta",
                cta.kind === "end" && "driver-trip__cta--end",
              )}
              disabled={advance.isPending}
              tooltip={ctaHint}
              onClick={runCta}
            >
              {advance.isPending ? "…" : ctaLabel}
            </Button>
          ) : (
            <p className="ride-detail__muted">{t("driver.panel.noActions")}</p>
          )}
        </div>
      ) : null}

      {trip.vehicle_id && user ? (
        <ReportVehicleIssueDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          vehicleId={trip.vehicle_id}
          driverId={trip.driver_id ?? null}
          tripId={trip.id}
          {...(plate ? { vehicleLabel: plate } : {})}
        />
      ) : null}
    </div>
  );
}
