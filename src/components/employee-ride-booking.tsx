import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  LocateFixed,
  MapPin,
  Plus,
  Star,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PlaceMapPicker } from "@/components/place-map-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { toLocalInput, localInputToIso, passengerLabel } from "@/lib/fleet";
import { useIsDesktopLg } from "@/hooks/use-desktop-lg";
import { useLookupOptions } from "@/lib/lookups-context";
import { reverseGeocode, searchPlaces, type NominatimResult } from "@/lib/osm";
import { normalizeBdPhone } from "@/lib/phone";
import { useCreateRequest, useLocations } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { routeLineCompact } from "@/lib/route-summary";

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

/** Works on http://LAN-IP — crypto.randomUUID needs secure context and throws otherwise. */
function draftId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* insecure context (mobile LAN http) */
  }
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function newStop(): RouteStopDraft {
  return {
    id: draftId(),
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
export function EmployeeRideBooking({ initialDropId }: { initialDropId?: string | undefined }) {
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
  const [focus, setFocus] = useState<FocusField>(null);
  const [filter, setFilter] = useState("");
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dropSeeded, setDropSeeded] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [metaStep, setMetaStep] = useState<"date" | "time" | "pax" | "trip" | "done">("date");

  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const paxRef = useRef<HTMLDivElement>(null);
  const tripRef = useRef<HTMLSelectElement>(null);

  const savedLocations = (locations.data ?? []) as SavedLocation[];

  function openMetaPicker(el: HTMLInputElement | null) {
    if (!el) return;
    el.focus();
    try {
      el.showPicker?.();
    } catch {
      /* showPicker can throw outside a user gesture in some browsers */
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => openMetaPicker(dateRef.current), 60);
    return () => clearTimeout(t);
  }, []);

  function advanceMeta(from: "date" | "time" | "pax" | "trip") {
    if (from === "date") {
      setMetaStep("time");
      window.setTimeout(() => openMetaPicker(timeRef.current), 80);
      return;
    }
    if (from === "time") {
      setMetaStep("pax");
      return;
    }
    if (from === "pax") {
      setMetaStep("trip");
      return;
    }
    setMetaStep("done");
    setFocus((f) => f ?? "pickup");
  }

  useEffect(() => {
    if (dropSeeded || !initialDropId || !savedLocations.length) return;
    const loc = savedLocations.find((l) => l.id === initialDropId);
    if (!loc) return;
    setDrop({ id: draftId(), ...applyLoc(loc) });
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

  const tripTypeLabel =
    tripTypes.find((t) => t.value_key === tripCategory)?.label ?? tripCategory;
  const routePreview =
    routeLineCompact([
      { name: pickup.name, sequence: 0, point_type: "pickup" },
      ...stops.map((s, i) => ({
        name: s.name,
        sequence: i + 1,
        point_type: "stop",
      })),
      { name: drop.name, sequence: stops.length + 1, point_type: "destination" },
    ]) || null;

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
            id: draftId(),
            placeId: "",
            name: shortName,
            address: full ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            lat,
            lng,
          });
          setFilter("");
          setMetaStep("done");
          // Advance to next place field after filling pickup
          if (tripCategory === "multi_stop" || stops.length > 0) {
            const emptyStopIdx = stops.findIndex((s) => !s.name.trim());
            setFocus(emptyStopIdx >= 0 ? `stop-${emptyStopIdx}` : "drop");
          } else {
            setFocus("drop");
          }
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
          <div className="plan-ride__meta-desk" aria-label="Ride options">
            <label className="plan-ride__meta-field">
              <span className="plan-ride__meta-label">Date</span>
              <Input
                ref={dateRef}
                type="date"
                value={pickupAt.slice(0, 10)}
                onChange={(e) => {
                  const date = e.target.value || pickupAt.slice(0, 10);
                  const time = pickupAt.slice(11, 16) || "09:00";
                  setPickupAt(`${date}T${time}`);
                  if (e.target.value) advanceMeta("date");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    advanceMeta("date");
                  }
                }}
                className="plan-ride__meta-input"
              />
            </label>
            <label className="plan-ride__meta-field">
              <span className="plan-ride__meta-label">Time</span>
              <Input
                ref={timeRef}
                type="time"
                value={pickupAt.slice(11, 16) || "09:00"}
                onChange={(e) => {
                  const date = pickupAt.slice(0, 10) || toLocalInput(new Date()).slice(0, 10);
                  const time = e.target.value || "09:00";
                  setPickupAt(`${date}T${time}`);
                  if (e.target.value) advanceMeta("time");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    advanceMeta("time");
                  }
                }}
                className="plan-ride__meta-input"
              />
            </label>
            <div
              ref={paxRef}
              tabIndex={0}
              className="plan-ride__meta-field plan-ride__meta-field--pax"
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "+") {
                  e.preventDefault();
                  setPassengerCount((n) => Math.min(20, n + 1));
                } else if (e.key === "ArrowDown" || e.key === "-") {
                  e.preventDefault();
                  setPassengerCount((n) => Math.max(1, n - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  advanceMeta("pax");
                }
              }}
            >
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
                  onClick={() => {
                    setPassengerCount((n) => Math.min(20, n + 1));
                  }}
                >
                  +
                </button>
              </div>
            </div>
            <label className="plan-ride__meta-field plan-ride__meta-field--trip">
              <span className="plan-ride__meta-label">Trip type</span>
              <select
                ref={tripRef}
                className="plan-ride__meta-select"
                value={tripCategory}
                onChange={(e) => {
                  const key = e.target.value;
                  setTripCategory(key);
                  if (key === "multi_stop" && stops.length === 0) {
                    setStops([newStop()]);
                  }
                  if (key !== "multi_stop") setStops([]);
                  advanceMeta("trip");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    advanceMeta("trip");
                  }
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

          <div className="plan-ride__route-wrap">
            <div className="plan-ride__route">
              <PlaceField
                tone="pickup"
                active={focus === "pickup"}
                value={pickup.name}
                placeholder="Pickup location"
                {...(pickup.address ? { hint: pickup.address } : {})}
                onFocus={() => {
                  setMetaStep("done");
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
                      setMetaStep("done");
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
                {...(drop.address ? { hint: drop.address } : {})}
                onFocus={() => {
                  setMetaStep("done");
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
            </div>

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

        <aside className="plan-ride__aside" aria-label="Trip summary">
          {isDesktop ? (
            <section className="plan-ride__summary-card">
              <header className="plan-ride__summary-head">
                <p className="plan-ride__aside-label">Trip summary</p>
                <span className="plan-ride__summary-glow" aria-hidden />
              </header>
              {!pickup.name.trim() &&
              !drop.name.trim() &&
              !purpose.trim() &&
              stops.every((s) => !s.name.trim()) ? (
                <p className="plan-ride__summary-empty">
                  Details appear here as you fill the form.
                </p>
              ) : null}
              <div className="plan-ride__summary-chips">
                <div className="plan-ride__summary-chip plan-ride__summary-chip--when plan-ride__summary-row--in">
                  <span className="plan-ride__summary-chip-k">When</span>
                  <span className="plan-ride__summary-chip-v">
                    {pickupAt.slice(0, 10)} · {pickupAt.slice(11, 16) || "09:00"}
                  </span>
                </div>
                <div className="plan-ride__summary-chip plan-ride__summary-chip--pax plan-ride__summary-row--in">
                  <span className="plan-ride__summary-chip-k">Passengers</span>
                  <span className="plan-ride__summary-chip-v">
                    {passengerLabel(passengerCount)}
                  </span>
                </div>
                <div className="plan-ride__summary-chip plan-ride__summary-chip--type plan-ride__summary-row--in">
                  <span className="plan-ride__summary-chip-k">Type</span>
                  <span className="plan-ride__summary-chip-v">{tripTypeLabel}</span>
                </div>
              </div>
              {(pickup.name.trim() ||
                drop.name.trim() ||
                stops.some((s) => s.name.trim())) && (
                <ol className="plan-ride__summary-route">
                  {pickup.name.trim() ? (
                    <li className="plan-ride__summary-stop plan-ride__summary-stop--pickup plan-ride__summary-row--in">
                      <span className="plan-ride__summary-dot" aria-hidden />
                      <div className="plan-ride__summary-stop-copy">
                        <span className="plan-ride__summary-stop-k">Pickup</span>
                        <span
                          className="plan-ride__summary-stop-v"
                          title={pickup.address || pickup.name}
                        >
                          {pickup.name}
                        </span>
                      </div>
                    </li>
                  ) : null}
                  {stops
                    .filter((s) => s.name.trim())
                    .map((s, i) => (
                      <li
                        key={s.id}
                        className="plan-ride__summary-stop plan-ride__summary-stop--mid plan-ride__summary-row--in"
                      >
                        <span className="plan-ride__summary-dot" aria-hidden />
                        <div className="plan-ride__summary-stop-copy">
                          <span className="plan-ride__summary-stop-k">
                            Stop {i + 1}
                          </span>
                          <span
                            className="plan-ride__summary-stop-v"
                            title={s.address || s.name}
                          >
                            {s.name}
                          </span>
                        </div>
                      </li>
                    ))}
                  {drop.name.trim() ? (
                    <li className="plan-ride__summary-stop plan-ride__summary-stop--drop plan-ride__summary-row--in">
                      <span className="plan-ride__summary-dot" aria-hidden />
                      <div className="plan-ride__summary-stop-copy">
                        <span className="plan-ride__summary-stop-k">Drop-off</span>
                        <span
                          className="plan-ride__summary-stop-v"
                          title={drop.address || drop.name}
                        >
                          {drop.name}
                        </span>
                      </div>
                    </li>
                  ) : null}
                </ol>
              )}
              {routePreview && pickup.name.trim() && drop.name.trim() ? (
                <p
                  className="plan-ride__summary-line plan-ride__summary-row--in"
                  title={routePreview}
                >
                  {routePreview}
                </p>
              ) : null}
              {purpose.trim() ? (
                <div className="plan-ride__summary-purpose plan-ride__summary-row--in">
                  <span className="plan-ride__summary-chip-k">Purpose</span>
                  <span className="plan-ride__summary-purpose-v">{purpose.trim()}</span>
                </div>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>

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
