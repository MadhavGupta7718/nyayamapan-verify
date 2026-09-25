"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, Copy, Download, PauseCircle, PlayCircle, Printer } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { api, errorMessage } from "@/lib/api-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/input";

type Action = "revoke" | "suspend" | "reinstate";

export function CertificateActions({
  id,
  number,
  verifyUrl,
  status,
  canManage,
}: {
  id: string;
  number: string;
  verifyUrl: string | null;
  status: string;
  canManage: boolean;
}) {
  const t = useTranslations("certificates.actions");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [action, setAction] = React.useState<Action | null>(null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const available: Action[] = !canManage
    ? []
    : status === "ACTIVE"
      ? ["suspend", "revoke"]
      : status === "SUSPENDED"
        ? ["reinstate", "revoke"]
        : status === "EXPIRED"
          ? ["revoke"]
          : [];

  async function confirm() {
    if (!action) return;
    setBusy(true);
    try {
      await api(`/api/certificates/${id}/revoke`, { body: { action, reason: reason.trim() } });
      toast.success(t(`${action}.done`, { number }));
      setAction(null);
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e, te));
    } finally {
      setBusy(false);
    }
  }

  function print() {
    const w = window.open(`/api/certificates/${id}/pdf?inline=1`, "_blank", "noopener");
    if (!w) toast.error(t("popupBlocked"));
  }

  async function copy() {
    if (!verifyUrl) return;
    try {
      await navigator.clipboard.writeText(verifyUrl);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  const ICON: Record<Action, React.ReactNode> = { revoke: <Ban />, suspend: <PauseCircle />, reinstate: <PlayCircle /> };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <a href={`/api/certificates/${id}/pdf`} className={buttonVariants()} download>
          <Download /> {t("download")}
        </a>
        <Button variant="secondary" onClick={print}>
          <Printer /> {t("print")}
        </Button>
        {verifyUrl ? (
          <Button variant="secondary" onClick={copy}>
            <Copy /> {t("copyLink")}
          </Button>
        ) : null}
        {available.map((a) => (
          <Button key={a} variant={a === "revoke" ? "danger" : a === "suspend" ? "secondary" : "success"} onClick={() => setAction(a)}>
            {ICON[a]} {t(`${a}.button`)}
          </Button>
        ))}
      </div>
      <ConfirmDialog
        open={!!action}
        onOpenChange={(o) => {
          if (!o) {
            setAction(null);
            setReason("");
          }
        }}
        title={action ? t(`${action}.title`, { number }) : ""}
        description={action ? t(`${action}.desc`) : undefined}
        confirmLabel={action ? t(`${action}.confirm`) : ""}
        tone={action === "reinstate" ? "success" : "danger"}
        loading={busy}
        confirmDisabled={reason.trim().length < 10}
        onConfirm={confirm}
      >
        <Field id="cert-reason" label={t("reason")} required hint={t("reasonHint")}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={1000} autoFocus />
        </Field>
      </ConfirmDialog>
    </>
  );
}
