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
import { LookupChip } from "@/components/lookup-chip";
import { Button } from "@/components/ui/button";
import { MetaChip } from "@/components/fleet-ui";
import { useAuth } from "@/lib/auth";
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
  const mine = useRequests({ requesterId: user?.id });
  const locations = useLocations();

  const rows = mine.data ?? [];
  const saved = (locations.data ?? []) as SavedLocation[];

  const activeRide = [...rows]
    .filter((r) => ["assigned", "in_progress"].includes(r.status))
    .sort((a, b) => new Date(b.pickup_at).getTime() - new Date(a.pickup_at).getTime())[0];

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
      {activeRide ? (
        <Link
          to="/requests/$requestId"
          params={{ requestId: activeRide.id }}
          className="ride-home__active"
        >
          <div className="min-w-0 flex-1">
            <p className="ride-home__active-label">Active ride</p>
            <p className="ride-home__active-title truncate">
              {activeRide.purpose || activeRide.reference}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <LookupChip group="request_status" value={activeRide.status} />
              {activeRide.vehicles?.registration_number ? (
                <MetaChip label={activeRide.vehicles.registration_number} tone="neutral" />
              ) : null}
            </div>
          </div>
          <span className="ride-home__active-cta">
            Track
            <ChevronRight className="size-4" />
          </span>
        </Link>
      ) : null}

      <section className="ride-home__hero">
        <div className="ride-home__map ride-home__map--illus" aria-hidden>
          <EmployeeHomeIllustration className="ride-home__illus" />
        </div>

        <div className="ride-home__hero-body">
          <h2 className="ride-home__where">Where to?</h2>
          <p className="ride-home__where-sub">
            {firstName ? `Hi ${firstName} — book a fleet vehicle` : "Book a fleet vehicle for your trip"}
          </p>

          <Link to="/requests/new" className="ride-home__search" aria-label="Where to? — open book page">
            <Search className="ride-home__search-icon" aria-hidden />
            <span className="ride-home__search-input ride-home__search-input--link">Where to?</span>
            <span className="ride-home__schedule" aria-hidden>
              <Clock className="size-4" />
            </span>
          </Link>

          <Button asChild className="ride-home__go mt-3 w-full sm:w-auto" size="sm">
            <Link to="/requests/new">Request vehicle</Link>
          </Button>
        </div>
      </section>

      <section className="ride-home__recent">
        <h3 className="ride-home__recent-title">Recent</h3>
        {recent.length === 0 ? (
          <div className="ride-home__empty">
            <p className="font-medium text-[color:var(--ride-ink)]">No recent places yet</p>
            <p className="mt-1 text-sm text-[color:var(--ride-muted)]">
              Saved locations and past trip destinations show up here.
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
