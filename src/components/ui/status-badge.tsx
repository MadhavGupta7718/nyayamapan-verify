"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { statusDef, TONE_CLASSES } from "@/lib/status";
import { STATUS_ICONS } from "./status-icon";
import { Tooltip } from "./tooltip";

/**
 * The one way to render a status anywhere in the portal: icon + colour + text + tooltip.
 * Descriptions are written for application/certificate statuses; pass `withTooltip={false}` for
 * documents, checklist items and test rows so they don't inherit that wording.
 */
export function StatusBadge({
  status,
  size = "sm",
  className,
  withTooltip = true,
}: {
  status: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
  withTooltip?: boolean;
}) {
  const t = useTranslations("status");
  const key = status ?? "PENDING";
  const def = statusDef(key);
  const Icon = STATUS_ICONS[def.icon];
  const tone = TONE_CLASSES[def.tone];
  const label = t.has(`${key}.label`) ? t(`${key}.label`) : key.replaceAll("_", " ").toLowerCase();
  const desc = withTooltip && t.has(`${key}.desc`) ? t(`${key}.desc`) : undefined;

  const badge = (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset",
        size === "sm" && "px-2 py-0.5 text-caption [&_svg]:size-3.5",
        size === "md" && "px-2.5 py-1 text-body-sm [&_svg]:size-4",
        size === "lg" && "px-3.5 py-1.5 text-body font-semibold [&_svg]:size-5",
        tone.badge,
        className
      )}
      tabIndex={withTooltip && desc ? 0 : undefined}
    >
      <Icon aria-hidden />
      <span className="truncate">{label}</span>
      {desc ? <span className="sr-only">. {desc}</span> : null}
    </span>
  );

  if (!desc) return badge;
  return <Tooltip content={desc}>{badge}</Tooltip>;
}
