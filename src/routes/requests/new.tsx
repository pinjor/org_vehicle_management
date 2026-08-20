import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Field, Panel } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useCreateRequest, useDepartments, useLocations } from "@/lib/queries";
import { VEHICLE_CATEGORIES, toLocalInput } from "@/lib/fleet";

export const Route = createFileRoute("/requests/new")({
  head: () => ({
    meta: [
      { title: "New vehicle request — FleetOps" },
      { name: "description", content: "Raise a one-way, round trip or multi-stop vehicle request with passengers and route points." },
      { property: "og:title", content: "New vehicle request — FleetOps" },
      { property: "og:description", content: "Submit a vehicle request with route, timing and passenger details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewRequestPage,
});

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

type Point = { name: string; address: string; latitude: number | null; longitude: number | null; point_type: string };

function NewRequestPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const departments = useDepartments();
  const locations = useLocations();
  const create = useCreateRequest();

  const now = new Date();
  const [form, setForm] = useState({
    requesterName: "",
    requesterPhone: "",
    departmentId: "",
    costCenter: "",
    purpose: "",
    tripType: "one_way",
    priority: "normal",
    requestedCategory: "sedan",
    passengerCount: 1,
    pickupAt: toLocalInput(new Date(now.getTime() + 3600_000)),
    expectedEndAt: toLocalInput(new Date(now.getTime() + 3 * 3600_000)),
    returnPickupAt: "",
    returnExpectedEndAt: "",
    requiresAc: true,
    specialRequirements: "",
    remarks: "",
  });
  const [points, setPoints] = useState<Point[]>([
    { name: "", address: "", latitude: null, longitude: null, point_type: "pickup" },
    { name: "", address: "", latitude: null, longitude: null, point_type: "destination" },
  ]);
  const [passengers, setPassengers] = useState([{ full_name: "", phone: "", passenger_type: "employee" }]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function applyLocation(index: number, locationId: string) {
    const loc = (locations.data ?? []).find((l) => l.id === locationId);
    if (!loc) return;
    setPoints((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, name: loc.name, address: loc.address, latitude: loc.latitude, longitude: loc.longitude } : p,
      ),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const validPoints = points.filter((p) => p.name.trim());
    if (validPoints.length < 2) {
      toast.error("Add at least a pickup and a destination");
      return;
    }
    try {
      const res = await create.mutateAsync({
        requesterId: user.id,
        requesterName: form.requesterName || profile?.full_name || user.email || "Requester",
        requesterPhone: form.requesterPhone,
        departmentId: form.departmentId || null,
        costCenter: form.costCenter,
        purpose: form.purpose,
        tripType: form.tripType,
        priority: form.priority,
        requestedCategory: form.requestedCategory || null,
        passengerCount: Number(form.passengerCount) || 1,
        pickupAt: form.pickupAt,
        expectedEndAt: form.expectedEndAt,
        isRoundTrip: form.tripType === "round_trip",
        returnPickupAt: form.tripType === "round_trip" ? form.returnPickupAt || null : null,
        returnExpectedEndAt: form.tripType === "round_trip" ? form.returnExpectedEndAt || null : null,
        requiresAc: form.requiresAc,
        specialRequirements: form.specialRequirements,
        remarks: form.remarks,
        points: validPoints,
        passengers: passengers.filter((p) => p.full_name.trim()),
      });
      toast.success(`Request ${res.reference} submitted`);
      void navigate({ to: "/requests/$requestId", params: { requestId: res.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit request");
    }
  }

  return (
    <AppShell title="New vehicle request" subtitle="Route, timing, passengers and preferences">
      <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Panel title="Journey details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Purpose">
                <Input value={form.purpose} onChange={(e) => set("purpose", e.target.value)} required />
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
              <Field label="Trip type">
                <select className={selectClass} value={form.tripType} onChange={(e) => set("tripType", e.target.value)}>
                  <option value="one_way">One way</option>
                  <option value="round_trip">Round trip</option>
                  <option value="multi_stop">Multi stop</option>
                </select>
              </Field>
              <Field label="Priority">
                <select className={selectClass} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
                  {["normal", "important", "high", "emergency", "vip"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Pickup time">
                <Input type="datetime-local" value={form.pickupAt} onChange={(e) => set("pickupAt", e.target.value)} required />
              </Field>
              <Field label="Expected end">
                <Input
                  type="datetime-local"
                  value={form.expectedEndAt}
                  onChange={(e) => set("expectedEndAt", e.target.value)}
                  required
                />
              </Field>
              {form.tripType === "round_trip" && (
                <>
                  <Field label="Return pickup">
                    <Input
                      type="datetime-local"
                      value={form.returnPickupAt}
                      onChange={(e) => set("returnPickupAt", e.target.value)}
                    />
                  </Field>
                  <Field label="Return end">
                    <Input
                      type="datetime-local"
                      value={form.returnExpectedEndAt}
                      onChange={(e) => set("returnExpectedEndAt", e.target.value)}
                    />
                  </Field>
                </>
              )}
            </div>
          </Panel>

          <Panel
            title="Route"
            description="Add intermediate stops for multi-stop journeys"
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setPoints((prev) => [
                    ...prev.slice(0, -1),
                    { name: "", address: "", latitude: null, longitude: null, point_type: "stop" },
                    prev[prev.length - 1]!,
                  ])
                }
              >
                <Plus className="size-4" /> Add stop
              </Button>
            }
          >
            <div className="space-y-3">
              {points.map((p, i) => (
                <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[130px_1fr_1fr_auto]">
                  <span className="self-center text-xs font-medium text-muted-foreground uppercase">
                    {p.point_type}
                  </span>
                  <select className={selectClass} value="" onChange={(e) => applyLocation(i, e.target.value)}>
                    <option value="">Pick saved location</option>
                    {(locations.data ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={p.name}
                    placeholder="Point name"
                    onChange={(e) =>
                      setPoints((prev) => prev.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  {p.point_type === "stop" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPoints((prev) => prev.filter((_, xi) => xi !== i))}
                      aria-label="Remove stop"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Requester">
            <div className="grid gap-3">
              <Field label="Name">
                <Input
                  value={form.requesterName}
                  placeholder={profile?.full_name ?? ""}
                  onChange={(e) => set("requesterName", e.target.value)}
                />
              </Field>
              <Field label="Contact number">
                <Input value={form.requesterPhone} onChange={(e) => set("requesterPhone", e.target.value)} />
              </Field>
              <Field label="Cost center">
                <Input value={form.costCenter} onChange={(e) => set("costCenter", e.target.value)} />
              </Field>
            </div>
          </Panel>

          <Panel title="Vehicle preference">
            <div className="grid gap-3">
              <Field label="Category">
                <select
                  className={selectClass}
                  value={form.requestedCategory}
                  onChange={(e) => set("requestedCategory", e.target.value)}
                >
                  {VEHICLE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Passengers">
                <Input
                  type="number"
                  min={1}
                  value={form.passengerCount}
                  onChange={(e) => set("passengerCount", Number(e.target.value))}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.requiresAc}
                  onChange={(e) => set("requiresAc", e.target.checked)}
                />
                Air conditioning required
              </label>
              <Field label="Special requirements">
                <Textarea
                  value={form.specialRequirements}
                  onChange={(e) => set("specialRequirements", e.target.value)}
                  rows={2}
                />
              </Field>
              <Field label="Remarks">
                <Textarea value={form.remarks} onChange={(e) => set("remarks", e.target.value)} rows={2} />
              </Field>
            </div>
          </Panel>

          <Panel
            title="Passengers"
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPassengers((p) => [...p, { full_name: "", phone: "", passenger_type: "employee" }])}
              >
                <Plus className="size-4" /> Add
              </Button>
            }
          >
            <div className="space-y-2">
              {passengers.map((p, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Full name"
                    value={p.full_name}
                    onChange={(e) =>
                      setPassengers((prev) => prev.map((x, xi) => (xi === i ? { ...x, full_name: e.target.value } : x)))
                    }
                  />
                  <Input
                    placeholder="Phone"
                    value={p.phone}
                    onChange={(e) =>
                      setPassengers((prev) => prev.map((x, xi) => (xi === i ? { ...x, phone: e.target.value } : x)))
                    }
                  />
                </div>
              ))}
            </div>
          </Panel>

          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
