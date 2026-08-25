import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  ArrowRight,
  Car,
  Check,
  ChevronDown,
  Clock,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Route as RouteIcon,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { OsmRouteMap } from "@/components/osm-route-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { MapPoint } from "@/components/trip-map";
import { useAuth } from "@/lib/auth";
import {
  categoryFitsPassengers,
  suggestCategoryForPassengers,
  toLocalInput,
  VEHICLE_CATEGORY_CAPACITY,
} from "@/lib/fleet";
import { useLookupOptions } from "@/lib/lookups-context";
import { isValidBdPhone, maskBdPhoneInput, normalizeBdPhone } from "@/lib/phone";
import { useCreateRequest, useDepartments, useLocations } from "@/lib/queries";
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
  time: string;
};

function newRouteStopDraft(time = ""): RouteStopDraft {
  return {
    id: crypto.randomUUID(),
    placeId: "",
    name: "",
    address: "",
    lat: null,
    lng: null,
    time,
  };
}

function toCoord(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function applySavedLocation(loc: SavedLocation) {
  return {
    placeId: loc.id,
    name: loc.name,
    address: loc.address,
    lat: toCoord(loc.latitude),
    lng: toCoord(loc.longitude),
  };
}

const TRIP_ICONS: Record<string, typeof ArrowRight> = {
  one_way: ArrowRight,
  round_trip: ArrowLeftRight,
  multi_stop: RouteIcon,
};

function MobileSelect({
  label,
  value,
  onChange,
  placeholder,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder ?? "Select";

  return (
    <div className="book-select">
      <span className="book-select__label">
        {label}
        {required ? " *" : ""}
      </span>
      <button
        type="button"
        className={cn("book-select__trigger", !selected && "book-select__trigger--placeholder")}
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1 truncate text-left">{display}</span>
        <ChevronDown className="book-select__chevron-static" aria-hidden />
      </button>
      {/* Keep native select for required HTML form validation (hidden) */}
      {required && (
        <select
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => {}}
        >
          <option value="">{placeholder ?? ""}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="book-select-sheet mx-auto max-h-[min(75dvh,28rem)] w-full max-w-lg rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle className="text-sm font-semibold">{label}</SheetTitle>
          </SheetHeader>
          <div className="max-h-[min(60dvh,22rem)] overflow-y-auto overscroll-contain p-2" role="listbox">
            {placeholder !== undefined && (
              <button
                type="button"
                role="option"
                aria-selected={!value}
                className={cn("book-select-option", !value && "book-select-option--active")}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate text-left text-muted-foreground">{placeholder}</span>
                {!value && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            )}
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn("book-select-option", active && "book-select-option--active")}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate text-left">{o.label}</span>
                  {active && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              );
            })}
            {options.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No options</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function parseLocalInput(value: string): { date: Date; hour: number; minute: number } | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart!.split("-").map(Number);
  const [hh, mm] = timePart!.slice(0, 5).split(":").map(Number);
  if (![y, m, d, hh, mm].every((n) => Number.isFinite(n))) return null;
  return { date: new Date(y!, m! - 1, d!), hour: hh!, minute: mm! };
}

function formatLocalDisplay(value: string): string {
  const parsed = parseLocalInput(value);
  if (!parsed) return "";
  const dateLabel = parsed.date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${dateLabel} · ${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
}

function buildLocalInput(date: Date, hour: number, minute: number): string {
  return toLocalInput(new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0));
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, delta: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + delta);
  return startOfDay(next);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Default expected end = pickup + hours (dispatch window). */
function endAtFromPickup(pickupAt: string, hours = 2): string {
  const p = parseLocalInput(pickupAt);
  if (!p) return toLocalInput(new Date(Date.now() + hours * 3600_000));
  const d = new Date(p.date.getFullYear(), p.date.getMonth(), p.date.getDate(), p.hour, p.minute);
  d.setHours(d.getHours() + hours);
  return toLocalInput(d);
}

function MobileDateTime({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseLocalInput(value);
  const [draftDate, setDraftDate] = useState<Date>(() => startOfDay(parsed?.date ?? new Date()));
  const [hour, setHour] = useState(() => parsed?.hour ?? 9);
  const [minute, setMinute] = useState(() => parsed?.minute ?? 0);
  const [hourDraft, setHourDraft] = useState(() => pad2(parsed?.hour ?? 9));
  const [minuteDraft, setMinuteDraft] = useState(() => pad2(parsed?.minute ?? 0));

  useEffect(() => {
    if (!open) return;
    const next = parseLocalInput(value);
    if (next) {
      setDraftDate(startOfDay(next.date));
      setHour(next.hour);
      setMinute(next.minute);
      setHourDraft(pad2(next.hour));
      setMinuteDraft(pad2(next.minute));
    }
  }, [open, value]);

  const display = formatLocalDisplay(value);
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const minDate = today;
  const maxDate = addDays(today, 90);
  const dateLabel = `${draftDate.toLocaleDateString(undefined, { weekday: "short" })} ${draftDate.getDate()} ${MONTH_SHORT[draftDate.getMonth()]}`;

  function shiftDay(delta: number) {
    const next = addDays(draftDate, delta);
    if (next < minDate || next > maxDate) return;
    setDraftDate(next);
  }

  function applyHour(n: number) {
    const h = ((Math.floor(n) % 24) + 24) % 24;
    setHour(h);
    setHourDraft(pad2(h));
  }

  function applyMinute(n: number) {
    const m = Math.min(59, Math.max(0, Math.floor(n)));
    setMinute(m);
    setMinuteDraft(pad2(m));
  }

  function onHourDraftChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    setHourDraft(digits);
    if (digits === "") return;
    const n = Number(digits);
    if (!Number.isFinite(n)) return;
    if (n <= 23) {
      setHour(n);
    }
  }

  function onMinuteDraftChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    setMinuteDraft(digits);
    if (digits === "") return;
    const n = Number(digits);
    if (!Number.isFinite(n)) return;
    if (n <= 59) {
      setMinute(n);
    }
  }

  function commitHourDraft() {
    if (hourDraft === "") {
      applyHour(hour);
      return;
    }
    const n = Number(hourDraft);
    applyHour(Number.isFinite(n) ? n : hour);
  }

  function commitMinuteDraft() {
    if (minuteDraft === "") {
      applyMinute(minute);
      return;
    }
    const n = Number(minuteDraft);
    applyMinute(Number.isFinite(n) ? n : minute);
  }

  function confirm() {
    commitHourDraft();
    commitMinuteDraft();
    const h = hourDraft === "" ? hour : Math.min(23, Math.max(0, Number(hourDraft) || 0));
    const m = minuteDraft === "" ? minute : Math.min(59, Math.max(0, Number(minuteDraft) || 0));
    onChange(buildLocalInput(draftDate, h, m));
    setOpen(false);
  }

  return (
    <div className="book-select">
      <span className="book-select__label">
        {label}
        {required ? " *" : ""}
      </span>
      <button
        type="button"
        className={cn("book-select__trigger", !display && "book-select__trigger--placeholder")}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Clock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">{display || "Pick date & time"}</span>
        <ChevronDown className="book-select__chevron-static" aria-hidden />
      </button>
      {required && (
        <input className="sr-only" tabIndex={-1} aria-hidden required value={value} onChange={() => {}} />
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="book-dt-sheet">
          <SheetHeader className="book-dt-sheet__head">
            <SheetTitle className="text-sm font-semibold">{label}</SheetTitle>
          </SheetHeader>
          <div className="book-dt-sheet__body">
            <div className="book-dt-quick">
              <button
                type="button"
                className={cn("book-dt-quick__chip", draftDate.getTime() === today.getTime() && "book-dt-quick__chip--active")}
                onClick={() => setDraftDate(today)}
              >
                Today
              </button>
              <button
                type="button"
                className={cn(
                  "book-dt-quick__chip",
                  draftDate.getTime() === tomorrow.getTime() && "book-dt-quick__chip--active",
                )}
                onClick={() => setDraftDate(tomorrow)}
              >
                Tomorrow
              </button>
            </div>

            <div className="book-dt-step">
              <span className="book-dt-time__label">Date</span>
              <div className="book-dt-step__row">
                <button
                  type="button"
                  className="book-dt-step__btn"
                  aria-label="Previous day"
                  disabled={draftDate.getTime() <= minDate.getTime()}
                  onClick={() => shiftDay(-1)}
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="book-dt-step__value">{dateLabel}</span>
                <button
                  type="button"
                  className="book-dt-step__btn"
                  aria-label="Next day"
                  disabled={draftDate.getTime() >= maxDate.getTime()}
                  onClick={() => shiftDay(1)}
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="book-dt-time">
              <div className="book-dt-step">
                <span className="book-dt-time__label">Hour</span>
                <div className="book-dt-step__row">
                  <button
                    type="button"
                    className="book-dt-step__btn"
                    aria-label="Earlier hour"
                    onClick={() => applyHour(hour - 1)}
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <input
                    className="book-dt-step__input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label="Hour"
                    value={hourDraft}
                    onChange={(e) => onHourDraftChange(e.target.value)}
                    onBlur={commitHourDraft}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="book-dt-step__btn"
                    aria-label="Later hour"
                    onClick={() => applyHour(hour + 1)}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
              <span className="book-dt-time__sep" aria-hidden>
                :
              </span>
              <div className="book-dt-step">
                <span className="book-dt-time__label">Min</span>
                <div className="book-dt-step__row">
                  <button
                    type="button"
                    className="book-dt-step__btn"
                    aria-label="Earlier minute"
                    onClick={() => applyMinute(minute <= 0 ? 59 : minute - 1)}
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <input
                    className="book-dt-step__input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label="Minute"
                    value={minuteDraft}
                    onChange={(e) => onMinuteDraftChange(e.target.value)}
                    onBlur={commitMinuteDraft}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="book-dt-step__btn"
                    aria-label="Later minute"
                    onClick={() => applyMinute(minute >= 59 ? 0 : minute + 1)}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="book-dt-sheet__footer">
            <Button type="button" size="sm" className="w-full" onClick={confirm}>
              Set {dateLabel} · {pad2(hour)}:{pad2(minute)}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function BookStop({
  tone,
  title,
  placeId,
  name,
  time,
  timeLabel,
  locations,
  onPlaceChange,
  onTimeChange,
  timeRequired = true,
  showTime = true,
  onRemove,
}: {
  tone: "pickup" | "stop" | "drop";
  title: string;
  placeId: string;
  name: string;
  time?: string;
  timeLabel?: string;
  locations: SavedLocation[];
  onPlaceChange: (id: string) => void;
  onTimeChange?: (v: string) => void;
  timeRequired?: boolean;
  showTime?: boolean;
  onRemove?: () => void;
}) {
  return (
    <div className={cn("book-stop", `book-stop--${tone}`)}>
      <div className="book-stop__head">
        <span className="book-stop__dot" aria-hidden />
        <p className="book-stop__title">{title}</p>
        {onRemove && (
          <button type="button" className="book-stop__remove" onClick={onRemove} aria-label={`Remove ${title}`}>
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <div className="book-stop__body">
        <MobileSelect
          label="Saved place"
          value={placeId}
          placeholder="Pick a saved location"
          options={locations.map((l) => ({ value: l.id, label: l.name }))}
          onChange={onPlaceChange}
        />
        {name.trim() ? (
          <p className="book-stop__picked">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{name}</span>
          </p>
        ) : (
          <p className="book-stop__hint">Choose a saved place</p>
        )}
        {showTime && time != null && timeLabel && onTimeChange && (
          <MobileDateTime label={timeLabel} value={time} onChange={onTimeChange} required={timeRequired} />
        )}
      </div>
    </div>
  );
}

/** Employee portal — ride-booking style vehicle request. */
export function EmployeeRideBooking() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const departments = useDepartments();
  const locations = useLocations();
  const create = useCreateRequest();
  const tripTypes = useLookupOptions("trip_type");
  const vehicleCategories = useLookupOptions("vehicle_category");

  const now = new Date();
  const defaultTripType = tripTypes[0]?.value_key ?? "one_way";
  const defaultCategory = vehicleCategories[0]?.value_key ?? "sedan";

  const [tripCategory, setTripCategory] = useState(defaultTripType);
  const [form, setForm] = useState({
    requesterName: "",
    requesterPhone: "",
    departmentId: "",
    purpose: "",
    requestedCategory: defaultCategory,
    passengerCount: 1,
    pickupAt: toLocalInput(new Date(now.getTime() + 3600_000)),
    dropAt: toLocalInput(new Date(now.getTime() + 3 * 3600_000)),
    pickupPlaceId: "",
    pickupName: "",
    pickupAddress: "",
    pickupLat: null as number | null,
    pickupLng: null as number | null,
    dropPlaceId: "",
    dropName: "",
    dropAddress: "",
    dropLat: null as number | null,
    dropLng: null as number | null,
    remarks: "",
  });
  const [intermediateStops, setIntermediateStops] = useState<RouteStopDraft[]>(() => [
    newRouteStopDraft(toLocalInput(new Date(now.getTime() + 2 * 3600_000))),
  ]);
  const [finalDestination, setFinalDestination] = useState<RouteStopDraft>(() =>
    newRouteStopDraft(toLocalInput(new Date(now.getTime() + 3 * 3600_000))),
  );
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const savedLocations = (locations.data ?? []) as SavedLocation[];

  const routeMapPoints: MapPoint[] = (() => {
    const pts: MapPoint[] = [];
    if (form.pickupName.trim()) {
      pts.push({
        name: form.pickupName,
        address: form.pickupAddress,
        latitude: form.pickupLat,
        longitude: form.pickupLng,
        point_type: "pickup",
      });
    }
    if (tripCategory === "multi_stop") {
      for (const s of intermediateStops) {
        if (!s.name.trim()) continue;
        pts.push({
          name: s.name,
          address: s.address,
          latitude: s.lat,
          longitude: s.lng,
          point_type: "stop",
        });
      }
      if (finalDestination.name.trim()) {
        pts.push({
          name: finalDestination.name,
          address: finalDestination.address,
          latitude: finalDestination.lat,
          longitude: finalDestination.lng,
          point_type: "destination",
        });
      }
    } else if (form.dropName.trim()) {
      pts.push({
        name: form.dropName,
        address: form.dropAddress,
        latitude: form.dropLat,
        longitude: form.dropLng,
        point_type: "destination",
      });
    }
    return pts;
  })();

  useEffect(() => {
    if (!profile) return;
    const localPhone = profile.phone
      ? profile.phone.replace(/^\+880/, "").replace(/^0/, "")
      : "";
    setForm((f) => ({
      ...f,
      requesterName: profile.full_name || f.requesterName,
      departmentId: profile.department_id || f.departmentId,
      requesterPhone: localPhone || f.requesterPhone,
    }));
  }, [profile]);

  const categoryKeys = vehicleCategories.map((c) => c.value_key);
  const suggestedCategory = suggestCategoryForPassengers(form.passengerCount, categoryKeys);

  useEffect(() => {
    if (!categoryKeys.length) return;
    setForm((f) => {
      const next = suggestCategoryForPassengers(f.passengerCount, categoryKeys);
      if (f.requestedCategory === next) return f;
      return { ...f, requestedCategory: next };
    });
  }, [form.passengerCount, categoryKeys.join("|")]);

  const [paxDraft, setPaxDraft] = useState(String(form.passengerCount));

  function setPassengerCount(next: number) {
    const n = Math.min(40, Math.max(1, Math.floor(next) || 1));
    setPaxDraft(String(n));
    setForm((f) => ({
      ...f,
      passengerCount: n,
      requestedCategory: suggestCategoryForPassengers(
        n,
        vehicleCategories.map((c) => c.value_key),
      ),
    }));
  }

  function onPassengerDraftChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    setPaxDraft(digits);
    if (digits === "") return;
    const n = Number(digits);
    if (!Number.isFinite(n) || n < 1) return;
    const clamped = Math.min(40, n);
    setForm((f) => ({
      ...f,
      passengerCount: clamped,
      requestedCategory: suggestCategoryForPassengers(
        clamped,
        vehicleCategories.map((c) => c.value_key),
      ),
    }));
    if (clamped !== n) setPaxDraft(String(clamped));
  }

  function commitPassengerDraft() {
    const n = Number(paxDraft);
    setPassengerCount(Number.isFinite(n) && n >= 1 ? n : 1);
  }

  function selectTripType(value: string) {
    setTripCategory(value);
    if (value === "multi_stop" && intermediateStops.length === 0) {
      setIntermediateStops([newRouteStopDraft(endAtFromPickup(form.pickupAt, 1))]);
    }
  }

  function applyLocation(prefix: "pickup" | "drop", locationId: string) {
    const loc = savedLocations.find((l) => l.id === locationId);
    if (!loc) return;
    const applied = applySavedLocation(loc);
    if (prefix === "pickup") {
      setForm((f) => ({
        ...f,
        pickupPlaceId: applied.placeId,
        pickupName: applied.name,
        pickupAddress: applied.address,
        pickupLat: applied.lat,
        pickupLng: applied.lng,
      }));
    } else {
      setForm((f) => ({
        ...f,
        dropPlaceId: applied.placeId,
        dropName: applied.name,
        dropAddress: applied.address,
        dropLat: applied.lat,
        dropLng: applied.lng,
      }));
    }
  }

  function updateIntermediateStop(index: number, patch: Partial<RouteStopDraft>) {
    setIntermediateStops((stops) => stops.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function applyIntermediateLocation(index: number, locationId: string) {
    const loc = savedLocations.find((l) => l.id === locationId);
    if (!loc) return;
    updateIntermediateStop(index, applySavedLocation(loc));
  }

  function applyFinalLocation(locationId: string) {
    const loc = savedLocations.find((l) => l.id === locationId);
    if (!loc) return;
    setFinalDestination((d) => ({ ...d, ...applySavedLocation(loc) }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!form.pickupName.trim()) {
      toast.error("Pickup place is required");
      return;
    }

    const phone = normalizeBdPhone(form.requesterPhone);
    if (!phone) {
      toast.error("Enter a valid Bangladesh mobile number");
      return;
    }

    let points: {
      name: string;
      address: string;
      latitude: number | null;
      longitude: number | null;
      point_type: string;
    }[];
    let expectedEndAt = endAtFromPickup(form.pickupAt);

    if (tripCategory === "multi_stop") {
      const namedStops = intermediateStops.filter((s) => s.name.trim());
      if (namedStops.length === 0) {
        toast.error("Add at least one intermediate stop");
        return;
      }
      if (!finalDestination.name.trim()) {
        toast.error("Final destination is required");
        return;
      }
      expectedEndAt = endAtFromPickup(form.pickupAt, 3);
      points = [
        {
          name: form.pickupName,
          address: form.pickupAddress || form.pickupName,
          latitude: form.pickupLat,
          longitude: form.pickupLng,
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
          name: finalDestination.name,
          address: finalDestination.address || finalDestination.name,
          latitude: finalDestination.lat,
          longitude: finalDestination.lng,
          point_type: "destination",
        },
      ];
    } else {
      if (!form.dropName.trim()) {
        toast.error("Drop place is required");
        return;
      }
      points = [
        {
          name: form.pickupName,
          address: form.pickupAddress || form.pickupName,
          latitude: form.pickupLat,
          longitude: form.pickupLng,
          point_type: "pickup",
        },
        {
          name: form.dropName,
          address: form.dropAddress || form.dropName,
          latitude: form.dropLat,
          longitude: form.dropLng,
          point_type: "destination",
        },
      ];
    }

    try {
      const res = await create.mutateAsync({
        requesterId: user.id,
        requesterName: form.requesterName || profile?.full_name || "Employee",
        requesterPhone: phone,
        departmentId: form.departmentId || null,
        costCenter: "",
        purpose: form.purpose,
        tripType: tripCategory,
        priority: "normal",
        requestedCategory: form.requestedCategory || null,
        passengerCount: Number(form.passengerCount) || 1,
        pickupAt: form.pickupAt,
        expectedEndAt,
        isRoundTrip: tripCategory === "round_trip",
        returnPickupAt: null,
        returnExpectedEndAt: null,
        requiresAc: true,
        specialRequirements: "",
        remarks: form.remarks,
        points,
        passengers: [],
      });
      toast.success(`Request ${res.reference} sent`);
      void navigate({ to: "/requests/$requestId", params: { requestId: res.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit request");
    }
  }

  const routePreview = (() => {
    if (!form.pickupName.trim()) return null;
    if (tripCategory === "multi_stop") {
      const stops = intermediateStops.map((s) => s.name.trim()).filter(Boolean);
      if (!finalDestination.name.trim() && stops.length === 0) return null;
      return [form.pickupName, ...stops, finalDestination.name.trim()].filter(Boolean).join(" → ");
    }
    if (!form.dropName.trim()) return null;
    if (tripCategory === "round_trip") return `${form.pickupName} ⇄ ${form.dropName}`;
    return `${form.pickupName} → ${form.dropName}`;
  })();

  return (
    <AppShell title="Book a ride" subtitle="Request a vehicle">
      <form onSubmit={submit} className="book-ride">
        <header className="book-ride__hero">
          <div className="book-ride__hero-icon" aria-hidden>
            <Navigation className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="book-ride__hero-title">Where are you going?</p>
            <p className="book-ride__hero-sub">Pick trip type, places, and time — dispatch handles the rest.</p>
          </div>
        </header>

        <section className="book-ride__section">
          <p className="book-ride__section-label">Trip type</p>
          <div className="book-ride__trip-grid">
            {tripTypes.map((opt) => {
              const Icon = TRIP_ICONS[opt.value_key] ?? Car;
              const active = tripCategory === opt.value_key;
              return (
                <button
                  key={opt.value_key}
                  type="button"
                  className={cn("book-trip-card", active && "book-trip-card--active")}
                  onClick={() => selectTripType(opt.value_key)}
                  aria-pressed={active}
                >
                  <Icon className="size-4" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="book-ride__section book-ride__route">
          <p className="book-ride__section-label">Route</p>
          <div className="book-ride__timeline">
            <BookStop
              tone="pickup"
              title="Pickup"
              placeId={form.pickupPlaceId}
              name={form.pickupName}
              time={form.pickupAt}
              timeLabel="Pickup time"
              locations={savedLocations}
              onPlaceChange={(id) => applyLocation("pickup", id)}
              onTimeChange={(v) => set("pickupAt", v)}
            />

            {tripCategory === "multi_stop" ? (
              <>
                {intermediateStops.map((stop, index) => (
                  <BookStop
                    key={stop.id}
                    tone="stop"
                    title={`Stop ${index + 1}`}
                    placeId={stop.placeId}
                    name={stop.name}
                    time={stop.time}
                    timeLabel="Pickup time"
                    locations={savedLocations}
                    onPlaceChange={(id) => applyIntermediateLocation(index, id)}
                    onTimeChange={(v) => updateIntermediateStop(index, { time: v })}
                    onRemove={
                      intermediateStops.length > 1
                        ? () => setIntermediateStops((stops) => stops.filter((_, i) => i !== index))
                        : undefined
                    }
                  />
                ))}
                <button
                  type="button"
                  className="book-ride__add-stop"
                  onClick={() =>
                    setIntermediateStops((stops) => [
                      ...stops,
                      newRouteStopDraft(endAtFromPickup(form.pickupAt, 1 + stops.length)),
                    ])
                  }
                >
                  <Plus className="size-3.5" /> Add stop
                </button>
                <BookStop
                  tone="drop"
                  title="Final destination"
                  placeId={finalDestination.placeId}
                  name={finalDestination.name}
                  locations={savedLocations}
                  onPlaceChange={applyFinalLocation}
                  showTime={false}
                />
              </>
            ) : (
              <BookStop
                tone="drop"
                title={tripCategory === "round_trip" ? "Destination (return after)" : "Drop-off"}
                placeId={form.dropPlaceId}
                name={form.dropName}
                locations={savedLocations}
                onPlaceChange={(id) => applyLocation("drop", id)}
                showTime={false}
              />
            )}
          </div>

          {routePreview && (
            <div className="book-ride__preview">
              <MapPin className="size-3.5 shrink-0 text-primary" />
              <p>{routePreview}</p>
            </div>
          )}

          {routeMapPoints.some((p) => p.latitude != null && p.longitude != null) && (
            <div className="book-ride__map">
              <p className="book-ride__section-label">Path preview</p>
              <OsmRouteMap points={routeMapPoints} departAt={form.pickupAt} className="h-52 w-full" />
            </div>
          )}
        </section>

        <section className="book-ride__section">
          <p className="book-ride__section-label">Trip details</p>
          <div className="book-ride__card">
            <div className="book-passengers">
              <span className="book-passengers__label">
                <Users className="size-3.5" /> Passengers
              </span>
              <div className="book-passengers__stepper">
                <button
                  type="button"
                  className="book-passengers__btn"
                  aria-label="Fewer passengers"
                  disabled={form.passengerCount <= 1}
                  onClick={() => setPassengerCount(form.passengerCount - 1)}
                >
                  <Minus className="size-3.5" />
                </button>
                <input
                  className="book-passengers__input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label="Number of passengers"
                  value={paxDraft}
                  onChange={(e) => onPassengerDraftChange(e.target.value)}
                  onBlur={commitPassengerDraft}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
                <button
                  type="button"
                  className="book-passengers__btn"
                  aria-label="More passengers"
                  disabled={form.passengerCount >= 40}
                  onClick={() => setPassengerCount(form.passengerCount + 1)}
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="book-ride__vehicle-wrap">
              <span className="book-field__label">Vehicle type</span>
              <p className="book-ride__vehicle-hint">
                Suggested for {form.passengerCount} passenger{form.passengerCount === 1 ? "" : "s"}
              </p>
              <div className="book-ride__vehicle-scroll" role="listbox" aria-label="Vehicle type">
                {vehicleCategories.map((c) => {
                  const active = form.requestedCategory === c.value_key;
                  const suggested = suggestedCategory === c.value_key;
                  const fits = categoryFitsPassengers(c.value_key, form.passengerCount);
                  const seats = VEHICLE_CATEGORY_CAPACITY[c.value_key];
                  return (
                    <button
                      key={c.value_key}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={cn(
                        "book-vehicle-chip",
                        active && "book-vehicle-chip--active",
                        suggested && !active && "book-vehicle-chip--suggested",
                        !fits && "book-vehicle-chip--tight",
                      )}
                      onClick={() => set("requestedCategory", c.value_key)}
                    >
                      <Car className="size-3.5 shrink-0" />
                      <span className="truncate">{c.label}</span>
                      {seats != null && <span className="book-vehicle-chip__seats">{seats}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="book-field">
              <span className="book-field__label">Purpose</span>
              <Input
                className="book-field__input"
                value={form.purpose}
                onChange={(e) => set("purpose", e.target.value)}
                placeholder="Meeting, airport transfer…"
                required
              />
            </label>
          </div>
        </section>

        <section className="book-ride__section">
          <p className="book-ride__section-label">Contact</p>
          <div className="book-ride__more">
            <MobileSelect
              label="Department"
              value={form.departmentId}
              placeholder="Select department"
              options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              onChange={(v) => set("departmentId", v)}
            />
            <label className="book-field">
              <span className="book-field__label">Your name</span>
              <Input
                className="book-field__input"
                value={form.requesterName}
                placeholder={profile?.full_name ?? ""}
                onChange={(e) => set("requesterName", e.target.value)}
              />
            </label>
            <label className="book-field">
              <span className="book-field__label">Mobile</span>
              <div className="book-phone">
                <span className="book-phone__prefix">+880</span>
                <Input
                  className="book-field__input book-phone__input"
                  inputMode="numeric"
                  value={form.requesterPhone}
                  onChange={(e) => set("requesterPhone", maskBdPhoneInput(e.target.value))}
                  placeholder="1711234567"
                  maxLength={10}
                  required
                />
              </div>
              {form.requesterPhone && !isValidBdPhone(form.requesterPhone) && (
                <p className="book-field__error">Invalid BD mobile</p>
              )}
            </label>
            <label className="book-field">
              <span className="book-field__label">Notes (optional)</span>
              <Textarea
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
                rows={2}
                className="book-field__textarea"
                placeholder="Luggage, AC, accessibility…"
              />
            </label>
          </div>
        </section>

        <div className="book-ride__footer">
          <Button type="submit" className="book-ride__submit" disabled={create.isPending} tooltip="Send to dispatch">
            {create.isPending ? "Booking…" : "Request vehicle"}
          </Button>
          <Button asChild type="button" variant="ghost" className="book-ride__cancel">
            <Link to="/requests">Cancel</Link>
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
