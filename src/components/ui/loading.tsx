import { Skeleton, SkeletonText } from "./skeleton";

function HeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80 max-w-[70vw]" />
      </div>
      {action ? <Skeleton className="hidden h-9 w-36 sm:block" /> : null}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface" aria-busy="true" aria-live="polite">
      <div className="flex gap-4 border-b border-line bg-surface-subtle px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-b-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={c === 0 ? "h-4 flex-[1.4]" : c === cols - 1 ? "h-5 w-20 flex-none rounded-full" : "h-3.5 flex-1"} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex justify-between">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="size-8" />
          </div>
          <Skeleton className="mt-3 h-8 w-16" />
          <Skeleton className="mt-3 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-surface ${className ?? ""}`}>
      <div className="border-b border-line px-5 py-4">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="px-5 py-4">
        <SkeletonText lines={lines} />
      </div>
    </div>
  );
}

export function TablePageSkeleton() {
  return (
    <div className="animate-fade-in" aria-busy="true">
      <HeaderSkeleton />
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>
      <TableSkeleton />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="animate-fade-in space-y-6" aria-busy="true">
      <HeaderSkeleton />
      <StatsSkeleton />
      <div className="grid gap-4 lg:grid-cols-3">
        <CardSkeleton lines={6} className="lg:col-span-2" />
        <CardSkeleton lines={6} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={5} />
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-fade-in" aria-busy="true">
      <HeaderSkeleton />
      <Skeleton className="mb-6 h-14 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={4} />
        </div>
        <CardSkeleton lines={8} />
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="animate-fade-in" aria-busy="true">
      <HeaderSkeleton action={false} />
      <Skeleton className="mb-6 h-12 w-full rounded-xl" />
      <div className="rounded-xl border border-line bg-surface p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="grid gap-6 border-b border-line py-6 first:pt-0 last:border-0 lg:grid-cols-[16rem_1fr]">
            <SkeletonText lines={2} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10 sm:col-span-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardsPageSkeleton() {
  return (
    <div className="animate-fade-in" aria-busy="true">
      <HeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} lines={4} />
        ))}
      </div>
    </div>
  );
}
