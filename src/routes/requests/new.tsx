import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, ArrowRight, MapPin, Plus, Route as RouteIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AddFormSection, AddPageHero } from "@/components/add-form-shell";
import { EmployeeRideBooking } from "@/components/employee-ride-booking";
import { Field } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useLookupOptions } from "@/lib/lookups-context";
import { useCreateRequest, useDepartments, useLocations } from "@/lib/queries";
import { toLocalInput } from "@/lib/fleet";
import { formatBdPhone, isValidBdPhone, maskBdPhoneInput, normalizeBdPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/requests/new")({
  head: () => ({
    meta: [
      { title: "New vehicle request — FleetOps" },
      { name: "description", content: "Request a one-time ride or round trip with pickup and drop details." },
    ],
  }),
  component: NewRequestPage,
});

function NewRequestPage() {
  const { isEmployee, isDispatcher } = useAuth();
  if (isEmployee && !isDispatcher) return <EmployeeRideBooking />;
  return <OpsNewRequestForm />;
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

type TripCategory = string;

type SavedLocation = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

type RouteStopProps = {
  heading: string;
  iconTone?: "primary" | "success" | "info";
  placeLabel: string;
  nameLabel: string;
  timeLabel: string;
  placeId: string;
  name: string;
  time: string;
  namePlaceholder: string;
  placePlaceholder?: string;
  locations: SavedLocation[];
  onPlaceChange: (id: string) => void;
  onNameChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  nameRequired?: boolean;
  timeRequired?: boolean;
  onRemove?: () => void;
  compact?: boolean;
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

function applySavedLocation(loc: SavedLocation) {
  return {
    placeId: loc.id,
    name: loc.name,
    address: loc.address,
    lat: loc.latitude,
    lng: loc.longitude,
  };
}

function RouteStop({
  heading,
  iconTone = "primary",
  placeLabel,
  nameLabel,
  timeLabel,
  placeId,
  name,
  time,
  namePlaceholder,
  placePlaceholder = "Select saved location",
  locations,
  onPlaceChange,
  onNameChange,
  onTimeChange,
  nameRequired = true,
  timeRequired = true,
  onRemove,
  compact = false,
}: RouteStopProps) {
  const toneClass =
    iconTone === "success"
      ? "border-success/30 bg-success/10 text-success"
      : iconTone === "info"
        ? "border-info/30 bg-info/10 text-info"
        : "border-primary/30 bg-primary/10 text-primary";

  return (
    <div className={cn("add-route-stop", compact && "add-route-stop--compact")}>
      <div className={cn("add-route-stop__head", compact && "add-route-stop__head--compact")}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-lg border",
              compact ? "size-6" : "size-8",
              toneClass,
            )}
          >
            <MapPin className={compact ? "size-3" : "size-4"} />
          </span>
          <p className={cn("font-semibold", compact ? "text-xs sm:text-sm" : "text-sm sm:text-base")}>{heading}</p>
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("shrink-0 text-muted-foreground hover:text-destructive", compact ? "size-6" : "size-8")}
            onClick={onRemove}
            aria-label={`Remove ${heading}`}
            tooltip="Remove this stop"
          >
            <Trash2 className={compact ? "size-3" : "size-4"} />
          </Button>
        )}
      </div>
      <div className="add-route-stop__fields">
        <Field label={placeLabel}>
          <select className={selectClass} value={placeId} onChange={(e) => onPlaceChange(e.target.value)}>
            <option value="">{placePlaceholder}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={nameLabel}>
          <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder={namePlaceholder} required={nameRequired} />
        </Field>
        <Field label={timeLabel}>
          <Input type="datetime-local" value={time} onChange={(e) => onTimeChange(e.target.value)} required={timeRequired} />
        </Field>
      </div>
    </div>
  );
}

function OpsNewRequestForm() {
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
  const [tripCategory, setTripCategory] = useState<TripCategory>(defaultTripType);
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
  const [intermediateStops, setIntermediateStops] = useState<RouteStopDraft[]>(() => [newRouteStopDraft()]);
  const [finalDestination, setFinalDestination] = useState<RouteStopDraft>(() =>
    newRouteStopDraft(toLocalInput(new Date(now.getTime() + 3 * 3600_000))),
  );

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const savedLocations = (locations.data ?? []) as SavedLocation[];

  function selectTripType(value: string) {
    setTripCategory(value);
    if (value === "multi_stop" && intermediateStops.length === 0) {
      setIntermediateStops([newRouteStopDraft()]);
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

  function applyLocation(prefix: "pickup" | "drop", locationId: string) {
    const loc = savedLocations.find((l) => l.id === locationId);
    if (!loc) return;
    const map = {
      pickup: {
        pickupPlaceId: locationId,
        pickupName: loc.name,
        pickupAddress: loc.address,
        pickupLat: loc.latitude,
        pickupLng: loc.longitude,
      },
      drop: {
        dropPlaceId: locationId,
        dropName: loc.name,
        dropAddress: loc.address,
        dropLat: loc.latitude,
        dropLng: loc.longitude,
      },
    };
    setForm((f) => ({ ...f, ...map[prefix] }));
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

    let expectedEndAt = form.dropAt;

    if (tripCategory === "multi_stop") {
      const namedStops = intermediateStops.filter((s) => s.name.trim());
      if (namedStops.length === 0) {
        toast.error("Add at least one intermediate stop for multi-stop trips");
        return;
      }
      if (!finalDestination.name.trim()) {
        toast.error("Final destination is required for multi-stop trips");
        return;
      }
      expectedEndAt = finalDestination.time || form.dropAt;
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
      toast.success(`Request ${res.reference} sent to admin`);
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
    <AppShell title="New request" subtitle="Create a journey">
      <form onSubmit={submit} className="request-form-page request-form-page--compact page-stack">
        <AddPageHero
          title="Request a vehicle"
          subtitle="Submit for dispatch review"
          icon={<RouteIcon />}
          tone="primary"
          compact
        >
          <div className="request-form-page__trip-types">
            {tripTypes.map((opt) => (
              <button
                key={opt.value_key}
                type="button"
                onClick={() => selectTripType(opt.value_key)}
                className={cn("add-trip-type-chip", tripCategory === opt.value_key && "add-trip-type-chip--active")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </AddPageHero>

        {routePreview && (
          <div className="request-form-page__preview">
            <p className="request-form-page__preview-label">Route preview</p>
            <p className="request-form-page__preview-route">{routePreview}</p>
          </div>
        )}

        <div className="request-form-page__layout">
          {tripCategory === "multi_stop" ? (
            <AddFormSection title="Route" columns={1} compact flat className="request-form-page__route">
              <div className="request-form-page__route-stack">
                <RouteStop
                  compact
                  heading="Pickup"
                  placeLabel="Location"
                  nameLabel="Place"
                  timeLabel="Time"
                  placeId={form.pickupPlaceId}
                  name={form.pickupName}
                  time={form.pickupAt}
                  namePlaceholder="Head Office"
                  locations={savedLocations}
                  onPlaceChange={(id) => applyLocation("pickup", id)}
                  onNameChange={(v) => set("pickupName", v)}
                  onTimeChange={(v) => set("pickupAt", v)}
                />
                {intermediateStops.map((stop, index) => (
                  <div key={stop.id} className="request-form-page__route-stack-item">
                    <div className="request-form-page__connector" aria-hidden>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </div>
                    <RouteStop
                      compact
                      heading={`Stop ${index + 1}`}
                      iconTone="info"
                      placeLabel="Location"
                      nameLabel="Place"
                      timeLabel="Arrival (optional)"
                      placeId={stop.placeId}
                      name={stop.name}
                      time={stop.time}
                      namePlaceholder="Warehouse"
                      locations={savedLocations}
                      onPlaceChange={(id) => applyIntermediateLocation(index, id)}
                      onNameChange={(v) => updateIntermediateStop(index, { name: v })}
                      onTimeChange={(v) => updateIntermediateStop(index, { time: v })}
                      timeRequired={false}
                      onRemove={
                        intermediateStops.length > 1
                          ? () => setIntermediateStops((stops) => stops.filter((_, i) => i !== index))
                          : undefined
                      }
                    />
                  </div>
                ))}
                <div className="request-form-page__route-stack-item">
                  <div className="request-form-page__connector" aria-hidden>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                  <RouteStop
                    compact
                    heading="Final destination"
                    iconTone="success"
                    placeLabel="Location"
                    nameLabel="Place"
                    timeLabel="Arrival"
                    placeId={finalDestination.placeId}
                    name={finalDestination.name}
                    time={finalDestination.time}
                    namePlaceholder="Savar Plant"
                    locations={savedLocations}
                    onPlaceChange={applyFinalLocation}
                    onNameChange={(v) => setFinalDestination((d) => ({ ...d, name: v }))}
                    onTimeChange={(v) => setFinalDestination((d) => ({ ...d, time: v }))}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 w-full sm:w-auto"
                onClick={() => setIntermediateStops((stops) => [...stops, newRouteStopDraft()])}
                tooltip="Add another intermediate stop"
              >
                <Plus className="size-3.5" /> Add stop
              </Button>
            </AddFormSection>
          ) : (
            <AddFormSection
              title={tripCategory === "round_trip" ? "Round trip route" : "Route"}
              columns={1}
              compact
              flat
              className="request-form-page__route"
              description={
                tripCategory === "round_trip"
                  ? "Same pickup and drop — vehicle returns to pickup after destination."
                  : undefined
              }
            >
              <div
                className={cn(
                  "request-form-page__route-pair",
                  tripCategory === "round_trip" && "request-form-page__route-pair--round",
                )}
              >
                <RouteStop
                  compact
                  heading="Pickup"
                  placeLabel="Location"
                  nameLabel="Place"
                  timeLabel="Time"
                  placeId={form.pickupPlaceId}
                  name={form.pickupName}
                  time={form.pickupAt}
                  namePlaceholder="Head Office"
                  locations={savedLocations}
                  onPlaceChange={(id) => applyLocation("pickup", id)}
                  onNameChange={(v) => set("pickupName", v)}
                  onTimeChange={(v) => set("pickupAt", v)}
                />
                <div className="request-form-page__connector request-form-page__connector--pair" aria-hidden>
                  {tripCategory === "round_trip" ? (
                    <ArrowLeftRight className="size-4 text-primary" />
                  ) : (
                    <ArrowRight className="size-4 text-muted-foreground" />
                  )}
                </div>
                <RouteStop
                  compact
                  heading="Drop"
                  iconTone="success"
                  placeLabel="Location"
                  nameLabel="Place"
                  timeLabel={tripCategory === "round_trip" ? "Arrival at destination" : "Arrival"}
                  placeId={form.dropPlaceId}
                  name={form.dropName}
                  time={form.dropAt}
                  namePlaceholder="Airport"
                  locations={savedLocations}
                  onPlaceChange={(id) => applyLocation("drop", id)}
                  onNameChange={(v) => set("dropName", v)}
                  onTimeChange={(v) => set("dropAt", v)}
                />
              </div>
            </AddFormSection>
          )}

          <div className="request-form-page__details">
            <AddFormSection title="Trip details" columns={2} compact>
              <Field label="Purpose" className="sm:col-span-2">
                <Input
                  className="h-9"
                  value={form.purpose}
                  onChange={(e) => set("purpose", e.target.value)}
                  required
                />
              </Field>
              <Field label="Department">
                <select
                  className={selectClass}
                  value={form.departmentId}
                  onChange={(e) => set("departmentId", e.target.value)}
                >
                  <option value="">Select department</option>
                  {(departments.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Vehicle type">
                <select
                  className={selectClass}
                  value={form.requestedCategory}
                  onChange={(e) => set("requestedCategory", e.target.value)}
                >
                  {vehicleCategories.map((c) => (
                    <option key={c.value_key} value={c.value_key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Passengers">
                <Input
                  className="h-9"
                  type="number"
                  min={1}
                  value={form.passengerCount}
                  onChange={(e) => set("passengerCount", Number(e.target.value))}
                />
              </Field>
            </AddFormSection>

            <AddFormSection title="Contact" columns={2} compact>
              <Field label="Your name">
                <Input
                  className="h-9"
                  value={form.requesterName}
                  placeholder={profile?.full_name ?? ""}
                  onChange={(e) => set("requesterName", e.target.value)}
                />
              </Field>
              <Field label="Mobile (BD)" hint="01XXXXXXXXX">
                <div className="flex">
                  <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-2.5 text-sm text-muted-foreground">
                    +880
                  </span>
                  <Input
                    className="h-9 rounded-l-none"
                    inputMode="numeric"
                    value={form.requesterPhone}
                    onChange={(e) => set("requesterPhone", maskBdPhoneInput(e.target.value))}
                    placeholder="1711234567"
                    maxLength={10}
                    required
                  />
                </div>
                {form.requesterPhone && !isValidBdPhone(form.requesterPhone) && (
                  <p className="mt-1 text-xs text-destructive">Invalid BD mobile</p>
                )}
                {profile?.phone && !form.requesterPhone && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-primary hover:underline"
                    onClick={() => {
                      const local = profile.phone?.replace(/^\+880/, "").replace(/^0/, "") ?? "";
                      set("requesterPhone", local);
                    }}
                  >
                    Use {formatBdPhone(profile.phone)}
                  </button>
                )}
              </Field>
              <Field label="Remarks" className="sm:col-span-2">
                <Textarea
                  value={form.remarks}
                  onChange={(e) => set("remarks", e.target.value)}
                  rows={2}
                  className="min-h-0"
                />
              </Field>
            </AddFormSection>
          </div>

          <div className="request-form-page__footer">
            <Button
              type="submit"
              size="sm"
              className="min-h-9 flex-1 sm:flex-none sm:min-w-[9rem]"
              disabled={create.isPending}
              tooltip="Send to dispatch for review and assignment"
            >
              {create.isPending ? "Submitting…" : "Submit request"}
            </Button>
            <Button asChild type="button" variant="outline" size="sm" className="min-h-9 sm:min-w-[5.5rem]">
              <Link to="/requests">Cancel</Link>
            </Button>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
