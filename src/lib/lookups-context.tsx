import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLookupsQuery } from "@/lib/queries";
import {
  activeLookupOptions,
  buildLookupMap,
  resolveLookup,
  type LookupGroup,
  type LookupValue,
} from "@/lib/lookups";
import type { Tone } from "@/lib/fleet";

type LookupsContextValue = {
  groups: LookupGroup[];
  loading: boolean;
  mapFor: (groupKey: string) => Record<string, { label: string; tone: Tone }>;
  entry: (groupKey: string, valueKey: string | null | undefined) => { label: string; tone: Tone };
  options: (groupKey: string) => LookupValue[];
  group: (groupKey: string) => LookupGroup | undefined;
};

const LookupsContext = createContext<LookupsContextValue | null>(null);

export function LookupsProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useLookupsQuery();

  const value = useMemo<LookupsContextValue>(() => {
    const groups = data?.groups ?? [];
    const byKey = new Map(groups.map((g) => [g.key, g]));

    return {
      groups,
      loading: isLoading,
      mapFor(groupKey: string) {
        return buildLookupMap(byKey.get(groupKey)?.values);
      },
      entry(groupKey, valueKey) {
        return resolveLookup(buildLookupMap(byKey.get(groupKey)?.values), valueKey);
      },
      options(groupKey) {
        return activeLookupOptions(byKey.get(groupKey)?.values);
      },
      group(groupKey) {
        return byKey.get(groupKey);
      },
    };
  }, [data, isLoading]);

  return <LookupsContext.Provider value={value}>{children}</LookupsContext.Provider>;
}

export function useLookups() {
  const ctx = useContext(LookupsContext);
  if (!ctx) throw new Error("useLookups must be used within LookupsProvider");
  return ctx;
}

export function useLookupEntry(groupKey: string, valueKey: string | null | undefined) {
  const { entry } = useLookups();
  return entry(groupKey, valueKey);
}

export function useLookupOptions(groupKey: string) {
  const { options } = useLookups();
  return options(groupKey);
}
