import * as React from "react";
import {
  CloudOff,
  FileQuestion,
  Inbox,
  Lock,
  ServerCrash,
  ShieldAlert,
  TimerOff,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      <span className="relative mb-4 grid size-12 place-items-center rounded-xl bg-surface-sunken text-fg-subtle ring-1 ring-inset ring-line">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="text-h4 text-fg">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-body-sm text-fg-subtle text-pretty">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export type ErrorKind = "network" | "unauthorized" | "forbidden" | "notFound" | "server" | "validation" | "timeout";

const ERROR_ICONS: Record<ErrorKind, LucideIcon> = {
  network: CloudOff,
  unauthorized: Lock,
  forbidden: ShieldAlert,
  notFound: FileQuestion,
  server: ServerCrash,
  validation: TriangleAlert,
  timeout: TimerOff,
};

export function ErrorState({
  kind,
  title,
  description,
  action,
  code,
  className,
}: {
  kind: ErrorKind;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  code?: string | number;
  className?: string;
}) {
  const Icon = ERROR_ICONS[kind];
  const tone =
    kind === "forbidden" || kind === "unauthorized"
      ? "bg-warning-50 text-warning-700 ring-warning-200"
      : kind === "notFound"
        ? "bg-ink-50 text-ink-600 ring-ink-200"
        : "bg-danger-50 text-danger-700 ring-danger-200";
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <span className={cn("mb-4 grid size-14 place-items-center rounded-2xl ring-1 ring-inset", tone)}>
        <Icon className="size-6" aria-hidden />
      </span>
      {code ? <p className="mb-1 font-mono text-caption text-fg-subtle">{code}</p> : null}
      <h2 className="text-h3 text-fg">{title}</h2>
      {description ? <p className="mt-1.5 max-w-md text-body-sm text-fg-muted text-pretty">{description}</p> : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function InlineAlert({
  tone = "info",
  title,
  children,
  className,
  icon,
}: {
  tone?: "info" | "warning" | "danger" | "success" | "neutral";
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  const cls = {
    info: "border-info-200 bg-info-50 text-info-800",
    warning: "border-warning-200 bg-warning-50 text-warning-800",
    danger: "border-danger-200 bg-danger-50 text-danger-800",
    success: "border-success-200 bg-success-50 text-success-800",
    neutral: "border-line bg-surface-subtle text-fg-muted",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-body-sm", cls, className)}>
      {icon ? <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span> : null}
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div> : null}
      </div>
    </div>
  );
}
