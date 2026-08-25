import type { Tone } from "@/lib/fleet";

export type LookupValue = {
  id?: string;
  value_key: string;
  label: string;
  tone: Tone;
  sort_order: number;
  is_active: boolean;
};

export type LookupGroup = {
  key: string;
  label: string;
  description: string | null;
  sort_order: number;
  values: LookupValue[];
};

export type LookupsPayload = {
  groups: LookupGroup[];
};

export const LOOKUP_TONES: Tone[] = ["success", "warning", "danger", "info", "neutral", "primary"];

export function humanizeKey(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildLookupMap(values: LookupValue[] | undefined) {
  const map: Record<string, { label: string; tone: Tone }> = {};
  for (const v of values ?? []) {
    if (!v.is_active) continue;
    map[v.value_key] = { label: v.label, tone: v.tone };
  }
  return map;
}

export function resolveLookup(
  map: Record<string, { label: string; tone: Tone }>,
  value: string | null | undefined,
  fallbackLabel?: string,
) {
  if (!value) return { label: fallbackLabel ?? "—", tone: "neutral" as Tone };
  const hit = map[value];
  if (hit) return hit;
  return { label: fallbackLabel ?? humanizeKey(value), tone: "neutral" as Tone };
}

export function activeLookupOptions(values: LookupValue[] | undefined) {
  return [...(values ?? [])]
    .filter((v) => v.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}
