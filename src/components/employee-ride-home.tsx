import { Link } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  ChevronRight,
  Clock,
  Plane,
  Search,
} from "lucide-react";
import { useMemo } from "react";
import { EmployeeHomeIllustration } from "@/components/employee-home-illustration";
import { WhenRail } from "@/components/info-blocks";
import { LookupChip } from "@/components/lookup-chip";
import { Button } from "@/components/ui/button";
import { MetaChip } from "@/components/fleet-ui";
import { useAuth } from "@/lib/auth";
import { passengerLabel } from "@/lib/fleet";
import { formatBdPhone } from "@/lib/phone";
import { routeLineCompact } from "@/lib/route-summary";
import { useLocations, useRequests } from "@/lib/queries";

type SavedLocation = {
  id: string;
  name: string;
  address?: string | null;
  location_type?: string | null;
};

type RecentPlace = {
  id: string;
  locationId: string;
  title: string;
  subtitle: string;
  kind: "office" | "airport" | "place";
};

function placeIcon(kind: RecentPlace["kind"]) {
  if (kind === "office") return Briefcase;
  if (kind === "airport") return Plane;
  return Building2;
}

function guessKind(name: string, type?: string | null): RecentPlace["kind"] {
  const hay = `${name} ${type ?? ""}`.toLowerCase();
  if (hay.includes("airport") || hay.includes("বিমান")) return "airport";
  if (hay.includes("office") || hay.includes("hq") || hay.includes("head")) return "office";
  return "place";
}

/** DriveFlow-style employee home: map card, Where to?, recent places. */
export function EmployeeRideHome() {
  const { profile, user } = useAuth();
  const mine = useRequests(user?.id ? { requesterId: user.id } : undefined);
  const locations = useLocations();

  const rows = mine.data ?? [];
  const saved = (locations.data ?? []) as SavedLocation[];

  const activeRide = [...rows]
    .filter((r) => ["assigned", "in_progress"].includes(r.status))
    .sort((a, b) => new Date(b.pickup_at).getTime() - new Date(a.pickup_at).getTime())[0];

  const waitingRide = !activeRide
    ? [...rows]
        .filter((r) => ["submitted", "approved"].includes(r.status))
        .sort((a, b) => new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime())[0]
    : undefined;

  const banner = activeRide ?? waitingRide;
  const isLive = !!activeRide;
  const driverPhone = activeRide?.drivers?.phone;

  const recent = useMemo(() => {
    return saved.slice(0, 5).map((loc) => ({
      id: `loc-${loc.id}`,
      locationId: loc.id,
      title: loc.name,
      subtitle: loc.address?.trim() || "Saved location",
      kind: guessKind(loc.name, loc.location_type),
    }));
  }, [saved]);

  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div className="ride-home">
      {banner ? (
        <div
          className={
            isLive
              ? "ride-home__active-card ride-home__active-card--live"
              : "ride-home__active-card ride-home__active-card--wait"
          }
        >
          <Link
            to="/requests/$requestId"
            params={{ requestId: banner.id }}
            className="ride-home__active-main"
          >
            <WhenRail at={banner.pickup_at} size="sm" className="ride-home__when" />
            <div className="ride-home__active-body min-w-0">
              <div className="ride-home__active-top">
                <div className="min-w-0 flex-1">
                  <p className="ride-home__active-label">
                    {isLive ? "Active" : "Pending"}
                  </p>
                  <p className="ride-home__active-title">
                    {routeLineCompact(banner.request_route_points) ?? banner.purpose ?? "Your trip"}
                  </p>
                </div>
                <LookupChip group="request_status" value={banner.status} />
              </div>
              {isLive && banner.drivers?.full_name ? (
                <div className="ride-home__driver">
                  <p className="ride-home__driver-name">{banner.drivers.full_name}</p>
                  {driverPhone ? (
                    <p className="ride-home__driver-phone">{formatBdPhone(driverPhone)}</p>
                  ) : null}
                  {banner.vehicles?.registration_number ? (
                    <div className="ride-home__driver-meta">
                      <span>{banner.vehicles.registration_number}</span>
                    </div>
                  ) : null}
                </div>
              ) : !isLive ? (
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <MetaChip label={passengerLabel(banner.passenger_count)} tone="neutral" />
                </div>
              ) : null}
            </div>
            <span className="ride-home__active-cta">
              {isLive ? "Track" : "View"}
              <ChevronRight className="size-4" />
            </span>
          </Link>
        </div>
      ) : null}

      <section className="ride-home__hero">
        <div className="ride-home__map ride-home__map--illus" aria-hidden>
          <EmployeeHomeIllustration className="ride-home__illus" />
        </div>

        <div className="ride-home__hero-body">
          <h2 className="ride-home__where">Where to?</h2>
          <p className="ride-home__where-sub">
            {firstName ? `Hi ${firstName}` : "Book a ride"}
          </p>

          <Link to="/requests/new" className="ride-home__search" aria-label="Where to? — open book page">
            <Search className="ride-home__search-icon" aria-hidden />
            <span className="ride-home__search-input ride-home__search-input--link">Where to?</span>
            <span className="ride-home__schedule" aria-hidden>
              <Clock className="size-4" />
            </span>
          </Link>

          <Button asChild className="ride-home__go mt-3 w-full sm:w-auto" size="sm">
            <Link to="/requests/new">Book ride</Link>
          </Button>
        </div>
      </section>

      <section className="ride-home__recent">
        <h3 className="ride-home__recent-title">Saved places</h3>
        {recent.length === 0 ? (
          <div className="ride-home__empty">
            <p className="font-medium text-[color:var(--ride-ink)]">No saved places yet</p>
            <p className="mt-1 text-sm text-[color:var(--ride-muted)]">
              Favorite offices and airports show up here for faster booking.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to="/requests/new">Start a request</Link>
            </Button>
          </div>
        ) : (
          <ul className="ride-home__list">
            {recent.map((place) => {
              const Icon = placeIcon(place.kind);
              return (
                <li key={place.id}>
                  <Link
                    to="/requests/new"
                    search={{ to: place.locationId }}
                    className="ride-home__row"
                  >
                    <RecentRow Icon={Icon} title={place.title} subtitle={place.subtitle} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function RecentRow({
  Icon,
  title,
  subtitle,
}: {
  Icon: typeof Briefcase;
  title: string;
  subtitle: string;
}) {
  return (
    <>
      <span className="ride-home__row-icon">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="ride-home__row-title block truncate">{title}</span>
        <span className="ride-home__row-sub block truncate">{subtitle}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-[color:var(--ride-muted)]" />
    </>
  );
}
