import * as React from "react";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "@/lib/status";

export function Badge({
  tone = "neutral",
  className,
  dot,
  children,
}: {
  tone?: Tone;
  className?: string;
  dot?: boolean;
  children: React.ReactNode;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-caption font-medium ring-1 ring-inset",
        t.badge,
        className
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", t.dot)} aria-hidden /> : null}
      {children}
    </span>
  );
}
