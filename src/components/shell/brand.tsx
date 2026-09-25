import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 shadow-sm ring-1 ring-inset ring-white/15",
        className
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18" />
        <path d="M7 21h10" />
        <path d="M4.5 7h15" />
        <path d="M6.5 7 3.5 13.5a3 3 0 0 0 6 0Z" />
        <path d="M17.5 7l-3 6.5a3 3 0 0 0 6 0Z" />
      </svg>
      <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-accent" />
    </span>
  );
}

export function BrandLockup({
  name,
  tagline,
  inverse,
  className,
}: {
  name: string;
  tagline?: string;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <BrandMark />
      <span className="min-w-0 leading-tight">
        <span className={cn("block truncate text-[0.95rem] font-semibold tracking-tight", inverse ? "text-white" : "text-fg")}>{name}</span>
        {tagline ? (
          <span className={cn("block truncate text-[0.6875rem]", inverse ? "text-brand-200" : "text-fg-subtle")}>{tagline}</span>
        ) : null}
      </span>
    </span>
  );
}
