import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Step = { key: string; label: React.ReactNode; description?: React.ReactNode };

/** Horizontal progress stepper. `current` = index of active step; `failedAt` marks a blocked step. */
export function Stepper({
  steps,
  current,
  failedAt,
  className,
  onStepClick,
}: {
  steps: Step[];
  current: number;
  failedAt?: number;
  className?: string;
  onStepClick?: (index: number) => void;
}) {
  return (
    <div className={className}>
      <ol className="flex w-full items-start">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const failed = failedAt === i;
          const clickable = onStepClick && i <= current;
          const Node = (
            <span
              className={cn(
                "relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-caption font-semibold ring-4 ring-surface transition-colors duration-300",
                done && "bg-brand-700 text-white",
                active && !failed && "bg-surface text-brand-800 ring-brand-100 [box-shadow:inset_0_0_0_2px_theme(colors.brand.700)]",
                failed && "bg-danger-600 text-white",
                !done && !active && !failed && "bg-surface text-fg-subtle [box-shadow:inset_0_0_0_1.5px_theme(colors.ink.300)]"
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
          );
          return (
            <li key={s.key} className="relative flex flex-1 flex-col items-center text-center" aria-current={active ? "step" : undefined}>
              {i < steps.length - 1 ? (
                <span className="absolute left-1/2 top-4 h-0.5 w-full -translate-y-1/2 bg-ink-200" aria-hidden>
                  <span
                    className="block h-full bg-brand-700 transition-[width] duration-500 ease-out"
                    style={{ width: done ? "100%" : "0%" }}
                  />
                </span>
              ) : null}
              {clickable ? (
                <button type="button" onClick={() => onStepClick?.(i)} className="rounded-full" aria-label={String(i + 1)}>
                  {Node}
                </button>
              ) : (
                Node
              )}
              <span
                className={cn(
                  "mt-2 hidden max-w-[9rem] px-1 text-caption sm:block",
                  active ? "font-semibold text-fg" : done ? "text-fg-muted" : "text-fg-subtle"
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      {steps[current] ? (
        <p className="mt-3 text-center text-body-sm font-semibold text-fg sm:hidden">
          {current + 1}/{steps.length} · {steps[current].label}
        </p>
      ) : null}
    </div>
  );
}
