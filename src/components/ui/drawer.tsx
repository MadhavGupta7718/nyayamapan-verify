"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = "right",
  width = "md",
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "left";
  width?: "sm" | "md" | "lg";
  trigger?: React.ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink-900/40" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 z-50 flex w-full flex-col bg-surface shadow-overlay focus:outline-none",
            side === "right" ? "right-0 animate-slide-in-right" : "left-0 animate-slide-in-left",
            width === "sm" && "max-w-sm",
            width === "md" && "max-w-lg",
            width === "lg" && "max-w-2xl"
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-h3 text-fg">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-body-sm text-fg-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t("close")}>
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">{children}</div>
          {footer ? <div className="flex justify-end gap-2 border-t border-line bg-surface-subtle px-6 py-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
