import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand-800 text-white shadow-xs hover:bg-brand-900",
        secondary: "border border-line-strong bg-surface text-fg shadow-xs hover:border-ink-400 hover:bg-surface-subtle",
        ghost: "text-fg-muted hover:bg-ink-100 hover:text-fg",
        subtle: "bg-brand-50 text-brand-800 hover:bg-brand-100",
        danger: "bg-danger-600 text-white shadow-xs hover:bg-danger-700",
        success: "bg-success-600 text-white shadow-xs hover:bg-success-700",
        link: "h-auto px-0 text-brand-700 underline-offset-4 hover:underline",
        inverse: "bg-white text-brand-900 shadow-sm hover:bg-brand-50",
      },
      size: {
        sm: "h-8 px-3 text-caption [&_svg]:size-3.5",
        md: "h-9 px-3.5 text-body-sm [&_svg]:size-4",
        lg: "h-11 px-5 text-body [&_svg]:size-4",
        xl: "h-14 px-6 text-body font-semibold [&_svg]:size-5",
        icon: "size-9 [&_svg]:size-4",
        "icon-sm": "size-8 [&_svg]:size-4",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, loading, disabled, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
);
Button.displayName = "Button";
