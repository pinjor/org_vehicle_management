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
import { RequestMirrorCard } from "@/components/trip-mirror-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useLocations, useRequests, type RequestRow } from "@/lib/queries";

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

const LIVE_STATUSES = new Set(["in_progress"]);
const WAIT_STATUSES = new Set(["submitted", "approved", "assigned"]);

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

function pickupTime(r: RequestRow) {
  const t = new Date(r.pickup_at).getTime();
  return Number.isFinite(t) ? t : Number.NaN;
}

/** Soonest upcoming by pickup; if none upcoming, least-overdue past. Never by created_at. */
function nearestByPickup(rows: RequestRow[]) {
  const valid = rows.filter((r) => Number.isFinite(pickupTime(r)));
  if (valid.length === 0) return rows[0] ?? null;

  const now = Date.now();
  const upcoming = valid
    .filter((r) => pickupTime(r) >= now)
    .sort((a, b) => pickupTime(a) - pickupTime(b));
  if (upcoming[0]) return upcoming[0];

  return [...valid].sort((a, b) => pickupTime(b) - pickupTime(a))[0] ?? null;
}

/** Live trip if any; else nearest pending/assigned by pickup time. */
function pickDashboardBanner(rows: RequestRow[]) {
  const live = nearestByPickup(rows.filter((r) => LIVE_STATUSES.has(r.status)));
  if (live) return live;
  return nearestByPickup(rows.filter((r) => WAIT_STATUSES.has(r.status)));
}

/** DriveFlow-style employee home: one banner row, Where to?, saved places. */
export function EmployeeRideHome() {
  const { profile, user } = useAuth();
  const mine = useRequests(user?.id ? { requesterId: user.id } : undefined);
  const locations = useLocations();

  const rows = mine.data ?? [];
  const saved = (locations.data ?? []) as SavedLocation[];
  const ride = useMemo(() => pickDashboardBanner(rows), [rows]);

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
      {ride ? (
        <div className="ride-home__banner-table">
          <RequestMirrorCard request={ride} mode="employee" />
        </div>
      ) : null}

      <section className="ride-home__hero">
        <div className="ride-home__map ride-home__map--illus" aria-hidden>
          <EmployeeHomeIllustration className="ride-home__illus" />
        </div>

        <div className="ride-home__hero-body">
          <h2 className="ride-home__where">Where to?</h2>
          <p className="ride-home__where-sub">
            {firstName ? `Hi ${firstName} — book another ride anytime` : "Book a ride anytime"}
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
