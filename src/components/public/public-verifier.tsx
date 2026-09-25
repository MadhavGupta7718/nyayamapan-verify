"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Ban, Clock3, HelpCircle, PauseCircle, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import { Link } from "@/i18n/routing";
import { api, ApiError } from "@/lib/api-client";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

type Result = {
  status: "VALID" | "EXPIRED" | "REVOKED" | "SUSPENDED" | "INVALID";
  verifiedAt: string;
  sealIntact: boolean | null;
  certificate: null | {
    certificateNumber: string;
    instrumentType: string;
    instrumentTypeHi: string | null;
    manufacturer: string;
    modelName: string;
    serialNumber: string;
    verificationDate: string;
    validUntil: string | null;
    result: string;
    issuingAuthority: string;
    statusChangedAt: string | null;
  };
};

const MIN_CHECK_MS = 900;

const LOOK: Record<Result["status"], { ring: string; bg: string; text: string; icon: React.ReactNode }> = {
  VALID: { ring: "ring-success-200", bg: "bg-success-50", text: "text-success-800", icon: null },
  EXPIRED: { ring: "ring-warning-200", bg: "bg-warning-50", text: "text-warning-800", icon: <Clock3 className="size-10" /> },
  SUSPENDED: { ring: "ring-warning-200", bg: "bg-warning-50", text: "text-warning-800", icon: <PauseCircle className="size-10" /> },
  REVOKED: { ring: "ring-danger-200", bg: "bg-danger-50", text: "text-danger-800", icon: <Ban className="size-10" /> },
  INVALID: { ring: "ring-line", bg: "bg-surface-subtle", text: "text-fg", icon: <HelpCircle className="size-10" /> },
};

function Check() {
  return (
    <svg viewBox="0 0 52 52" className="size-12" aria-hidden>
      <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M15 27.5l7.5 7.5L38 18.5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="48" className="animate-check-draw" />
    </svg>
  );
}

export function PublicVerifier({ token }: { token: string }) {
  const t = useTranslations("verify");
  const locale = useLocale();
  const [state, setState] = React.useState<{ kind: "checking" } | { kind: "done"; data: Result } | { kind: "error"; code: string }>({ kind: "checking" });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    const started = Date.now();
    setState({ kind: "checking" });
    api<Result>(`/api/public/certificates/${encodeURIComponent(token)}`, { timeoutMs: 15_000 })
      .then(async (data) => {
        const wait = MIN_CHECK_MS - (Date.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (alive) setState({ kind: "done", data });
      })
      .catch((e) => alive && setState({ kind: "error", code: e instanceof ApiError ? e.code : "SERVER_ERROR" }));
    return () => {
      alive = false;
    };
  }, [token, attempt]);

  if (state.kind === "checking") {
    return (
      <div className="flex flex-col items-center py-14 text-center" role="status" aria-live="polite">
        <span className="relative grid size-20 place-items-center">
          <span className="absolute inset-0 animate-ring-pulse rounded-full bg-brand-200" />
          <span className="absolute inset-0 rounded-full border-4 border-brand-100" />
          <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-brand-600" />
        </span>
        <p className="mt-6 text-h3 text-fg">{t("checking")}</p>
        <p className="mt-1 text-body-sm text-fg-subtle">{t("checkingDesc")}</p>
      </div>
    );
  }

  if (state.kind === "error") {
    const offline = state.code === "OFFLINE" || state.code === "NETWORK" || state.code === "TIMEOUT";
    return (
      <div className="flex flex-col items-center py-12 text-center" role="alert">
        {offline ? <WifiOff className="size-10 text-fg-subtle" /> : <ShieldAlert className="size-10 text-fg-subtle" />}
        <p className="mt-4 text-h3 text-fg">{t(state.code === "RATE_LIMITED" ? "errors.rateLimited" : offline ? "errors.network" : "errors.server")}</p>
        <p className="mt-1 max-w-sm text-body-sm text-fg-muted">{t("errors.desc")}</p>
        <Button className="mt-6" variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
          <RefreshCw /> {t("retry")}
        </Button>
      </div>
    );
  }

  const { data } = state;
  const c = data.certificate;
  const look = LOOK[data.status];
  const typeName = c ? (locale === "hi" && c.instrumentTypeHi ? c.instrumentTypeHi : c.instrumentType) : "";

  return (
    <div className="animate-fade-up">
      <div className={cn("flex flex-col items-center rounded-xl px-6 py-8 text-center ring-1 ring-inset", look.bg, look.ring, look.text)} role="status" aria-live="polite">
        {data.status === "VALID" ? <Check /> : look.icon}
        <p className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-tight">{t(`status.${data.status}.title`)}</p>
        <p className="mt-1 max-w-md text-body-sm opacity-90">{t(`status.${data.status}.desc`)}</p>
        {c?.statusChangedAt && (data.status === "REVOKED" || data.status === "SUSPENDED") ? (
          <p className="mt-2 text-caption opacity-80">{t("changedOn", { date: formatDate(c.statusChangedAt, locale) })}</p>
        ) : null}
      </div>

      {c ? (
        <dl className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {[
            [t("fields.number"), <span key="n" className="font-mono">{c.certificateNumber}</span>],
            [t("fields.instrument"), typeName],
            [t("fields.makeModel"), `${c.manufacturer} ${c.modelName}`],
            [t("fields.serial"), <span key="s" className="font-mono">{c.serialNumber}</span>],
            [t("fields.verifiedOn"), formatDate(c.verificationDate, locale)],
            [t("fields.validUntil"), c.validUntil ? formatDate(c.validUntil, locale) : t("fields.notConfigured")],
            [t("fields.authority"), c.issuingAuthority],
            [
              t("fields.seal"),
              data.sealIntact == null ? t("seal.unsealed") : data.sealIntact ? <span key="seal" className="text-success-700">{t("seal.intact")}</span> : <span key="seal" className="font-medium text-danger-700">{t("seal.broken")}</span>,
            ],
          ].map(([k, v], i) => (
            <div key={i} className="min-w-0 border-b border-line pb-3">
              <dt className="text-caption text-fg-subtle">{k}</dt>
              <dd className="mt-0.5 break-words text-body text-fg">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-6 flex flex-col items-center justify-between gap-3 text-caption text-fg-subtle sm:flex-row">
        <span>{t("checkedAt", { time: formatDateTime(data.verifiedAt, locale) })}</span>
        <Link href="/verify" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          {t("another")}
        </Link>
      </div>
      <p className="mt-4 text-center text-caption text-fg-faint">{t("privacy")}</p>
    </div>
  );
}
