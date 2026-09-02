import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Mobile-only option sheet for Plan your ride (desktop uses inline controls). */
export function PlanRideChooser({
  open,
  onOpenChange,
  title,
  children,
  className,
  wide = false,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
  wide?: boolean;
  description?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn("plan-ride-sheet rounded-t-2xl", wide && "max-h-[85dvh]", className)}
      >
        <SheetHeader className="text-left">
          <SheetTitle>{title}</SheetTitle>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </SheetHeader>
        <div className="mt-3 min-w-0">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
