import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-surface shadow-xs", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700 [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-h4 text-fg">{title}</h2>
          {description ? <p className="mt-0.5 text-body-sm text-fg-subtle">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t border-line bg-surface-subtle px-5 py-3", className)}
      {...props}
    />
  );
}

/** Definition list used for record details (label → value rows). */
export function DetailList({
  items,
  columns = 2,
  className,
}: {
  items: { label: React.ReactNode; value: React.ReactNode; mono?: boolean; full?: boolean }[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4",
        columns === 1 ? "grid-cols-1" : columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {items.map((item, i) => (
        <div key={i} className={cn("min-w-0", item.full && "sm:col-span-full")}>
          <dt className="text-caption text-fg-subtle">{item.label}</dt>
          <dd className={cn("mt-0.5 break-words text-body-sm text-fg", item.mono && "font-mono text-[0.8125rem]")}>
            {item.value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
