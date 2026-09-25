import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "@/lib/status";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  href,
  emphasis,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  href?: string;
  emphasis?: boolean;
}) {
  const t = TONE_CLASSES[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-body-sm font-medium text-fg-muted">{label}</p>
        {icon ? (
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-md [&_svg]:size-4", t.soft, t.text)}>{icon}</span>
        ) : null}
      </div>
      <p className="mt-2 text-[1.875rem] font-semibold leading-none tracking-tight text-fg tabular">{value}</p>
      {hint ? <p className="mt-2 text-caption text-fg-subtle">{hint}</p> : null}
      {href ? (
        <ArrowUpRight
          className="absolute bottom-4 right-4 size-4 text-fg-faint opacity-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
          aria-hidden
        />
      ) : null}
    </>
  );
  const cls = cn(
    "group relative block rounded-xl border border-line bg-surface p-4 shadow-xs transition-[box-shadow,border-color,transform] duration-200",
    href && "hover:-translate-y-px hover:border-line-strong hover:shadow-md",
    emphasis && "border-l-[3px]",
    emphasis && tone === "warning" && "border-l-warning-500",
    emphasis && tone === "danger" && "border-l-danger-500",
    emphasis && tone === "success" && "border-l-success-500",
    emphasis && (tone === "info" || tone === "brand") && "border-l-brand-500"
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>{children}</div>;
}
