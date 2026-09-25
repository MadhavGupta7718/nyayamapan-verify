"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  trigger?: React.ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink-900/40 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 animate-scale-in flex-col rounded-xl bg-surface shadow-overlay focus:outline-none",
            size === "sm" && "max-w-md",
            size === "md" && "max-w-lg",
            size === "lg" && "max-w-2xl"
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
            <div>
              <Dialog.Title className="text-h3 text-fg">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-body-sm text-fg-muted">{description}</Dialog.Description>
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
          {children ? <div className="overflow-y-auto px-6 py-3">{children}</div> : null}
          {footer ? <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Confirmation for irreversible or legally significant actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "primary",
  loading,
  onConfirm,
  children,
  confirmDisabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel: React.ReactNode;
  tone?: "primary" | "danger" | "success";
  loading?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
  confirmDisabled?: boolean;
}) {
  const t = useTranslations("common");
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("cancel")}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
