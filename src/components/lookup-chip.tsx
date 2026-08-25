import { StatusChip, MetaChip } from "@/components/fleet-ui";
import { useLookupEntry } from "@/lib/lookups-context";

export function LookupChip({
  group,
  value,
  dot = true,
  pill,
  className,
  fallback,
}: {
  group: string;
  value: string | null | undefined;
  dot?: boolean;
  pill?: boolean;
  className?: string;
  fallback?: string;
}) {
  const entry = useLookupEntry(group, value);
  return (
    <StatusChip
      label={fallback ?? entry.label}
      tone={entry.tone}
      dot={dot}
      {...(pill !== undefined ? { pill } : {})}
      {...(className ? { className } : {})}
    />
  );
}

export function LookupMetaChip({
  group,
  value,
  className,
  fallback,
}: {
  group: string;
  value: string | null | undefined;
  className?: string;
  fallback?: string;
}) {
  const entry = useLookupEntry(group, value);
  return (
    <MetaChip
      label={fallback ?? entry.label}
      tone={entry.tone}
      {...(className ? { className } : {})}
    />
  );
}
