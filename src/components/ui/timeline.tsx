import * as React from "react";
import { cn } from "@/lib/utils";
import { statusDef, TONE_CLASSES } from "@/lib/status";
import { STATUS_ICONS } from "./status-icon";

export type TimelineItem = {
  id: string;
  status?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  body?: React.ReactNode;
  pending?: boolean;
  current?: boolean;
};

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative", className)}>
      {items.map((item, i) => {
        const def = statusDef(item.status);
        const Icon = STATUS_ICONS[def.icon];
        const tone = TONE_CLASSES[def.tone];
        const last = i === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? (
              <span
                className={cn("absolute left-[15px] top-8 h-[calc(100%-1.75rem)] w-px", item.pending ? "border-l border-dashed border-ink-300" : "bg-ink-200")}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-surface [&_svg]:size-4",
                item.pending ? "bg-surface text-fg-faint [box-shadow:inset_0_0_0_1.5px_theme(colors.ink.300)]" : cn(tone.soft, tone.text),
                item.current && "[box-shadow:0_0_0_2px_theme(colors.brand.300)]"
              )}
            >
              <Icon aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className={cn("text-body-sm font-medium", item.pending ? "text-fg-subtle" : "text-fg")}>{item.title}</p>
              {item.meta ? <p className="mt-0.5 text-caption text-fg-subtle">{item.meta}</p> : null}
              {item.body ? <div className="mt-1.5 text-body-sm text-fg-muted">{item.body}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
