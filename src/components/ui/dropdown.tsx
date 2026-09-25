"use client";

import * as React from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dropdown = Menu.Root;
export const DropdownTrigger = Menu.Trigger;

export function DropdownContent({
  className,
  align = "end",
  children,
  ...props
}: Menu.DropdownMenuContentProps) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-[60] min-w-[12rem] animate-scale-in rounded-lg border border-line bg-surface p-1 shadow-lg focus:outline-none",
          className
        )}
        {...props}
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

export function DropdownItem({
  className,
  icon,
  tone,
  children,
  ...props
}: Menu.DropdownMenuItemProps & { icon?: React.ReactNode; tone?: "danger" }) {
  return (
    <Menu.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-body-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-ink-100 data-[disabled]:opacity-50 [&_svg]:size-4",
        tone === "danger" ? "text-danger-700 data-[highlighted]:bg-danger-50" : "text-fg",
        className
      )}
      {...props}
    >
      {icon ? <span className="text-fg-subtle">{icon}</span> : null}
      {children}
    </Menu.Item>
  );
}

export function DropdownCheckboxItem({ className, children, ...props }: Menu.DropdownMenuCheckboxItemProps) {
  return (
    <Menu.CheckboxItem
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-md py-2 pl-8 pr-2.5 text-body-sm text-fg outline-none data-[highlighted]:bg-ink-100",
        className
      )}
      onSelect={(e) => e.preventDefault()}
      {...props}
    >
      <Menu.ItemIndicator className="absolute left-2.5">
        <Check className="size-4 text-brand-700" />
      </Menu.ItemIndicator>
      {children}
    </Menu.CheckboxItem>
  );
}

export function DropdownLabel({ className, ...props }: Menu.DropdownMenuLabelProps) {
  return <Menu.Label className={cn("px-2.5 py-1.5 text-overline uppercase text-fg-subtle", className)} {...props} />;
}

export function DropdownSeparator() {
  return <Menu.Separator className="my-1 h-px bg-line" />;
}
