import { Navigation, Phone } from "lucide-react";
import { toast } from "sonner";
import { WhenStamp, RouteFlow, formatCardDate } from "@/components/info-blocks";
import { LookupChip } from "@/components/lookup-chip";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import { useAdvanceTrip } from "@/lib/queries";
import { formatTime, formatWeekday, passengerLabel, simplifiedDriverCta } from "@/lib/fleet";
import { formatBdPhone } from "@/lib/phone";
import { trackFocusIndex } from "@/lib/ride-detail";
import { useNarrowDrawer } from "@/lib/use-narrow-drawer";
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

export type DriverTripDetail = {
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

/** Driver trip drawer — mount on /my-trips via search `trip`. */
export function DriverTripPanel({
  trip,
  open,
  onOpenChange,
}: {
  trip: DriverTripDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const narrow = useNarrowDrawer();
  const { t } = useI18n();
  const advance = useAdvanceTrip();

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

  const whenLine = request?.pickup_at
    ? [formatWeekday(request.pickup_at), formatCardDate(request.pickup_at), formatTime(request.pickup_at)]
        .filter(Boolean)
        .join(" · ")
    : null;

  const passengerTitle =
    passengers[0]?.full_name?.trim() ||
    request?.requester_name?.trim() ||
    t("driver.detail.assignment");

  function runCta() {
    if (!cta) return;
    advance.mutate(
      { tripId: trip.id, action: cta.action },
      {
        onSuccess: () => toast.success(ctaLabel),
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={narrow ? "bottom" : "right"}
        className="admin-req-drawer data-[state=open]:duration-500 data-[state=closed]:duration-300"
        overlayClassName="admin-req-drawer__overlay data-[state=open]:duration-300 data-[state=closed]:duration-200"
      >
        <SheetHeader className="admin-req-drawer__head">
          <div className="admin-req-drawer__head-top">
            <div className="admin-req-drawer__identity min-w-0">
              <SheetTitle className="admin-req-drawer__title">{passengerTitle}</SheetTitle>
              {whenLine ? <p className="admin-req-drawer__when-line">{whenLine}</p> : null}
            </div>
          </div>
          <SheetDescription className="sr-only">{t("driver.detail.assignment")}</SheetDescription>
          <div className="admin-req-drawer__head-meta">
            <div className="admin-req__chips">
              <LookupChip group="trip_status" value={trip.status} pill />
              {paxCount != null ? (
                <span className="admin-req__pill">{passengerLabel(paxCount)}</span>
              ) : null}
              {plate ? <span className="admin-req__pill">{plate}</span> : null}
              {isActive && nextStop ? (
                <span className="admin-req__pill admin-req__pill--live">
                  {nextStop.point_type === "destination"
                    ? "Final drop"
                    : nextStop.point_type === "pickup"
                      ? "Pickup"
                      : "Next stop"}
                </span>
              ) : null}
            </div>
          </div>
        </SheetHeader>

        <div className="admin-req admin-req--drawer">
          <div className="admin-req-drawer__scroll">
            {nextStop && isActive ? (
              <section className="admin-req__card driver-trip__next-card" aria-label="Next stop">
                <div className="driver-trip__next driver-trip__next--drawer">
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
                    {nextStop.address ? (
                      <p className="driver-trip__next-addr">{nextStop.address}</p>
                    ) : null}
                    {nextStop.expected_at ? (
                      <p className="driver-trip__next-due">
                        Due <WhenStamp at={nextStop.expected_at} withRelative />
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {hasRoute ? (
              <section className="admin-req__route" aria-label="Route">
                <p className="admin-req__section-label">Route</p>
                <RouteFlow points={points} {...(isActive ? { focusIndex: focusIdx } : {})} />
              </section>
            ) : null}

            {passengers.length > 0 ? (
              <section className="admin-req__card">
                <p className="admin-req__section-label">
                  Passenger{passengers.length > 1 ? "s" : ""}
                  {paxCount != null ? ` · ${paxCount}` : ""}
                </p>
                <ul className="driver-trip__pax-list driver-trip__pax-list--drawer">
                  {passengers.map((p, i) => (
                    <li key={p.id ?? `${p.full_name}-${i}`} className="driver-trip__pax">
                      <span className="driver-trip__pax-name">{p.full_name}</span>
                      {p.phone ? (
                        <span className="driver-trip__pax-phone">{formatBdPhone(p.phone)}</span>
                      ) : (
                        <span className="driver-trip__pax-miss">No phone</span>
                      )}
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

            {request?.purpose?.trim() ? (
              <div className="admin-req__facts">
                <div className="admin-req__purpose">
                  <p className="admin-req__section-label">Purpose</p>
                  <p className="admin-req__purpose-text">{request.purpose}</p>
                </div>
              </div>
            ) : null}
          </div>

          {isActive ? (
            <div className="driver-trip__drawer-cta">
              {cta ? (
                <button
                  type="button"
                  className={cn(
                    "ops-card__accept",
                    cta.kind === "end" && "ops-card__accept--end",
                    cta.kind === "start" && "ops-card__accept--start",
                  )}
                  disabled={advance.isPending}
                  title={ctaHint}
                  onClick={runCta}
                >
                  {advance.isPending ? "…" : ctaLabel}
                </button>
              ) : (
                <p className="ride-detail__muted px-3 py-2 text-center text-sm">
                  {t("driver.panel.noActions")}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
