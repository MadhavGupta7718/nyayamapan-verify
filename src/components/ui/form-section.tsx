import * as React from "react";
import { cn } from "@/lib/utils";

/** Groups related fields with a title column on desktop and stacked on mobile. */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-x-8 gap-y-4 border-b border-line py-6 first:pt-0 last:border-b-0 last:pb-0 lg:grid-cols-[16rem_1fr]", className)}>
      <div>
        <h3 className="text-h4 text-fg">{title}</h3>
        {description ? <p className="mt-1 text-body-sm text-fg-subtle text-pretty">{description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
