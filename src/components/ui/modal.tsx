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
        {/* Content sits inside a flex overlay: the entry animation sets `transform`, so translate-based centring would be overwritten. */}
        <Dialog.Overlay className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center overflow-y-auto bg-ink-900/40 backdrop-blur-[2px] sm:items-center sm:p-4">
          <Dialog.Content
            className={cn(
              "relative flex max-h-[92dvh] w-full animate-fade-up flex-col rounded-t-2xl bg-surface shadow-overlay focus:outline-none sm:max-h-[88vh] sm:animate-scale-in sm:rounded-xl",
              size === "sm" && "sm:max-w-md",
              size === "md" && "sm:max-w-lg",
              size === "lg" && "sm:max-w-2xl"
            )}
          >
            <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-6">
              <div className="min-w-0">
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
            {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-6">{children}</div> : null}
            {footer ? (
              <div className="flex shrink-0 flex-wrap-reverse justify-end gap-2 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 [&>button]:min-w-[8rem] [&>button]:flex-1 sm:[&>button]:flex-none">
                {footer}
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Overlay>
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
