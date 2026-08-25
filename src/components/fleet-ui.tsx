import type { ComponentProps, KeyboardEvent, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/fleet";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success/22 text-success border-success/40 shadow-[inset_0_1px_0_oklch(1_0_0/0.4)]",
  warning: "bg-warning/24 text-warning-foreground border-warning/45 shadow-[inset_0_1px_0_oklch(1_0_0/0.4)]",
  danger: "bg-destructive/20 text-destructive border-destructive/40 shadow-[inset_0_1px_0_oklch(1_0_0/0.4)]",
  info: "bg-info/22 text-info border-info/40 shadow-[inset_0_1px_0_oklch(1_0_0/0.4)]",
  primary: "bg-primary/20 text-primary border-primary/40 shadow-[inset_0_1px_0_oklch(1_0_0/0.4)]",
  violet: "bg-violet/22 text-violet border-violet/40 shadow-[inset_0_1px_0_oklch(1_0_0/0.4)]",
  coral: "bg-coral/22 text-coral border-coral/40 shadow-[inset_0_1px_0_oklch(1_0_0/0.4)]",
  rose: "bg-rose/22 text-rose border-rose/40 shadow-[inset_0_1px_0_oklch(1_0_0/0.4)]",
  sky: "bg-sky/24 text-sky border-sky/40 shadow-[inset_0_1px_0_oklch(1_0_0/0.4)]",
  neutral: "bg-muted text-muted-foreground border-border shadow-[inset_0_1px_0_oklch(1_0_0/0.45)]",
};

const FILTER_ACTIVE: Record<Tone, string> = {
  success: "border-success/50 bg-success/24 text-success ring-2 ring-success/30 font-semibold",
  warning: "border-warning/50 bg-warning/26 text-warning-foreground ring-2 ring-warning/30 font-semibold",
  danger: "border-destructive/50 bg-destructive/20 text-destructive ring-2 ring-destructive/30 font-semibold",
  info: "border-info/50 bg-info/24 text-info ring-2 ring-info/30 font-semibold",
  primary: "border-primary/50 bg-primary/22 text-primary ring-2 ring-primary/30 font-semibold",
  violet: "border-violet/50 bg-violet/24 text-violet ring-2 ring-violet/30 font-semibold",
  coral: "border-coral/50 bg-coral/24 text-coral ring-2 ring-coral/30 font-semibold",
  rose: "border-rose/50 bg-rose/24 text-rose ring-2 ring-rose/30 font-semibold",
  sky: "border-sky/50 bg-sky/24 text-sky ring-2 ring-sky/30 font-semibold",
  neutral: "border-border bg-muted text-foreground ring-2 ring-border font-semibold",
};

const KPI_ICON_RING: Record<Tone, string> = {
  success: "kpi-card__icon--success",
  warning: "kpi-card__icon--warning",
  danger: "kpi-card__icon--danger",
  info: "kpi-card__icon--info",
  primary: "kpi-card__icon--primary",
  violet: "kpi-card__icon--violet",
  coral: "kpi-card__icon--coral",
  rose: "kpi-card__icon--rose",
  sky: "kpi-card__icon--sky",
  neutral: "kpi-card__icon--neutral",
};

export function StatusChip({
  label,
  tone = "neutral",
  dot = true,
  pill = true,
  className,
}: {
  label: string;
  tone?: Tone | undefined;
  dot?: boolean;
  pill?: boolean;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        pill ? "rounded-full" : "rounded-md",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current opacity-70" />}
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Neutral meta tags — counts, categories, departments */
export function MetaChip({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  return <StatusChip label={label} tone={tone} dot={false} className={className} />;
}

export function ChipGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-1.5", className)}>{children}</div>;
}

export function FilterChip({
  label,
  active,
  tone = "primary",
  onClick,
  count,
  className,
  ...props
}: {
  label: string;
  active: boolean;
  tone?: Tone;
  onClick: () => void;
  count?: number;
  className?: string;
} & Omit<ComponentProps<"button">, "type" | "onClick" | "children">) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-[0.97]",
        active
          ? FILTER_ACTIVE[tone]
          : "border-border bg-surface text-muted-foreground hover:border-primary/35 hover:bg-primary/10 hover:text-foreground",
        className,
      )}
      {...props}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "num grid min-w-[1.125rem] place-items-center rounded-full px-1 py-px text-[10px] font-semibold",
            active ? "bg-current/15" : "bg-muted",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export type FilterBarOption = {
  value: string;
  label: string;
  tone?: Tone;
  count?: number;
};

/** Wrapping filter chips — stays on screen on mobile (no horizontal bleed). */
export function FilterBar({
  value,
  onChange,
  options,
  label = "Filter",
}: {
  value: string;
  onChange: (value: string) => void;
  options: FilterBarOption[];
  label?: string;
}) {
  return (
    <div className="flex min-w-0 max-w-full flex-wrap gap-1.5" role="tablist" aria-label={label}>
      {options.map((o) => (
        <FilterChip
          key={o.value}
          label={o.label}
          tone={o.tone ?? "neutral"}
          active={value === o.value}
          {...(o.count !== undefined ? { count: o.count } : {})}
          onClick={() => onChange(o.value)}
        />
      ))}
    </div>
  );
}

export function KpiGrid({
  children,
  className,
  fit = "cols",
}: {
  children: ReactNode;
  className?: string;
  /** `cols` = fixed breakpoints; `auto` = fill row width, no empty slots */
  fit?: "cols" | "auto";
}) {
  return (
    <div
      className={cn(
        "kpi-grid",
        fit === "cols" && "sm:grid-cols-2 lg:grid-cols-4",
        fit === "auto" && "kpi-grid--autofit",
        className,
      )}
    >
      {children}
    </div>
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
    <div className={cn("kpi-card", `kpi-card--${tone}`)}>
      <div className="kpi-card__top">
        <div className="kpi-card__copy">
          <p className="kpi-card__label">{label}</p>
          {hint && <p className="kpi-card__hint">{hint}</p>}
        </div>
        {icon && (
          <span className={cn("kpi-card__icon", KPI_ICON_RING[tone])} aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <p className="kpi-card__value">{value}</p>
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
  compact,
  tone = "primary",
  collapsible,
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  onToggleCollapse,
  scrollBody,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  compact?: boolean;
  tone?: Tone;
  collapsible?: boolean;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Parent resizable panel handles shrink — body stays mounted, only header toggles size. */
  onToggleCollapse?: () => void;
  /** Fill remaining panel height and scroll body content. */
  scrollBody?: boolean;
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsed ?? internalCollapsed;
  const resizeControlled = !!onToggleCollapse;

  function toggleCollapsed() {
    if (onToggleCollapse) {
      onToggleCollapse();
      return;
    }
    const next = !isCollapsed;
    onCollapsedChange?.(next);
    if (collapsed === undefined) setInternalCollapsed(next);
  }

  function expandFromHeader() {
    if (isCollapsed && collapsible) toggleCollapsed();
  }

  function handleHeaderKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (!isCollapsed || !collapsible) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleCollapsed();
    }
  }

  const showHeader = title || action || collapsible;
  const hideBody = !resizeControlled && isCollapsed;
  const headerExpands = collapsible && isCollapsed;

  const bodyInner = (
    <div
      className={cn(
        bodyClassName ? undefined : compact ? "p-0" : "p-3.5",
        bodyClassName,
        (resizeControlled || scrollBody) && "min-h-0 flex-1 overflow-y-auto overscroll-contain",
      )}
    >
      {children}
    </div>
  );

  return (
    <section
      className={cn(
        "panel flex w-full flex-col overflow-hidden",
        isCollapsed
          ? "shrink-0"
          : scrollBody || resizeControlled
            ? "h-full min-h-0 flex-1"
            : "min-w-0",
        className,
      )}
    >
      {showHeader && (
        <header
          className={cn(
            "panel-header shrink-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5",
            `panel-header--${tone}`,
            !isCollapsed && "panel-header--open",
            headerExpands && "panel-header--expandable",
          )}
          role={headerExpands ? "button" : undefined}
          tabIndex={headerExpands ? 0 : undefined}
          aria-expanded={collapsible ? !isCollapsed : undefined}
          aria-label={headerExpands ? `Expand ${title ?? "section"}` : undefined}
          onClick={headerExpands ? expandFromHeader : undefined}
          onKeyDown={headerExpands ? handleHeaderKeyDown : undefined}
        >
          <div className="panel-header__text min-w-0">
            {title && <h2 className="panel-header__title">{title}</h2>}
            {description && <p className="panel-header__desc">{description}</p>}
          </div>
          {(action || collapsible) && (
            <div
              className="flex shrink-0 items-center gap-2 self-center"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {action}
              {collapsible && (
                <button
                  type="button"
                  className="panel-header__collapse"
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? "Expand section" : "Minimize section"}
                  title={isCollapsed ? "Expand section" : "Minimize section"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapsed();
                  }}
                >
                  <span className="relative size-3.5" aria-hidden>
                    <Minus
                      className={cn(
                        "absolute inset-0 size-3.5 transition-opacity duration-150",
                        isCollapsed ? "opacity-0" : "opacity-100",
                      )}
                      strokeWidth={2.5}
                    />
                    <Plus
                      className={cn(
                        "absolute inset-0 size-3.5 transition-opacity duration-150",
                        isCollapsed ? "opacity-100" : "opacity-0",
                      )}
                      strokeWidth={2.5}
                    />
                  </span>
                </button>
              )}
            </div>
          )}
        </header>
      )}
      {collapsible && !resizeControlled ? (
        <div
          className={cn(
            "grid min-h-0 transition-[grid-template-rows] duration-200 ease-out",
            hideBody ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
            !hideBody && (scrollBody || resizeControlled) && "flex-1",
          )}
        >
          <div
            className={cn(
              "min-h-0 overflow-hidden",
              scrollBody && !hideBody && "flex h-full min-h-0 flex-col",
            )}
          >
            {bodyInner}
          </div>
        </div>
      ) : (
        !hideBody && bodyInner
      )}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
  flush,
  compact,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Fill panel body with inset dashed outline. */
  flush?: boolean;
  /** Tight padding for nested panel placeholders. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "motion-empty flex flex-col items-center justify-center border-2 border-dashed border-border bg-gradient-to-b from-muted/40 to-transparent text-center",
        compact ? "px-3 py-4" : "px-4 py-10",
        flush ? "m-3 min-h-0 flex-1 rounded-xl" : "rounded-xl",
      )}
    >
      <p className={cn("font-bold", compact ? "text-xs" : "text-sm")}>{title}</p>
      {description && (
        <p className={cn("mt-1 max-w-sm text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="data-row flex flex-col gap-1 border-b border-border/50 py-2.5 text-xs last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 font-semibold break-words sm:max-w-[65%] sm:text-right">{value}</span>
    </div>
  );
}

export function List({ children, className, stagger = true }: { children: ReactNode; className?: string; stagger?: boolean }) {
  return <ul className={cn("divide-y divide-border/60", stagger && "list-stagger", className)}>{children}</ul>;
}

export function ListRow({
  children,
  className,
  as: Tag = "li",
}: {
  children: ReactNode;
  className?: string;
  as?: "li" | "div";
}) {
  return <Tag className={className}>{children}</Tag>;
}

export function ListLink({
  children,
  className,
  ...props
}: ComponentProps<typeof Link> & { children: ReactNode }) {
  return (
    <Link
      {...props}
      className={cn(
        "flex flex-col gap-1.5 px-3 py-2.5 transition-colors hover:bg-primary/6 active:bg-surface-2 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3",
        className,
      )}
    />
  );
}

export function AppPhoneField({
  value,
  onChange,
  disabled,
  placeholder = "1711234567",
  maxLength = 10,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div className="app-phone-field">
      <span className="app-phone-prefix">+880</span>
      <input
        className="app-phone-input"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
      />
    </div>
  );
}

export function EntityProfileLink({
  to,
  params,
  label,
  hint,
}: {
  to: "/drivers/$driverId" | "/fleet/$vehicleId";
  params: { driverId: string } | { vehicleId: string };
  label: string;
  hint?: string;
}) {
  return (
    <Link
      to={to}
      params={params}
      className="inline-flex flex-col rounded-md border border-border bg-surface-2/50 px-3 py-2 transition-colors hover:bg-surface-2"
    >
      <span className="text-xs font-medium text-foreground">{label}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </Link>
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
    <ol className="motion-timeline relative space-y-2.5 pl-5">
      <span className="absolute top-1.5 bottom-1.5 left-[5px] w-px bg-border" aria-hidden />
      {points.map((p, i) => {
        const done = activeIndex > i;
        const active = activeIndex === i;
        return (
          <li key={`${p.name}-${i}`} className="relative">
            <span
              className={cn(
                "absolute top-1 -left-5 size-2.5 rounded-full border-2 bg-background",
                done ? "border-success bg-success" : active ? "motion-timeline-active border-primary bg-primary" : "border-border",
              )}
              aria-hidden
            />
            <p className="text-xs font-medium sm:text-sm">{p.name}</p>
            {p.address && <p className="text-[11px] text-muted-foreground sm:text-xs">{p.address}</p>}
            <div className="mt-1">
              <MetaChip
                label={p.point_type.replace(/_/g, " ")}
                tone={i === 0 ? "primary" : i === points.length - 1 ? "success" : "info"}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
