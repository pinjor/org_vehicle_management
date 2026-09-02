import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function WorkspaceSkeleton() {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="app-sidebar hidden shrink-0 flex-col lg:flex">
        <div className="app-sidebar-brand">
          <Skeleton className="app-sidebar-logo rounded-md" />
          <div className="app-sidebar-brand-text">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="mt-1.5 h-2.5 w-14" />
          </div>
        </div>
        <div className="app-sidebar-nav space-y-3">
          {Array.from({ length: 2 }).map((_, section) => (
            <div key={section} className="space-y-1.5">
              <Skeleton className="mx-2 h-2 w-16" />
              {Array.from({ length: section === 0 ? 3 : 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-2.5 py-2">
                  <Skeleton className="size-[1.125rem] rounded" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border px-4 py-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-1.5 h-3.5 w-56" />
        </header>
        <main className="flex-1 p-4">
          <PageContentSkeleton />
        </main>
      </div>
    </div>
  );
}

export function KpiGridSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-16" />
          <Skeleton className="mt-2 h-2.5 w-32" />
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ rows = 5, withSearch = false }: { rows?: number; withSearch?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-3.5 py-2.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-1 h-3 w-52" />
      </div>
      {withSearch && (
        <div className="border-b border-border p-3">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      )}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <div className="trip-list-row pointer-events-none" aria-hidden>
      <div className="flex flex-col gap-1 py-0.5">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-2.5 w-10" />
      </div>
      <div className="trip-list-row__body">
        <div className="trip-list-row__text space-y-1.5">
          <Skeleton className="h-3.5 w-2/5 max-w-[180px]" />
          <Skeleton className="h-3 w-3/5 max-w-xs" />
        </div>
        <div className="trip-list-row__end">
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function RequestCardSkeleton() {
  return (
    <div className="req-card-wrap pointer-events-none" aria-hidden>
      <div className="req-card">
        <div className="req-card__main">
          <div className="req-card__layout req-card__layout--when">
            <div className="flex flex-col gap-1.5 py-0.5">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-2.5 w-10" />
            </div>
            <div className="req-card__content min-w-0 space-y-2">
              <div className="req-card__top">
                <div className="req-card__who space-y-1.5">
                  <Skeleton className="h-4 w-36 max-w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-4/5 max-w-sm" />
                <Skeleton className="h-3 w-3/5 max-w-xs" />
              </div>
              <div className="flex gap-1.5">
                <Skeleton className="h-4 w-12 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RequestListSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="space-y-3 border-b border-border p-3">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <RequestCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function PageContentSkeleton() {
  return (
    <div className="space-y-4">
      <KpiGridSkeleton />
      <PanelSkeleton rows={6} withSearch />
    </div>
  );
}

export function DetailPageSkeleton({ kpiCount = 4 }: { kpiCount?: number }) {
  return (
    <div className="profile-page page-stack">
      <KpiGridSkeleton count={kpiCount} className="sm:grid-cols-2 lg:grid-cols-4" />
      <PanelSkeleton rows={4} />
      <PanelSkeleton rows={6} />
      <PanelSkeleton rows={4} />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="rounded-xl border border-border bg-surface p-5">
        <Skeleton className="mx-auto size-16 rounded-full" />
        <Skeleton className="mx-auto mt-4 h-5 w-40" />
        <Skeleton className="mx-auto mt-2 h-3 w-28" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between gap-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex gap-3 border-b border-border bg-muted/40 px-3 py-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-3 px-3 py-2.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-8 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssignmentSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-3 h-9 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function SettingsLookupsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(200px,240px)_1fr]">
      <PanelSkeleton rows={8} />
      <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
        <Skeleton className="h-5 w-40" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-full" />
          ))}
        </div>
        <TableSkeleton rows={6} cols={5} />
      </div>
    </div>
  );
}
