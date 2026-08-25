import { GripHorizontal, GripVertical } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "@/lib/utils";

const ResizablePanelGroup = ({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof Group>) => (
  <Group
    orientation={orientation}
    className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)}
    {...props}
  />
);

const ResizablePanel = Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) => (
  <Separator
    className={cn(
      "group relative flex w-2 items-center justify-center bg-transparent transition-colors hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[panel-group-direction=vertical]:h-2 data-[panel-group-direction=vertical]:w-full",
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div
        className="z-10 flex items-center justify-center rounded-full border border-border bg-background px-1.5 py-1 text-muted-foreground shadow-sm transition-colors group-hover:border-primary/35 group-hover:bg-primary/10 group-hover:text-primary group-data-[panel-group-direction=vertical]:px-1 group-data-[panel-group-direction=vertical]:py-1.5"
        aria-hidden
      >
        <GripVertical className="size-3.5 group-data-[panel-group-direction=vertical]:hidden" />
        <GripHorizontal className="hidden size-3.5 group-data-[panel-group-direction=vertical]:block" />
      </div>
    )}
  </Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
