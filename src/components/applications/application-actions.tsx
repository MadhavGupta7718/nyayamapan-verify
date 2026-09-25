"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, CheckCircle2, Search, Send, Undo2, XCircle } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { Checkbox, Field, Textarea } from "@/components/ui/input";

type Action = "submit" | "cancel" | "startReview" | "approve" | "return" | "reject";

const META: Record<Action, { icon: React.ElementType; variant: "primary" | "secondary" | "danger" | "success"; reason?: boolean; tone?: "primary" | "danger" | "success" }> = {
  startReview: { icon: Search, variant: "primary" },
  approve: { icon: CheckCircle2, variant: "success", tone: "success" },
  return: { icon: Undo2, variant: "secondary", reason: true },
  reject: { icon: XCircle, variant: "danger", reason: true, tone: "danger" },
  submit: { icon: Send, variant: "primary" },
  cancel: { icon: Ban, variant: "secondary", reason: true, tone: "danger" },
};

const ORDER: Action[] = ["cancel", "return", "reject", "startReview", "approve", "submit"];

export function ApplicationActions({
  applicationId,
  actions,
  needsDeclaration,
}: {
  applicationId: string;
  actions: Action[];
  needsDeclaration: boolean;
}) {
  const t = useTranslations("applications.actions");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [open, setOpen] = React.useState<Action | null>(null);
  const [reason, setReason] = React.useState("");
  const [declared, setDeclared] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const def = open ? META[open] : null;
  const reasonOk = !def?.reason || reason.trim().length >= 5;
  const declOk = open !== "submit" || !needsDeclaration || declared;

  async function run() {
    if (!open) return;
    setLoading(true);
    try {
      await api(`/api/applications/${applicationId}`, {
        method: "PATCH",
        body: { action: open, reason: reason.trim() || undefined, declarationAccepted: open === "submit" ? declared || undefined : undefined },
      });
      toast.success(t(`${open}.done`));
      setOpen(null);
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e, te));
    } finally {
      setLoading(false);
    }
  }

  if (!actions.length) return null;
  return (
    <>
      {ORDER.filter((a) => actions.includes(a)).map((a) => {
        const Icon = META[a].icon;
        return (
          <Button key={a} variant={META[a].variant} onClick={() => setOpen(a)}>
            <Icon /> {t(`${a}.label`)}
          </Button>
        );
      })}
      <ConfirmDialog
        open={!!open}
        onOpenChange={(o) => !o && !loading && setOpen(null)}
        title={open ? t(`${open}.title`) : ""}
        description={open ? t(`${open}.desc`) : ""}
        confirmLabel={open ? t(`${open}.confirm`) : ""}
        tone={def?.tone ?? "primary"}
        loading={loading}
        confirmDisabled={!reasonOk || !declOk}
        onConfirm={run}
      >
        {def?.reason ? (
          <Field id="action-reason" label={t("reasonLabel")} required hint={t("reasonHint")}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={1000} autoFocus />
          </Field>
        ) : null}
        {open === "submit" && needsDeclaration ? (
          <Checkbox
            checked={declared}
            onChange={(e) => setDeclared(e.target.checked)}
            label={t("declaration")}
            className="mt-2 rounded-lg bg-surface-subtle p-3"
          />
        ) : null}
      </ConfirmDialog>
    </>
  );
}
