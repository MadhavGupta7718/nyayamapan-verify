import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn("field-control h-10", className)} {...props} />
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn("field-control min-h-[96px] py-2.5 leading-relaxed", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn("field-control h-10 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
    </div>
  )
);
Select.displayName = "Select";

export function Label({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn("mb-1.5 block text-label text-fg", className)} {...props}>
      {children}
      {required ? (
        <span className="ml-0.5 text-danger-600" aria-hidden>
          *
        </span>
      ) : null}
    </label>
  );
}

/** Label + control + hint/error, wired for accessibility. */
export function Field({
  id,
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string; required?: boolean }>;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = React.cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    required,
  });
  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {control}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-caption font-medium text-danger-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-caption text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  className,
  label,
  description,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; description?: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3", className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line-strong text-brand-700 accent-brand-700"
        {...props}
      />
      <span>
        <span className="block text-body-sm font-medium text-fg">{label}</span>
        {description ? <span className="mt-0.5 block text-caption text-fg-subtle">{description}</span> : null}
      </span>
    </label>
  );
}
