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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { MapPoint } from "@/components/trip-map";
import { useAuth } from "@/lib/auth";
import { toLocalInput } from "@/lib/fleet";
import { useLookupOptions } from "@/lib/lookups-context";
import { reverseGeocode } from "@/lib/osm";
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
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Employee new request — Plan your ride (light). */
export function EmployeeRideBooking({ initialDropId }: { initialDropId?: string }) {
  const { user, profile, session, loading } = useAuth();
  const navigate = useNavigate();
  const locations = useLocations();
  const create = useCreateRequest();
  const tripTypes = useLookupOptions("trip_type");

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
  const [busy, setBusy] = useState(false);
  const [dropSeeded, setDropSeeded] = useState(false);
  const [locating, setLocating] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const suggestRef = useRef<HTMLElement>(null);

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

  const suggestions = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = !q
      ? savedLocations
      : savedLocations.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            (l.address ?? "").toLowerCase().includes(q),
        );
    return list.slice(0, 4);
  }, [savedLocations, filter]);

  const isMulti = tripCategory === "multi_stop" || stops.length > 0;
  const isRound = tripCategory === "round_trip";

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

  function selectPlace(loc: SavedLocation) {
    const applied = applyLoc(loc);
    if (focus === "pickup") {
      setPickup({ ...pickup, ...applied });
      setFocus("drop");
      setFilter("");
      return;
    }
    if (focus?.startsWith("stop-")) {
      const idx = Number(focus.split("-")[1]);
      setStops((prev) => prev.map((s, i) => (i === idx ? { ...s, ...applied } : s)));
      setFocus("drop");
      setFilter("");
      return;
    }
    setDrop({ ...drop, ...applied });
    setFilter("");
    setFocus("drop");
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

  function showSavedPlaces() {
    setFilter("");
    setFocus((f) => f ?? "pickup");
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 900);
    requestAnimationFrame(() => {
      suggestRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
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

    const namedStops = stops.filter((s) => s.name.trim());
    const useMulti = tripCategory === "multi_stop" || namedStops.length > 0;
    const points = useMulti
      ? [
          {
            name: pickup.name,
            address: pickup.address || pickup.name,
            latitude: pickup.lat,
            longitude: pickup.lng,
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
            name: drop.name,
            address: drop.address || drop.name,
            latitude: drop.lat,
            longitude: drop.lng,
            point_type: "destination",
          },
        ]
      : [
          {
            name: pickup.name,
            address: pickup.address || pickup.name,
            latitude: pickup.lat,
            longitude: pickup.lng,
            point_type: "pickup",
          },
          {
            name: drop.name,
            address: drop.address || drop.name,
            latitude: drop.lat,
            longitude: drop.lng,
            point_type: "destination",
          },
        ];

    setBusy(true);
    try {
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
        pickupAt,
        expectedEndAt: endAtFromPickup(pickupAt, useMulti ? 3 : 2),
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

      <div className="plan-ride__route-wrap">
        <div className="plan-ride__route">
          <PlaceField
            tone="pickup"
            active={focus === "pickup"}
            value={pickup.name}
            placeholder="Pickup location"
            hint={pickup.address && pickup.placeId ? pickup.address : pickup.address || undefined}
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
            hint={drop.address && drop.placeId ? drop.address : drop.address || undefined}
            onFocus={() => {
              setFocus("drop");
              setFilter(drop.name);
            }}
            onChange={(v) => typePlace("drop", v)}
          />
        </div>
      </div>

      <div className="plan-ride__purpose">
        <Input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Purpose (meeting, airport…)"
          className="plan-ride__purpose-input"
          required
        />
      </div>

      <section
        ref={suggestRef}
        className={cn("plan-ride__suggest", savedFlash && "plan-ride__suggest--flash")}
      >
        <p className="plan-ride__suggest-label">
          {filter.trim() ? "Matches" : "Saved places"}
        </p>
        {suggestions.length === 0 ? (
          <p className="plan-ride__empty">
            {filter.trim()
              ? "No saved match — keep your typed place name, or pick from the list."
              : locations.isLoading
                ? "Loading saved places…"
                : "No saved locations yet. Type a place name above, or ask admin to add places."}
          </p>
        ) : (
          <ul className="plan-ride__suggest-list">
            {suggestions.map((loc) => (
              <li key={loc.id}>
                <button type="button" className="plan-ride__suggest-row" onClick={() => selectPlace(loc)}>
                  <span className="plan-ride__suggest-icon">
                    <Clock className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="plan-ride__suggest-name">{loc.name}</span>
                    <span className="plan-ride__suggest-addr">{loc.address || "Saved location"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="plan-ride__utils">
        <button type="button" className="plan-ride__util" onClick={showSavedPlaces}>
          <span className="plan-ride__util-icon">
            <Star className="size-4" />
          </span>
          Saved places
        </button>
        <button type="button" className="plan-ride__util" onClick={() => setMapOpen(true)}>
          <span className="plan-ride__util-icon">
            <MapPin className="size-4" />
          </span>
          Preview route on map
        </button>
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

      <Sheet open={timeOpen} onOpenChange={setTimeOpen}>
        <SheetContent side="bottom" className="plan-ride-sheet rounded-t-2xl sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Pickup time</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
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
        </SheetContent>
      </Sheet>

      <Sheet open={paxOpen} onOpenChange={setPaxOpen}>
        <SheetContent side="bottom" className="plan-ride-sheet mx-auto max-w-lg rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Passengers</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-wrap gap-2">
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
        </SheetContent>
      </Sheet>

      <Sheet open={tripOpen} onOpenChange={setTripOpen}>
        <SheetContent side="bottom" className="plan-ride-sheet mx-auto max-w-lg rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Trip type</SheetTitle>
          </SheetHeader>
          <div className="mt-3 space-y-1">
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
        </SheetContent>
      </Sheet>

      <Sheet open={mapOpen} onOpenChange={setMapOpen}>
        <SheetContent side="bottom" className="plan-ride-sheet mx-auto max-h-[85dvh] max-w-lg rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Route preview</SheetTitle>
          </SheetHeader>
          <div className="mt-3 overflow-hidden rounded-xl">
            {routeMapPoints.length >= 1 ? (
              <OsmRouteMap points={routeMapPoints} className="h-64 w-full" />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Add pickup and Where to? first.</p>
            )}
          </div>
          <Button type="button" className="mt-3 w-full" onClick={() => setMapOpen(false)}>
            Close
          </Button>
        </SheetContent>
      </Sheet>
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
