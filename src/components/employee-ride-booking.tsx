import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock,
  LocateFixed,
  MapPin,
  Plus,
  Star,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { OsmRouteMap } from "@/components/osm-route-map";
import { PlaceMapPicker } from "@/components/place-map-picker";
import { PlanRideChooser } from "@/components/plan-ride-chooser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MapPoint } from "@/components/trip-map";
import { useAuth } from "@/lib/auth";
import { toLocalInput, localInputToIso } from "@/lib/fleet";
import { useIsDesktopLg } from "@/hooks/use-desktop-lg";
import { useLookupOptions } from "@/lib/lookups-context";
import { reverseGeocode, searchPlaces, type NominatimResult } from "@/lib/osm";
import { normalizeBdPhone } from "@/lib/phone";
import { useCreateRequest, useLocations } from "@/lib/queries";
import { cn } from "@/lib/utils";

type SavedLocation = {
  id: string;
  name: string;
  address: string;
  latitude: number | string | null;
  longitude: number | string | null;
};

type RouteStopDraft = {
  id: string;
  placeId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

type FocusField = "pickup" | "drop" | `stop-${number}` | null;

function newStop(): RouteStopDraft {
  return {
    id: crypto.randomUUID(),
    placeId: "",
    name: "",
    address: "",
    lat: null,
    lng: null,
  };
}

function toCoord(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function applyLoc(loc: SavedLocation) {
  return {
    placeId: loc.id,
    name: loc.name,
    address: loc.address,
    lat: toCoord(loc.latitude),
    lng: toCoord(loc.longitude),
  };
}

function endAtFromPickup(pickupAt: string, hours = 2): string {
  const d = new Date(pickupAt);
  if (Number.isNaN(d.getTime())) return toLocalInput(new Date(Date.now() + hours * 3600_000));
  return toLocalInput(new Date(d.getTime() + hours * 3600_000));
}

function formatPickupLabel(pickupAt: string): string {
  const d = new Date(pickupAt);
  if (Number.isNaN(d.getTime())) return "Schedule";
  const now = new Date();
  const diffMin = (d.getTime() - now.getTime()) / 60_000;
  if (diffMin >= -5 && diffMin <= 45) return "Pickup soon";
  return d.toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function applySearchResult(result: NominatimResult, fallbackName: string) {
  const lat = Number(result.lat);
  const lng = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const shortName = result.display_name.split(",")[0]?.trim() || fallbackName;
  return {
    placeId: "",
    name: shortName,
    address: result.display_name,
    lat,
    lng,
  };
}

async function resolveStopCoords(stop: RouteStopDraft): Promise<RouteStopDraft> {
  if (stop.lat != null && stop.lng != null) return stop;
  const q = stop.name.trim();
  if (!q) return stop;
  const hits = await searchPlaces(q, 1);
  const applied = hits[0] ? applySearchResult(hits[0], q) : null;
  return applied ? { ...stop, ...applied } : stop;
}

/** Employee new request — Plan your ride (light). */
export function EmployeeRideBooking({ initialDropId }: { initialDropId?: string }) {
  const { user, profile, session, loading } = useAuth();
  const navigate = useNavigate();
  const locations = useLocations();
  const create = useCreateRequest();
  const tripTypes = useLookupOptions("trip_type");
  const isDesktop = useIsDesktopLg();

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const now = new Date();
  const [tripCategory, setTripCategory] = useState(tripTypes[0]?.value_key ?? "one_way");
  const [pickupAt, setPickupAt] = useState(toLocalInput(new Date(now.getTime() + 3600_000)));
  const [passengerCount, setPassengerCount] = useState(1);
  const [purpose, setPurpose] = useState("");
  const [pickup, setPickup] = useState(newStop());
  const [drop, setDrop] = useState(newStop());
  const [stops, setStops] = useState<RouteStopDraft[]>([]);
  const [focus, setFocus] = useState<FocusField>("pickup");
  const [filter, setFilter] = useState("");
  const [timeOpen, setTimeOpen] = useState(false);
  const [paxOpen, setPaxOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dropSeeded, setDropSeeded] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);

  const savedLocations = (locations.data ?? []) as SavedLocation[];

  useEffect(() => {
    if (dropSeeded || !initialDropId || !savedLocations.length) return;
    const loc = savedLocations.find((l) => l.id === initialDropId);
    if (!loc) return;
    setDrop({ id: crypto.randomUUID(), ...applyLoc(loc) });
    setFocus("pickup");
    setFilter("");
    setDropSeeded(true);
  }, [initialDropId, savedLocations, dropSeeded]);

  useEffect(() => {
    const q = filter.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(() => {
      void searchPlaces(q, 5).then((rows) => {
        setSearchResults(rows);
        setSearching(false);
      });
    }, 400);
    return () => clearTimeout(t);
  }, [filter]);

  const savedSuggestions = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return savedLocations.slice(0, 6);
    const tokens = q.split(/\s+/).filter(Boolean);
    const scored = savedLocations
      .map((l) => {
        const name = l.name.toLowerCase();
        const addr = (l.address ?? "").toLowerCase();
        const hay = `${name} ${addr}`;
        if (!tokens.every((t) => hay.includes(t))) return null;
        let score = 0;
        if (name.startsWith(q)) score += 40;
        if (name.includes(q)) score += 20;
        if (addr.includes(q)) score += 8;
        tokens.forEach((t) => {
          if (name.startsWith(t)) score += 10;
          if (name.includes(t)) score += 5;
        });
        return { loc: l, score };
      })
      .filter((x): x is { loc: SavedLocation; score: number } => x != null)
      .sort((a, b) => b.score - a.score || a.loc.name.localeCompare(b.loc.name));
    return scored.slice(0, 6).map((x) => x.loc);
  }, [savedLocations, filter]);

  const isSearching = filter.trim().length >= 2;

  const isMulti = tripCategory === "multi_stop" || stops.length > 0;
  const isRound = tripCategory === "round_trip";

  const placesReady =
    pickup.lat != null &&
    pickup.lng != null &&
    drop.lat != null &&
    drop.lng != null &&
    (!isMulti ||
      stops.every((s) => !s.name.trim() || (s.lat != null && s.lng != null)));

  /** Hide saved/search lists once route is set — show again only while typing/editing. */
  const showSuggest = isSearching || !placesReady;

  const routeMapPoints: MapPoint[] = (() => {
    const pts: MapPoint[] = [];
    if (pickup.name.trim()) {
      pts.push({
        name: pickup.name,
        address: pickup.address,
        latitude: pickup.lat,
        longitude: pickup.lng,
        point_type: "pickup",
      });
    }
    for (const s of stops) {
      if (!s.name.trim()) continue;
      pts.push({
        name: s.name,
        address: s.address,
        latitude: s.lat,
        longitude: s.lng,
        point_type: "stop",
      });
    }
    if (drop.name.trim()) {
      pts.push({
        name: drop.name,
        address: drop.address,
        latitude: drop.lat,
        longitude: drop.lng,
        point_type: "destination",
      });
    }
    return pts;
  })();

  /** While typing, plot Nominatim hits so aside map never goes blank. */
  const mapPreviewPoints: MapPoint[] = (() => {
    if (isSearching && searchResults.length > 0) {
      return searchResults.slice(0, 5).map((r, i) => ({
        name: r.display_name.split(",")[0]?.trim() || r.display_name,
        address: r.display_name,
        latitude: Number(r.lat),
        longitude: Number(r.lon),
        point_type: i === 0 ? "pickup" : "stop",
      }));
    }
    return routeMapPoints;
  })();

  function applyPlace(
    field: FocusField,
    place: { placeId?: string; name: string; address: string; lat: number; lng: number },
  ) {
    const draft = {
      placeId: place.placeId ?? "",
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    };
    if (field === "pickup") {
      setPickup((p) => ({ ...p, ...draft }));
      setFilter("");
      // If drop already set, collapse picker; else move to drop
      setFocus(drop.lat != null && drop.lng != null ? null : "drop");
      return;
    }
    if (field?.startsWith("stop-")) {
      const idx = Number(field.split("-")[1]);
      setStops((prev) => prev.map((s, i) => (i === idx ? { ...s, ...draft } : s)));
      setFilter("");
      setFocus(drop.lat != null && drop.lng != null ? null : "drop");
      return;
    }
    if (field === "drop") {
      setDrop((d) => ({ ...d, ...draft }));
      setFilter("");
      setFocus(null);
    }
  }

  function selectPlace(loc: SavedLocation) {
    const applied = applyLoc(loc);
    if (!applied.lat || !applied.lng) {
      toast.error("This saved place has no map coordinates");
      return;
    }
    applyPlace(focus, { ...applied, lat: applied.lat, lng: applied.lng });
  }

  function selectSearchResult(result: NominatimResult) {
    const applied = applySearchResult(result, filter.trim());
    if (!applied || !focus) return;
    applyPlace(focus, applied);
  }

  function confirmMapPick(place: { name: string; address: string; lat: number; lng: number }) {
    if (!focus) return;
    applyPlace(focus, place);
    toast.success("Location set on map");
  }

  function mapPickerSeed(): { lat: number | null; lng: number | null } {
    if (focus === "pickup") return { lat: pickup.lat, lng: pickup.lng };
    if (focus === "drop") return { lat: drop.lat, lng: drop.lng };
    if (focus?.startsWith("stop-")) {
      const idx = Number(focus.split("-")[1]);
      const stop = stops[idx];
      return stop ? { lat: stop.lat, lng: stop.lng } : { lat: null, lng: null };
    }
    return { lat: null, lng: null };
  }

  function mapPickerTitle() {
    if (focus === "pickup") return "Set pickup on map";
    if (focus === "drop") return "Set destination on map";
    if (focus?.startsWith("stop-")) return `Set stop ${Number(focus.split("-")[1]) + 1} on map`;
    return "Set location on map";
  }

  function mapPickerTone(): "pickup" | "stop" | "drop" {
    if (focus === "drop") return "drop";
    if (focus?.startsWith("stop-")) return "stop";
    return "pickup";
  }

  function typePlace(field: FocusField, value: string) {
    if (!field) return;
    setFilter(value);
    setFocus(field);
    if (field === "pickup") {
      setPickup((p) => ({
        ...p,
        name: value,
        address: "",
        placeId: "",
        lat: null,
        lng: null,
      }));
      return;
    }
    if (field.startsWith("stop-")) {
      const idx = Number(field.split("-")[1]);
      setStops((prev) =>
        prev.map((s, i) =>
          i === idx
            ? { ...s, name: value, address: "", placeId: "", lat: null, lng: null }
            : s,
        ),
      );
      return;
    }
    if (field === "drop") {
      setDrop((d) => ({
        ...d,
        name: value,
        address: "",
        placeId: "",
        lat: null,
        lng: null,
      }));
    }
  }

  function addStop() {
    setTripCategory("multi_stop");
    setStops((prev) => {
      const next = [...prev, newStop()];
      setFocus(`stop-${next.length - 1}`);
      return next;
    });
    setFilter("");
  }

  function detectPickupLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Location not supported on this device");
      return;
    }
    setLocating(true);
    setFocus("pickup");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const full = await reverseGeocode(lat, lng);
          const shortName = full?.split(",")[0]?.trim() || "Current location";
          setPickup({
            id: crypto.randomUUID(),
            placeId: "",
            name: shortName,
            address: full ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            lat,
            lng,
          });
          setFilter("");
          setLocating(false);
          toast.success("Pickup set from your location");
        })();
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Allow location access to fill pickup");
        } else {
          toast.error("Could not detect location — try again");
        }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }

  function removeStop(index: number) {
    setStops((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0 && tripCategory === "multi_stop") {
        setTripCategory(tripTypes.find((t) => t.value_key === "one_way")?.value_key ?? "one_way");
      }
      return next;
    });
    setFocus("drop");
  }

  async function submit() {
    if (!user) return;
    if (!pickup.name.trim()) {
      toast.error("Choose a pickup place");
      setFocus("pickup");
      return;
    }
    if (!drop.name.trim()) {
      toast.error("Enter where you're going");
      setFocus("drop");
      return;
    }
    if (!purpose.trim()) {
      toast.error("Add a short purpose for the trip");
      return;
    }
    const phone = normalizeBdPhone(profile?.phone ?? "");
    if (!phone) {
      toast.error("Add a Bangladesh mobile number to your profile first");
      return;
    }

    setBusy(true);
    try {
      const resolvedPickup = await resolveStopCoords(pickup);
      const resolvedDrop = await resolveStopCoords(drop);
      const resolvedStops = await Promise.all(stops.map((s) => resolveStopCoords(s)));
      setPickup(resolvedPickup);
      setDrop(resolvedDrop);
      setStops(resolvedStops);

      const namedStops = resolvedStops.filter((s) => s.name.trim());
      const useMulti = tripCategory === "multi_stop" || namedStops.length > 0;
      const points = useMulti
        ? [
            {
              name: resolvedPickup.name,
              address: resolvedPickup.address || resolvedPickup.name,
              latitude: resolvedPickup.lat,
              longitude: resolvedPickup.lng,
              point_type: "pickup",
            },
            ...namedStops.map((s) => ({
              name: s.name,
              address: s.address || s.name,
              latitude: s.lat,
              longitude: s.lng,
              point_type: "stop",
            })),
            {
              name: resolvedDrop.name,
              address: resolvedDrop.address || resolvedDrop.name,
              latitude: resolvedDrop.lat,
              longitude: resolvedDrop.lng,
              point_type: "destination",
            },
          ]
        : [
            {
              name: resolvedPickup.name,
              address: resolvedPickup.address || resolvedPickup.name,
              latitude: resolvedPickup.lat,
              longitude: resolvedPickup.lng,
              point_type: "pickup",
            },
            {
              name: resolvedDrop.name,
              address: resolvedDrop.address || resolvedDrop.name,
              latitude: resolvedDrop.lat,
              longitude: resolvedDrop.lng,
              point_type: "destination",
            },
          ];

      const res = await create.mutateAsync({
        requesterId: user.id,
        requesterName: profile?.full_name || "Employee",
        requesterPhone: phone,
        departmentId: null,
        costCenter: "",
        purpose: purpose.trim(),
        tripType: useMulti ? "multi_stop" : tripCategory,
        priority: "normal",
        requestedCategory: null,
        passengerCount,
        pickupAt: localInputToIso(pickupAt),
        expectedEndAt: localInputToIso(endAtFromPickup(pickupAt, useMulti ? 3 : 2)),
        journeyDate: pickupAt.slice(0, 10),
        isRoundTrip: !useMulti && isRound,
        returnPickupAt: null,
        returnExpectedEndAt: null,
        requiresAc: true,
        specialRequirements: "",
        remarks: "",
        points,
        passengers: [],
      });
      toast.success(`Request ${res.reference} sent`);
      void navigate({ to: "/requests/$requestId", params: { requestId: res.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit request");
    } finally {
      setBusy(false);
    }
  }

  const tripLabel =
    tripTypes.find((t) => t.value_key === tripCategory)?.label ??
    (isMulti ? "Multi-stop" : isRound ? "Round trip" : "One way");

  return (
    <div className="plan-ride">
      <header className="plan-ride__top">
        <Link to="/dashboard" className="plan-ride__back" aria-label="Back">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="plan-ride__title">Plan your ride</h1>
        <span className="plan-ride__top-spacer" aria-hidden />
      </header>

      <div className="plan-ride__body">
        <div className="plan-ride__form">
          {isDesktop ? (
            <div className="plan-ride__meta-desk" aria-label="Ride options">
              <label className="plan-ride__meta-field">
                <span className="plan-ride__meta-label">Date</span>
                <Input
                  type="date"
                  value={pickupAt.slice(0, 10)}
                  onChange={(e) => {
                    const date = e.target.value || pickupAt.slice(0, 10);
                    const time = pickupAt.slice(11, 16) || "09:00";
                    setPickupAt(`${date}T${time}`);
                  }}
                  className="plan-ride__meta-input"
                />
              </label>
              <label className="plan-ride__meta-field">
                <span className="plan-ride__meta-label">Time</span>
                <Input
                  type="time"
                  value={pickupAt.slice(11, 16) || "09:00"}
                  onChange={(e) => {
                    const date = pickupAt.slice(0, 10) || toLocalInput(new Date()).slice(0, 10);
                    const time = e.target.value || "09:00";
                    setPickupAt(`${date}T${time}`);
                  }}
                  className="plan-ride__meta-input"
                />
              </label>
              <div className="plan-ride__meta-field plan-ride__meta-field--pax">
                <span className="plan-ride__meta-label">Passengers</span>
                <div className="plan-ride__meta-stepper" role="group" aria-label="Passenger count">
                  <button
                    type="button"
                    className="plan-ride__meta-step"
                    aria-label="Fewer passengers"
                    disabled={passengerCount <= 1}
                    onClick={() => setPassengerCount((n) => Math.max(1, n - 1))}
                  >
                    −
                  </button>
                  <span className="plan-ride__meta-step-val">{passengerCount}</span>
                  <button
                    type="button"
                    className="plan-ride__meta-step"
                    aria-label="More passengers"
                    disabled={passengerCount >= 20}
                    onClick={() => setPassengerCount((n) => Math.min(20, n + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
              <label className="plan-ride__meta-field plan-ride__meta-field--trip">
                <span className="plan-ride__meta-label">Trip type</span>
                <select
                  className="plan-ride__meta-select"
                  value={tripCategory}
                  onChange={(e) => {
                    const key = e.target.value;
                    setTripCategory(key);
                    if (key === "multi_stop" && stops.length === 0) {
                      setStops([newStop()]);
                      setFocus("stop-0");
                    }
                    if (key !== "multi_stop") setStops([]);
                  }}
                >
                  {tripTypes.map((opt) => (
                    <option key={opt.value_key} value={opt.value_key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <div className="plan-ride__pills">
              <button type="button" className="plan-ride__pill" onClick={() => setTimeOpen(true)}>
                <Clock className="size-3.5 shrink-0" />
                <span className="truncate">{formatPickupLabel(pickupAt)}</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-70" />
              </button>
              <button type="button" className="plan-ride__pill" onClick={() => setPaxOpen(true)}>
                <Users className="size-3.5 shrink-0" />
                <span className="truncate">
                  {passengerCount} {passengerCount === 1 ? "passenger" : "passengers"}
                </span>
                <ChevronDown className="size-3.5 shrink-0 opacity-70" />
              </button>
              <button type="button" className="plan-ride__pill" onClick={() => setTripOpen(true)}>
                <span className="truncate">{tripLabel}</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-70" />
              </button>
            </div>
          )}

          <div className="plan-ride__route-wrap">
            <div className="plan-ride__route">
              <PlaceField
                tone="pickup"
                active={focus === "pickup"}
                value={pickup.name}
                placeholder="Pickup location"
                hint={pickup.address || undefined}
                onFocus={() => {
                  setFocus("pickup");
                  setFilter(pickup.name);
                }}
                onChange={(v) => typePlace("pickup", v)}
              />
              <button
                type="button"
                className="plan-ride__locate"
                disabled={locating}
                onClick={detectPickupLocation}
              >
                <LocateFixed className={cn("size-3.5 shrink-0", locating && "animate-pulse")} />
                {locating ? "Detecting location…" : "Use my current location"}
              </button>

              {stops.map((stop, index) => (
                <div key={stop.id} className="plan-ride__stop-row">
                  <PlaceField
                    tone="stop"
                    active={focus === `stop-${index}`}
                    value={stop.name}
                    placeholder={`Stop ${index + 1}`}
                    onFocus={() => {
                      setFocus(`stop-${index}`);
                      setFilter(stop.name);
                    }}
                    onChange={(v) => typePlace(`stop-${index}`, v)}
                  />
                  <button
                    type="button"
                    className="plan-ride__remove-stop"
                    aria-label={`Remove stop ${index + 1}`}
                    onClick={() => removeStop(index)}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}

              {isMulti ? (
                <button type="button" className="plan-ride__add-inside" onClick={addStop}>
                  <Plus className="size-4 shrink-0" />
                  Add stop
                </button>
              ) : null}

              <PlaceField
                tone="drop"
                active={focus === "drop"}
                value={drop.name}
                placeholder="Where to?"
                hint={drop.address || undefined}
                onFocus={() => {
                  setFocus("drop");
                  setFilter(drop.name);
                }}
                onChange={(v) => typePlace("drop", v)}
              />
            </div>
          </div>

          {showSuggest ? (
          <section className="plan-ride__suggest">
            {!isSearching ? (
              <>
                <p className="plan-ride__suggest-label">Saved places</p>
                {locations.isLoading ? (
                  <p className="plan-ride__empty">Loading saved places…</p>
                ) : savedSuggestions.length === 0 ? (
                  <p className="plan-ride__empty">
                    No saved locations yet. Search a place or set one on the map.
                  </p>
                ) : (
                  <ul className="plan-ride__suggest-list">
                    {savedSuggestions.map((loc) => (
                      <li key={loc.id}>
                        <button
                          type="button"
                          className="plan-ride__suggest-row"
                          onClick={() => selectPlace(loc)}
                        >
                          <span className="plan-ride__suggest-icon plan-ride__suggest-icon--saved">
                            <Star className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1 text-left">
                            <span className="plan-ride__suggest-name">{loc.name}</span>
                            <span className="plan-ride__suggest-addr">
                              {loc.address || "Saved location"}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="plan-ride__suggest-stack">
                <div className="plan-ride__suggest-card">
                  <p className="plan-ride__suggest-label">
                    {searching ? "Searching map…" : "Map results"}
                    {!searching && searchResults.length > 0 ? (
                      <span className="plan-ride__suggest-count">{searchResults.length}</span>
                    ) : null}
                  </p>
                  {searching && searchResults.length === 0 ? (
                    <p className="plan-ride__empty plan-ride__empty--tight">Looking up places…</p>
                  ) : searchResults.length === 0 ? (
                    <p className="plan-ride__empty plan-ride__empty--tight">
                      No map matches — try another spelling or set on map.
                    </p>
                  ) : (
                    <ul className="plan-ride__suggest-list">
                      {searchResults.map((result, i) => (
                        <li key={`search-${result.lat}-${result.lon}-${i}`}>
                          <button
                            type="button"
                            className="plan-ride__suggest-row"
                            onClick={() => selectSearchResult(result)}
                          >
                            <span className="plan-ride__suggest-icon">
                              <MapPin className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1 text-left">
                              <span className="plan-ride__suggest-name">
                                {result.display_name.split(",")[0]?.trim() || result.display_name}
                              </span>
                              <span className="plan-ride__suggest-addr">{result.display_name}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="plan-ride__suggest-card">
                  <p className="plan-ride__suggest-label">
                    Saved places
                    {savedSuggestions.length > 0 ? (
                      <span className="plan-ride__suggest-count">{savedSuggestions.length}</span>
                    ) : null}
                  </p>
                  {savedSuggestions.length === 0 ? (
                    <p className="plan-ride__empty plan-ride__empty--tight">
                      No saved match for “{filter.trim()}”.
                    </p>
                  ) : (
                    <ul className="plan-ride__suggest-list">
                      {savedSuggestions.map((loc) => (
                        <li key={loc.id}>
                          <button
                            type="button"
                            className="plan-ride__suggest-row"
                            onClick={() => selectPlace(loc)}
                          >
                            <span className="plan-ride__suggest-icon plan-ride__suggest-icon--saved">
                              <Star className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1 text-left">
                              <span className="plan-ride__suggest-name">{loc.name}</span>
                              <span className="plan-ride__suggest-addr">
                                {loc.address || "Saved location"}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>
          ) : null}

          <div className="plan-ride__actions">
            <div className="plan-ride__purpose">
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Purpose (meeting, airport…)"
                className="plan-ride__purpose-input"
                required
              />
            </div>

            {!isDesktop ? (
              <div className="plan-ride__utils">
                {focus ? (
                  <button
                    type="button"
                    className="plan-ride__util"
                    onClick={() => setMapPickerOpen(true)}
                  >
                    <span className="plan-ride__util-icon">
                      <MapPin className="size-4" />
                    </span>
                    Set on map
                  </button>
                ) : null}
                <button
                  type="button"
                  className="plan-ride__util plan-ride__util--map-mobile"
                  onClick={() => setMapOpen(true)}
                >
                  <span className="plan-ride__util-icon">
                    <MapPin className="size-4" />
                  </span>
                  Preview route on map
                </button>
              </div>
            ) : null}

            <div className="plan-ride__footer">
              <Button
                type="button"
                className="plan-ride__submit"
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? "Submitting…" : "Request vehicle"}
              </Button>
            </div>
          </div>
        </div>

        <aside className="plan-ride__aside">
          <section className="plan-ride__map-card" aria-label="Route preview">
            {isDesktop && mapPickerOpen ? (
              <PlaceMapPicker
                variant="panel"
                open={mapPickerOpen}
                onOpenChange={setMapPickerOpen}
                title={mapPickerTitle()}
                tone={mapPickerTone()}
                initialLat={mapPickerSeed().lat}
                initialLng={mapPickerSeed().lng}
                onConfirm={confirmMapPick}
              />
            ) : (
              <>
                <div className="plan-ride__map-card-head">
                  <p className="plan-ride__aside-label">Route preview</p>
                  {focus ? (
                    <button
                      type="button"
                      className="plan-ride__map-pick"
                      onClick={() => setMapPickerOpen(true)}
                    >
                      Set pin on map
                    </button>
                  ) : null}
                </div>
                <OsmRouteMap
                  points={mapPreviewPoints}
                  className="plan-ride__map-el"
                  showSummary={!isSearching}
                  drawRoute={!isSearching}
                  emptyHint={
                    isSearching
                      ? searching
                        ? "Searching places…"
                        : "Tap a result to place it on the map"
                      : "Add pickup and drop — or set a pin"
                  }
                />
              </>
            )}
          </section>
        </aside>
      </div>

      {!isDesktop ? (
        <PlaceMapPicker
          variant="sheet"
          open={mapPickerOpen}
          onOpenChange={setMapPickerOpen}
          title={mapPickerTitle()}
          tone={mapPickerTone()}
          initialLat={mapPickerSeed().lat}
          initialLng={mapPickerSeed().lng}
          onConfirm={confirmMapPick}
        />
      ) : null}

      {!isDesktop ? (
        <>
          <PlanRideChooser open={timeOpen} onOpenChange={setTimeOpen} title="Pickup time">
            <div className="space-y-3">
              <div className="plan-ride-sheet__time-row">
                <Input
                  type="date"
                  value={pickupAt.slice(0, 10)}
                  onChange={(e) => {
                    const date = e.target.value || pickupAt.slice(0, 10);
                    const time = pickupAt.slice(11, 16) || "09:00";
                    setPickupAt(`${date}T${time}`);
                  }}
                  className="plan-ride-sheet__input"
                  aria-label="Pickup date"
                />
                <Input
                  type="time"
                  value={pickupAt.slice(11, 16) || "09:00"}
                  onChange={(e) => {
                    const date = pickupAt.slice(0, 10) || toLocalInput(new Date()).slice(0, 10);
                    const time = e.target.value || "09:00";
                    setPickupAt(`${date}T${time}`);
                  }}
                  className="plan-ride-sheet__input"
                  aria-label="Pickup time"
                />
              </div>
              <Button type="button" className="w-full" onClick={() => setTimeOpen(false)}>
                Done
              </Button>
            </div>
          </PlanRideChooser>

          <PlanRideChooser open={paxOpen} onOpenChange={setPaxOpen} title="Passengers">
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={cn("plan-ride-sheet__chip", passengerCount === n && "is-active")}
                  onClick={() => {
                    setPassengerCount(n);
                    setPaxOpen(false);
                  }}
                >
                  {n}
                  {passengerCount === n ? <Check className="size-3.5" /> : null}
                </button>
              ))}
            </div>
          </PlanRideChooser>

          <PlanRideChooser open={tripOpen} onOpenChange={setTripOpen} title="Trip type">
            <div className="space-y-1">
              {tripTypes.map((opt) => {
                const active = tripCategory === opt.value_key;
                return (
                  <button
                    key={opt.value_key}
                    type="button"
                    className={cn("plan-ride-sheet__option", active && "is-active")}
                    onClick={() => {
                      setTripCategory(opt.value_key);
                      if (opt.value_key === "multi_stop" && stops.length === 0) {
                        setStops([newStop()]);
                        setFocus("stop-0");
                      }
                      if (opt.value_key !== "multi_stop") setStops([]);
                      setTripOpen(false);
                    }}
                  >
                    <span>{opt.label}</span>
                    {active ? <Check className="size-4" /> : null}
                  </button>
                );
              })}
            </div>
          </PlanRideChooser>

          <PlanRideChooser open={mapOpen} onOpenChange={setMapOpen} title="Route preview" wide>
            <div className="overflow-hidden rounded-xl border border-[var(--pr-border)]">
              <OsmRouteMap
                points={mapPreviewPoints}
                className="h-64 w-full"
                showSummary={!isSearching}
                drawRoute={!isSearching}
                emptyHint="Add pickup and Where to? — or search a place"
              />
            </div>
            <Button type="button" className="mt-3 w-full" onClick={() => setMapOpen(false)}>
              Close
            </Button>
          </PlanRideChooser>
        </>
      ) : null}
    </div>
  );
}

function PlaceField({
  tone,
  active,
  value,
  placeholder,
  hint,
  onFocus,
  onChange,
}: {
  tone: "pickup" | "stop" | "drop";
  active: boolean;
  value: string;
  placeholder: string;
  hint?: string;
  onFocus: () => void;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!active) return;
    inputRef.current?.focus();
  }, [active]);

  return (
    <label className={cn("plan-ride__stop", active && "plan-ride__stop--active")}>
      <span className={cn("plan-ride__dot", `plan-ride__dot--${tone}`)} />
      <span className="min-w-0 flex-1">
        <input
          ref={inputRef}
          type="text"
          className="plan-ride__place-input"
          value={value}
          placeholder={placeholder}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          enterKeyHint="next"
        />
        {hint ? <span className="plan-ride__stop-addr">{hint}</span> : null}
      </span>
    </label>
  );
}
