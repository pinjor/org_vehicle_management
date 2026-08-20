import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/fleet";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/18 text-warning-foreground border-warning/35",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  info: "bg-info/12 text-info border-info/25",
  primary: "bg-primary/10 text-primary border-primary/25",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusChip({
  label,
  tone = "neutral",
  dot = true,
  className,
}: {
  label: string;
  tone?: Tone | undefined;
  dot?: boolean;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-70" />}
      {label}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        {icon && (
          <span className={cn("rounded-md border p-1.5", TONE_CLASS[tone])}>{icon}</span>
        )}
      </div>
      <p className="num mt-3 text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel flex flex-col", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function RouteTimeline({
  points,
  activeIndex = -1,
}: {
  points: { name: string; address?: string | null; point_type: string; expected_at?: string | null }[];
  activeIndex?: number;
}) {
  return (
    <ol className="relative space-y-4 pl-6">
      <span className="absolute top-2 bottom-2 left-[7px] w-px bg-border" aria-hidden />
      {points.map((p, i) => {
        const done = activeIndex > i;
        const active = activeIndex === i;
        return (
          <li key={`${p.name}-${i}`} className="relative">
            <span
              className={cn(
                "absolute top-1 -left-6 size-4 rounded-full border-2 bg-background",
                done
                  ? "border-success bg-success"
                  : active
                    ? "border-primary ring-4 ring-primary/15"
                    : "border-border",
              )}
              aria-hidden
            />
            <p className="text-sm font-medium">{p.name}</p>
            {p.address && <p className="text-xs text-muted-foreground">{p.address}</p>}
            <p className="mt-0.5 text-[11px] tracking-wide text-muted-foreground uppercase">
              {p.point_type.replace(/_/g, " ")}
            </p>
          </li>
        );
      })}
    </ol>
  );
}