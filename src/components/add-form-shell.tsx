import type { FormEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/fleet";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

const HEADER_TONE: Record<Tone, string> = {
  primary:
    "from-primary via-primary/92 to-primary/85 bg-gradient-to-br text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.22)]",
  info: "from-info via-info/90 to-primary/80 bg-gradient-to-br text-white shadow-[inset_0_1px_0_oklch(1_0_0/0.22)]",
  success:
    "from-success via-success/88 to-success/75 bg-gradient-to-br text-white shadow-[inset_0_1px_0_oklch(1_0_0/0.22)]",
  warning:
    "from-warning via-warning/90 to-warning/80 bg-gradient-to-br text-warning-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.22)]",
  danger: "from-destructive via-destructive/90 to-destructive/80 bg-gradient-to-br text-white",
  neutral: "from-muted-foreground/80 via-muted-foreground/70 to-muted bg-gradient-to-br text-white",
  violet: "from-violet via-violet/90 to-violet/80 bg-gradient-to-br text-violet-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.22)]",
  coral: "from-coral via-coral/90 to-coral/80 bg-gradient-to-br text-coral-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.22)]",
  rose: "from-rose via-rose/90 to-rose/80 bg-gradient-to-br text-rose-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.22)]",
  sky: "from-sky via-sky/90 to-sky/80 bg-gradient-to-br text-sky-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.22)]",
};

type AddEntityPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon: ReactNode;
  tone?: Tone;
  formId: string;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  submitDisabled?: boolean;
  submitPending?: boolean;
  onCancel?: () => void;
  wide?: boolean;
  sectionColumns?: 1 | 2 | 3;
};

/** Right slide-over panel for create flows — list stays visible behind (modern SaaS pattern). */
export function AddEntityPanel({
  open,
  onOpenChange,
  title,
  description,
  icon,
  tone = "primary",
  formId,
  onSubmit,
  children,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  submitDisabled,
  submitPending,
  onCancel,
  wide,
  sectionColumns = 1,
}: AddEntityPanelProps) {
  function close() {
    onCancel?.();
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        overlayClassName="bg-foreground/25 backdrop-blur-[2px]"
        className={cn(
          "add-entity-sheet flex h-full w-full flex-col gap-0 border-l p-0 sm:max-w-md",
          wide && "sm:max-w-lg",
          "[&>button]:right-3 [&>button]:top-3 [&>button]:z-10 [&>button]:text-white/80 [&>button]:hover:text-white",
        )}
      >
        <div className={cn("add-entity-sheet__header shrink-0", HEADER_TONE[tone])}>
          <div className="flex items-center gap-2.5 pr-8">
            <span className="add-entity-dialog__icon add-entity-dialog__icon--compact" aria-hidden>
              {icon}
            </span>
            <div className="min-w-0">
              <SheetTitle className="text-sm font-bold tracking-tight text-inherit sm:text-base">{title}</SheetTitle>
              {description && (
                <SheetDescription className="line-clamp-2 text-[11px] text-inherit/80 sm:text-xs">{description}</SheetDescription>
              )}
            </div>
          </div>
        </div>

        <div className="add-entity-sheet__body min-h-0 flex-1">
          <form id={formId} onSubmit={onSubmit}>
            <div
              className={cn(
                "add-entity-dialog__sections",
                sectionColumns === 2 && "add-entity-dialog__sections--2",
                sectionColumns === 3 && "add-entity-dialog__sections--3",
              )}
            >
              {children}
            </div>
          </form>
        </div>

        <div className="add-entity-sheet__footer shrink-0">
          <Button type="button" size="sm" variant="outline" onClick={close} tooltip="Discard and close">
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            form={formId}
            size="sm"
            disabled={submitDisabled || submitPending}
            tooltip={`${submitLabel} this record`}
          >
            {submitPending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** @deprecated name — use AddEntityPanel */
export const AddEntityDialog = AddEntityPanel;

export function AddFormSection({
  title,
  description,
  children,
  className,
  compact = false,
  columns = 1,
  flat,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
  columns?: 1 | 2 | 3 | 4;
  flat?: boolean;
}) {
  return (
    <section
      className={cn(
        "add-form-section",
        compact && "add-form-section--compact",
        flat && "add-form-section--flat",
        className,
      )}
    >
      <div className="add-form-section__head">
        <h3 className="add-form-section__title">{title}</h3>
        {description && <p className="add-form-section__desc">{description}</p>}
      </div>
      <div
        className={cn(
          "add-form-section__body form-grid",
          columns === 1 && "grid-cols-1",
          columns === 2 && "sm:grid-cols-2",
          columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
          columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function AddPageHero({
  title,
  subtitle,
  icon,
  tone = "primary",
  children,
  compact,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  tone?: Tone;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("add-page-hero", compact && "add-page-hero--compact", HEADER_TONE[tone])}>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("add-entity-dialog__icon", compact && "add-entity-dialog__icon--compact")} aria-hidden>
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className={cn("font-bold tracking-tight", compact ? "text-base sm:text-lg" : "text-lg sm:text-xl")}>{title}</h2>
            {subtitle && (
              <p className={cn("text-inherit/80", compact ? "text-xs" : "mt-0.5 text-sm")}>{subtitle}</p>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
