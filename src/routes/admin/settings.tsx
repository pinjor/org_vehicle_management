import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, MapPin, Plus, Save, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PanelSkeleton, SettingsLookupsSkeleton, TableSkeleton } from "@/components/loading-skeletons";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Field, Panel, StatusChip } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import type { Tone } from "@/lib/fleet";
import { LOOKUP_TONES, humanizeKey, type LookupValue } from "@/lib/lookups";
import { cn } from "@/lib/utils";
import { LookupChip } from "@/components/lookup-chip";
import { useLookupOptions } from "@/lib/lookups-context";
import {
  useCreateDepartment,
  useCreateLocation,
  useDeleteDepartment,
  useDeleteLocation,
  useDeleteLookupValue,
  useDepartments,
  useLocations,
  useLookupsQuery,
  useSaveLookupGroup,
  useUpdateDepartment,
  useUpdateLocation,
} from "@/lib/queries";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [{ title: "Settings — Vehicle Management System" }],
  }),
  component: AdminSettingsPage,
});

type DraftValue = Pick<LookupValue, "value_key" | "label" | "tone" | "sort_order" | "is_active">;

function AdminSettingsPage() {
  const { isDispatcher } = useAuth();

  if (!isDispatcher) {
    return (
      <AppShell title="Settings" subtitle="Admin only">
        <EmptyState title="Access denied" description="Only admin or HR can manage settings." />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Settings"
      subtitle="Lookups, labels, tones, departments and locations — all driven from the database"
    >
      <Tabs defaultValue="lookups" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="lookups" className="gap-1.5">
            <Settings2 className="size-3.5" /> Lookups
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-1.5">
            <Building2 className="size-3.5" /> Departments
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-1.5">
            <MapPin className="size-3.5" /> Locations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lookups">
          <LookupsTab />
        </TabsContent>
        <TabsContent value="departments">
          <DepartmentsTab />
        </TabsContent>
        <TabsContent value="locations">
          <LocationsTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function LookupsTab() {
  const { data, isLoading } = useLookupsQuery();
  const save = useSaveLookupGroup();
  const remove = useDeleteLookupValue();
  const groups = useMemo(() => [...(data?.groups ?? [])].sort((a, b) => a.sort_order - b.sort_order), [data]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftValue[]>([]);
  const [newRow, setNewRow] = useState<DraftValue>({
    value_key: "",
    label: "",
    tone: "neutral",
    sort_order: 0,
    is_active: true,
  });

  const selected = groups.find((g) => g.key === selectedKey) ?? groups[0];

  useEffect(() => {
    if (!groups.length) return;
    if (!selectedKey || !groups.some((g) => g.key === selectedKey)) {
      setSelectedKey(groups[0]!.key);
    }
  }, [groups, selectedKey]);

  useEffect(() => {
    if (!selected) return;
    setDraft(
      [...selected.values].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)).map(toDraft),
    );
    setNewRow({
      value_key: "",
      label: "",
      tone: "neutral",
      sort_order: (selected.values.length + 1) * 10,
      is_active: true,
    });
  }, [selected?.key, selected?.values]);

  function updateRow(index: number, patch: Partial<DraftValue>) {
    setDraft((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleSave() {
    if (!selected) return;
    try {
      await save.mutateAsync({ groupKey: selected.key, values: draft });
      toast.success(`${selected.label} saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save lookup group");
    }
  }

  async function handleAdd() {
    if (!selected) return;
    const key = newRow.value_key.trim().toLowerCase().replace(/\s+/g, "_");
    const label = newRow.label.trim();
    if (!key || !label) {
      toast.error("Value key and label are required");
      return;
    }
    if (draft.some((r) => r.value_key === key)) {
      toast.error("That value key already exists");
      return;
    }
    const next = [...draft, { ...newRow, value_key: key, label }];
    setDraft(next);
    setNewRow({
      value_key: "",
      label: "",
      tone: "neutral",
      sort_order: (next.length + 1) * 10,
      is_active: true,
    });
  }

  async function handleDelete(valueKey: string) {
    if (!selected) return;
    if (!window.confirm(`Delete "${valueKey}" from ${selected.label}?`)) return;
    try {
      await remove.mutateAsync({ groupKey: selected.key, valueKey });
      setDraft((rows) => rows.filter((r) => r.value_key !== valueKey));
      toast.success("Value removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete value");
    }
  }

  if (isLoading) {
    return <SettingsLookupsSkeleton />;
  }

  if (!groups.length) {
    return (
      <EmptyState
        title="No lookup groups"
        description="Run the app_lookups migration to seed dynamic labels and status chips."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(200px,240px)_1fr]">
      <div className="lg:hidden">
        <Field label="Lookup group">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={selected?.key ?? ""}
            onChange={(e) => setSelectedKey(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label} ({g.values.length})
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Panel tone="neutral" title="Groups" bodyClassName="p-0" className="hidden lg:flex">
        <ul className="divide-y divide-border">
          {groups.map((g) => (
            <li key={g.key}>
              <button
                type="button"
                onClick={() => setSelectedKey(g.key)}
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/50 ${
                  selected?.key === g.key ? "bg-primary/8 font-medium text-primary" : "text-foreground"
                }`}
              >
                <span>{g.label}</span>
                <span className="text-xs text-muted-foreground">{g.values.length} values</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      {selected && (
        <Panel
          tone="primary"
          title={selected.label}
          description={selected.description ?? undefined}
          action={
            <Button size="sm" onClick={() => void handleSave()} disabled={save.isPending} tooltip="Save all lookup values in this group">
              <Save className="size-3.5" /> {save.isPending ? "Saving…" : "Save group"}
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/80 bg-muted/30 p-3">
              <span className="w-full text-xs font-medium text-muted-foreground">Live preview</span>
              {draft
                .filter((v) => v.is_active)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((v) => (
                  <StatusChip key={v.value_key} label={v.label} tone={v.tone} />
                ))}
            </div>

            <ul className="divide-y divide-border rounded-lg border border-border md:hidden">
              {draft.map((row, index) => (
                <li key={row.value_key} className={cn("space-y-3 p-3", !row.is_active && "opacity-60")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{row.value_key}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      tooltip="Remove this lookup value"
                      onClick={() => void handleDelete(row.value_key)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <Field label="Label">
                    <Input
                      value={row.label}
                      onChange={(e) => updateRow(index, { label: e.target.value })}
                      className="h-9"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tone">
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                        value={row.tone}
                        onChange={(e) => updateRow(index, { tone: e.target.value as Tone })}
                      >
                        {LOOKUP_TONES.map((t) => (
                          <option key={t} value={t}>
                            {humanizeKey(t)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Order">
                      <Input
                        type="number"
                        value={row.sort_order}
                        onChange={(e) => updateRow(index, { sort_order: Number(e.target.value) })}
                        className="h-9"
                      />
                    </Field>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
                    <span className="text-xs font-semibold">Active</span>
                    <Switch checked={row.is_active} onCheckedChange={(v) => updateRow(index, { is_active: v })} />
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Key</th>
                    <th className="px-3 py-2 font-medium">Label</th>
                    <th className="px-3 py-2 font-medium">Tone</th>
                    <th className="px-3 py-2 font-medium">Order</th>
                    <th className="px-3 py-2 font-medium">Active</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {draft.map((row, index) => (
                    <tr key={row.value_key} className={!row.is_active ? "opacity-60" : undefined}>
                      <td className="px-3 py-2 font-mono text-xs">{row.value_key}</td>
                      <td className="px-3 py-2">
                        <Input
                          value={row.label}
                          onChange={(e) => updateRow(index, { label: e.target.value })}
                          className="h-8"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                          value={row.tone}
                          onChange={(e) => updateRow(index, { tone: e.target.value as Tone })}
                        >
                          {LOOKUP_TONES.map((t) => (
                            <option key={t} value={t}>
                              {humanizeKey(t)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={row.sort_order}
                          onChange={(e) => updateRow(index, { sort_order: Number(e.target.value) })}
                          className="h-8 w-20"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Switch checked={row.is_active} onCheckedChange={(v) => updateRow(index, { is_active: v })} />
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          tooltip="Remove this lookup value"
                          onClick={() => void handleDelete(row.value_key)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-dashed border-border p-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">Add value</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Field label="Key">
                  <Input
                    value={newRow.value_key}
                    onChange={(e) => setNewRow((r) => ({ ...r, value_key: e.target.value }))}
                    placeholder="e.g. evening"
                    className="h-9 font-mono text-xs"
                  />
                </Field>
                <Field label="Label">
                  <Input
                    value={newRow.label}
                    onChange={(e) => setNewRow((r) => ({ ...r, label: e.target.value }))}
                    placeholder="Display label"
                    className="h-9"
                  />
                </Field>
                <Field label="Tone">
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={newRow.tone}
                    onChange={(e) => setNewRow((r) => ({ ...r, tone: e.target.value as Tone }))}
                  >
                    {LOOKUP_TONES.map((t) => (
                      <option key={t} value={t}>
                        {humanizeKey(t)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Order">
                  <Input
                    type="number"
                    value={newRow.sort_order}
                    onChange={(e) => setNewRow((r) => ({ ...r, sort_order: Number(e.target.value) }))}
                    className="h-9"
                  />
                </Field>
                <div className="flex items-end">
                  <Button type="button" variant="secondary" className="w-full" onClick={() => void handleAdd()} tooltip="Add a new option to this lookup group">
                    <Plus className="size-3.5" /> Add
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                New keys must match database constraints on related tables before they can be used in records.
              </p>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function toDraft(v: LookupValue): DraftValue {
  return {
    value_key: v.value_key,
    label: v.label,
    tone: v.tone,
    sort_order: v.sort_order,
    is_active: v.is_active,
  };
}

type DepartmentRow = { id: string; name: string; code: string };

function DepartmentsTab() {
  const { data, isLoading } = useDepartments();
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const remove = useDeleteDepartment();
  const rows = (data ?? []) as DepartmentRow[];
  const [form, setForm] = useState({ name: "", code: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Name and code required");
      return;
    }
    try {
      await create.mutateAsync({ name: form.name.trim(), code: form.code.trim() });
      toast.success("Department added");
      setForm({ name: "", code: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add department");
    }
  }

  async function handleUpdate(id: string) {
    try {
      await update.mutateAsync({ id, name: editForm.name.trim(), code: editForm.code.trim() });
      toast.success("Department updated");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update department");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete department "${name}"?`)) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Department removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete department");
    }
  }

  return (
    <Panel tone="info" title="Departments" description="Used on requests and employee profiles">
      <form onSubmit={(e) => void handleCreate(e)} className="mb-4 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-9" />
        </Field>
        <Field label="Code">
          <Input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            className="h-9 font-mono"
            maxLength={12}
          />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={create.isPending} tooltip="Create a new department for requests and profiles">
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
      </form>

      {isLoading ? (
        <TableSkeleton rows={4} cols={2} />
      ) : rows.length === 0 ? (
        <EmptyState title="No departments" description="Add your first department above." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              {editing === d.id ? (
                <>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-8 flex-1 min-w-[140px]"
                  />
                  <Input
                    value={editForm.code}
                    onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="h-8 w-24 font-mono"
                  />
                  <Button size="sm" onClick={() => void handleUpdate(d.id)} tooltip="Save department name and code">
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)} tooltip="Discard changes">
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{d.name}</span>
                  <StatusChip label={d.code} tone="neutral" dot={false} />
                  <Button
                    size="sm"
                    variant="ghost"
                    tooltip="Edit department name and code"
                    onClick={() => {
                      setEditing(d.id);
                      setEditForm({ name: d.name, code: d.code });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    tooltip="Delete this department permanently"
                    onClick={() => void handleDelete(d.id, d.name)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  location_type: string | null;
};

function LocationsTab() {
  const { data, isLoading } = useLocations();
  const locationTypes = useLookupOptions("location_type");
  const create = useCreateLocation();
  const update = useUpdateLocation();
  const remove = useDeleteLocation();
  const rows = (data ?? []) as LocationRow[];
  const [form, setForm] = useState({ name: "", address: "", location_type: locationTypes[0]?.value_key ?? "office" });
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", address: "", location_type: "office" });

  useEffect(() => {
    if (locationTypes.length && !locationTypes.some((t) => t.value_key === form.location_type)) {
      setForm((f) => ({ ...f, location_type: locationTypes[0]!.value_key }));
    }
  }, [locationTypes, form.location_type]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        location_type: form.location_type,
      });
      toast.success("Location added");
      setForm({ name: "", address: "", location_type: locationTypes[0]?.value_key ?? "office" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add location");
    }
  }

  async function handleUpdate(id: string) {
    try {
      await update.mutateAsync({
        id,
        patch: {
          name: editForm.name.trim(),
          address: editForm.address.trim() || null,
          location_type: editForm.location_type,
        },
      });
      toast.success("Location updated");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update location");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete location "${name}"?`)) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Location removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete location");
    }
  }

  return (
    <Panel tone="success" title="Locations" description="Saved places for pickups and destinations">
      <form onSubmit={(e) => void handleCreate(e)} className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-9" />
        </Field>
        <Field label="Address">
          <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="h-9" />
        </Field>
        <Field label="Type">
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={form.location_type}
            onChange={(e) => setForm((f) => ({ ...f, location_type: e.target.value }))}
          >
            {locationTypes.map((t) => (
              <option key={t.value_key} value={t.value_key}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={create.isPending} tooltip="Save a reusable pickup or destination place">
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
      </form>

      {isLoading ? (
        <TableSkeleton rows={4} cols={2} />
      ) : rows.length === 0 ? (
        <EmptyState title="No locations" description="Add your first location above." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((loc) => (
            <li key={loc.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              {editing === loc.id ? (
                <>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-8 flex-1 min-w-[120px]"
                  />
                  <Input
                    value={editForm.address}
                    onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                    className="h-8 flex-1 min-w-[160px]"
                    placeholder="Address"
                  />
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    value={editForm.location_type}
                    onChange={(e) => setEditForm((f) => ({ ...f, location_type: e.target.value }))}
                  >
                    {locationTypes.map((t) => (
                      <option key={t.value_key} value={t.value_key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" onClick={() => void handleUpdate(loc.id)} tooltip="Save location details">
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)} tooltip="Discard changes">
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{loc.name}</span>
                  {loc.location_type && <LookupChip group="location_type" value={loc.location_type} dot={false} />}
                  {loc.address && <span className="text-xs text-muted-foreground">{loc.address}</span>}
                  <Button
                    size="sm"
                    variant="ghost"
                    tooltip="Edit location name, address, and type"
                    onClick={() => {
                      setEditing(loc.id);
                      setEditForm({
                        name: loc.name,
                        address: loc.address ?? "",
                        location_type: loc.location_type ?? locationTypes[0]?.value_key ?? "office",
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    tooltip="Delete this saved location"
                    onClick={() => void handleDelete(loc.id, loc.name)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
