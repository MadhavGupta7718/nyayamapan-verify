import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-overline uppercase text-fg-subtle">{eyebrow}</p> : null}
        <h1 className="text-h1 text-fg text-balance">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-body text-fg-muted text-pretty">{description}</p> : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-4", className)}>
      <div>
        <h2 className="text-h3 text-fg">{title}</h2>
        {description ? <p className="mt-0.5 text-body-sm text-fg-subtle">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
