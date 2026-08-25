import { Link } from "@tanstack/react-router";
import { ChevronRight, MapPin } from "lucide-react";
import { LookupChip } from "@/components/lookup-chip";
import { ChipGroup, MetaChip, StatusChip } from "@/components/fleet-ui";
import { formatDateTime, relativeTime, TRIP_STATUS } from "@/lib/fleet";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

export type TripPreviewData = {
  id: string;
  reference: string;
  status: string;
  created_at: string;
  vehicles?: { name?: string; registration_number?: string } | null;
  vehicle_requests?: {
    purpose?: string;
    pickup_at?: string;
    passenger_count?: number;
    request_route_points?: {
      name: string;
      point_type: string;
      sequence: number;
    }[];
  } | null;
};

export function DriverTripPreview({
  trip,
  className,
  emphasize,
  showStatus = true,
}: {
  trip: TripPreviewData;
  className?: string;
  /** Highlight as primary / incoming assignment */
  emphasize?: boolean;
  /** Status chip — off on driver home (assignment already implied) */
  showStatus?: boolean;
}) {
  const { t, isDriverPortal } = useI18n();
  const request = trip.vehicle_requests;
  const points = (request?.request_route_points ?? [])
    .slice()
    .sort((a, b) => a.sequence - b.sequence);
  const pickup = points.find((p) => p.point_type === "pickup");
  const drop = points.find((p) => p.point_type === "destination");
  const pickupAt = request?.pickup_at ?? trip.created_at;
  const statusKey = `tripStatus.${trip.status}` as MessageKey;
  const statusLabel = isDriverPortal
    ? t(statusKey)
    : (TRIP_STATUS[trip.status]?.label ?? trip.status);

  return (
    <Link
      to="/my-trips/$tripId"
      params={{ tripId: trip.id }}
      className={cn(
        "block rounded-xl border transition-colors",
        emphasize
          ? "border-primary/30 bg-primary/5 hover:bg-primary/8"
          : "border-border bg-surface hover:bg-muted/40",
        className,
      )}
    >
      <div className="flex items-start gap-2 px-3 py-3 sm:px-3.5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">
              {trip.reference}
              {request?.purpose ? ` · ${request.purpose}` : ""}
            </p>
            {showStatus &&
              (isDriverPortal ? (
                <StatusChip label={statusLabel} tone={TRIP_STATUS[trip.status]?.tone} />
              ) : (
                <LookupChip group="trip_status" value={trip.status} />
              ))}
          </div>

          <ChipGroup>
            {trip.vehicles?.registration_number && (
              <MetaChip label={trip.vehicles.registration_number} tone="primary" />
            )}
            {trip.vehicles?.name && !trip.vehicles.registration_number && (
              <MetaChip label={trip.vehicles.name} tone="primary" />
            )}
            {request?.passenger_count != null && (
              <MetaChip label={t("driver.preview.pax", { count: request.passenger_count })} tone="neutral" />
            )}
          </ChipGroup>

          {(pickup || drop) && (
            <div className="space-y-0.5 text-xs text-muted-foreground">
              {pickup && (
                <p className="flex items-start gap-1.5 truncate">
                  <MapPin className="mt-0.5 size-3 shrink-0 text-success" />
                  <span className="truncate">{t("driver.preview.pickup", { name: pickup.name })}</span>
                </p>
              )}
              {drop && (
                <p className="flex items-start gap-1.5 truncate">
                  <MapPin className="mt-0.5 size-3 shrink-0 text-destructive" />
                  <span className="truncate">{t("driver.preview.drop", { name: drop.name })}</span>
                </p>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            {t("driver.preview.pickupAt", {
              when: formatDateTime(pickupAt),
              rel: relativeTime(pickupAt),
            })}
          </p>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
    </Link>
  );
}
