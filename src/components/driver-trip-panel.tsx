import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { LiveTripMap } from "@/components/live-trip-map";
import { Panel, RouteTimeline, StatusChip } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { useAdvanceTrip, usePingTripLocation, useReportVehicleIssue } from "@/lib/queries";
import { TRIP_STATUS, formatDateTime, nextDriverActions } from "@/lib/fleet";
import type { LatLng } from "@/lib/osm";

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

/** Index of next waypoint the driver should head toward. */
function mapFocusIndex(status: string, points: TripPoint[], stopIndex = 0) {
  const pickupIdx = points.findIndex((p) => p.point_type === "pickup");
  const destIdx = points.findIndex((p) => p.point_type === "destination");
  const stopIndices = points
    .map((p, i) => (p.point_type === "stop" ? i : -1))
    .filter((i) => i >= 0);

  if (["driver_assigned", "driver_confirmed", "heading_to_pickup", "arrived_pickup"].includes(status)) {
    return Math.max(0, pickupIdx);
  }
  if (status === "return_in_transit" || status === "return_pending") {
    return Math.max(0, pickupIdx >= 0 ? pickupIdx : points.length - 1);
  }
  if (["passenger_picked_up", "in_transit", "stop_reached"].includes(status)) {
    if (stopIndex < stopIndices.length) return stopIndices[stopIndex]!;
    return Math.max(0, destIdx >= 0 ? destIdx : points.length - 1);
  }
  if (["destination_reached", "passenger_dropped"].includes(status)) {
    return Math.max(0, destIdx >= 0 ? destIdx : points.length - 1);
  }
  return Math.min(1, Math.max(0, points.length - 1));
}

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

export function DriverTripPanel({
  trip,
  driverId,
  userId,
  issue,
  onIssueChange,
  compact = false,
}: {
  trip: DriverTrip;
  driverId: string;
  userId: string;
  issue: string;
  onIssueChange: (v: string) => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const advance = useAdvanceTrip();
  const report = useReportVehicleIssue();
  const ping = usePingTripLocation();
  const lastPingAt = useRef(0);
  const lastPos = useRef<LatLng | null>(null);

  const request = trip.vehicle_requests;
  const points = (request?.request_route_points ?? []).slice().sort((a, b) => a.sequence - b.sequence);
  const hasStops = points.some((p) => p.point_type === "stop");
  const actions = nextDriverActions(trip.status, hasStops, request?.is_round_trip ?? false);
  const focusIdx = mapFocusIndex(trip.status, points, trip.current_stop_index ?? 0);
  const pickup = points.find((p) => p.point_type === "pickup");
  const drop = points.find((p) => p.point_type === "destination");
  const isActive = !["completed", "cancelled", "breakdown"].includes(trip.status);
  const statusLabel = t(`tripStatus.${trip.status}` as MessageKey);

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

  return (
    <Panel
      title={`${trip.reference} · ${request?.purpose ?? "Trip"}`}
      {...(compact
        ? {}
        : { description: t("driver.panel.assigned", { when: formatDateTime(trip.created_at) }) })}
      action={<StatusChip label={statusLabel} tone={TRIP_STATUS[trip.status]?.tone} />}
    >
      <div className="mb-3 trip-stat-grid">
        <div className="trip-stat-card">
          <Clock className="mb-1 size-3.5 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground">{t("driver.panel.pickupTime")}</p>
          <p className="font-medium leading-tight">{formatDateTime(request?.pickup_at)}</p>
        </div>
        <div className="trip-stat-card">
          <p className="text-[11px] text-muted-foreground">{t("driver.panel.vehicle")}</p>
          {trip.vehicle_id ? (
            <Link
              to="/fleet/$vehicleId"
              params={{ vehicleId: trip.vehicle_id }}
              className="font-medium hover:text-primary"
            >
              {trip.vehicles?.name ?? t("driver.panel.viewVehicle")}
            </Link>
          ) : (
            <p className="font-medium">{trip.vehicles?.name ?? "—"}</p>
          )}
          <p className="text-[11px] text-muted-foreground">{trip.vehicles?.registration_number}</p>
        </div>
        <div className="trip-stat-card">
          <p className="text-[11px] text-muted-foreground">{t("driver.panel.pickup")}</p>
          <p className="font-medium leading-tight">{pickup?.name ?? "—"}</p>
        </div>
        <div className="trip-stat-card">
          <p className="text-[11px] text-muted-foreground">{t("driver.panel.drop")}</p>
          <p className="font-medium leading-tight">{drop?.name ?? "—"}</p>
        </div>
      </div>

      <div className={compact ? "space-y-3" : "detail-split"}>
        <div>
          <p className="mb-1.5 text-[11px] text-muted-foreground">
            {t("driver.panel.passengers", {
              reg: trip.vehicles?.registration_number ?? "",
              count: request?.passenger_count ?? 0,
            })}
          </p>
          <LiveTripMap
            points={points.map((p) => ({
              name: p.name,
              ...(p.address != null ? { address: p.address } : {}),
              latitude: p.latitude,
              longitude: p.longitude,
              point_type: p.point_type,
            }))}
            focusIndex={focusIdx}
            live={isActive}
            {...(isActive ? { onPosition: handlePosition } : {})}
            markerLabel="Your location"
            className={compact ? "h-56 w-full sm:h-64 lg:h-72" : "h-56 w-full sm:h-72 lg:h-80"}
          />
          {points.length > 0 && (
            <div className="mt-4">
              <RouteTimeline
                points={points.map((p) => ({
                  name: p.name,
                  ...(p.address != null ? { address: p.address } : {}),
                  point_type: p.point_type,
                  ...(p.expected_at !== undefined ? { expected_at: p.expected_at } : {}),
                }))}
                {...(trip.current_stop_index != null
                  ? { activeIndex: trip.current_stop_index }
                  : {})}
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          {isActive && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t("driver.panel.progress")}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {actions.map((a) => {
                  const copy = actionCopy(t, a.action, trip.status, hasStops);
                  return (
                    <Button
                      key={a.action}
                      variant={a.primary ? "default" : "outline"}
                      className={compact ? "min-h-9 w-full sm:w-auto" : "min-h-11 w-full sm:w-auto"}
                      disabled={advance.isPending}
                      tooltip={copy.hint}
                      onClick={() => runAction(a.action, copy.label)}
                    >
                      {copy.label}
                    </Button>
                  );
                })}
                {actions.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t("driver.panel.noActions")}</p>
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-dashed border-border p-3">
            <p className="text-xs font-medium">{t("driver.panel.reportTitle")}</p>
            <Textarea
              rows={2}
              className="mt-2"
              placeholder={t("driver.panel.reportPlaceholder")}
              value={issue}
              onChange={(e) => onIssueChange(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-2 min-h-11 w-full sm:w-auto"
              disabled={report.isPending || !trip.vehicle_id}
              tooltip={t("driver.panel.reportTip")}
              onClick={() => {
                if (!trip.vehicle_id) return;
                report.mutate(
                  {
                    vehicleId: trip.vehicle_id,
                    driverId,
                    tripId: trip.id,
                    reason: "mechanical",
                    description: issue,
                    severity: "high",
                    actorId: userId,
                  },
                  {
                    onSuccess: () => {
                      toast.success(t("driver.panel.reported"));
                      onIssueChange("");
                    },
                    onError: (e) => toast.error(e.message),
                  },
                );
              }}
            >
              {t("driver.panel.sendReport")}
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
