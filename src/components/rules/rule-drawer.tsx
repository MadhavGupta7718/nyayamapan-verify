"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ExternalLink, GitBranchPlus, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/routing";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { InlineAlert } from "@/components/ui/states";

export type RuleDetail = {
  id: string;
  ruleKey: string;
  ruleName: string;
  actName: string;
  ruleNumber: string | null;
  sectionNumber: string | null;
  parameter: string;
  requirement: string;
  unit: string | null;
  status: string;
  instrumentType: string | null;
  stateCode: string | null;
  sourceNotification: string | null;
  sourceDocument: string | null;
  amendmentReference: string | null;
  source: { title: string; url: string | null } | null;
  versions: {
    id: string;
    versionNumber: number;
    value: string | null;
    valueStatus: string;
    effectiveFrom: string;
    effectiveUntil: string | null;
    changeReason: string | null;
    approved: boolean;
    certificates: number;
  }[];
};

type Step = "submit" | "approve" | "activate" | "retire";
const NEXT: Record<string, Step[]> = {
  DRAFT: ["submit"],
  CONFIGURATION_REQUIRED: ["submit"],
  UNDER_REVIEW: ["approve"],
  APPROVED: ["activate", "retire"],
  ACTIVE: ["retire"],
};

export function RuleDrawer({ rule, canManage }: { rule: RuleDetail | null; canManage: boolean }) {
  const t = useTranslations("rules.drawer");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [step, setStep] = React.useState<Step | null>(null);
  const [reason, setReason] = React.useState("");
  const [versionOpen, setVersionOpen] = React.useState(false);
  const [v, setV] = React.useState({ value: "", valueStatus: "SET", effectiveFrom: "", changeReason: "" });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setStep(null);
    setReason("");
    setVersionOpen(false);
    setV({ value: "", valueStatus: "SET", effectiveFrom: "", changeReason: "" });
  }, [rule?.id]);

  function close() {
    const next = new URLSearchParams(sp.toString());
    next.delete("rule");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      setStep(null);
      setReason("");
      setVersionOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e, te));
    } finally {
      setBusy(false);
    }
  }

  const current = rule?.versions[0];
  const versionValid =
    v.effectiveFrom && v.changeReason.trim().length >= 10 && (v.valueStatus !== "SET" || v.value.trim().length > 0) && (!current || v.effectiveFrom > current.effectiveFrom);

  return (
    <Drawer
      open={!!rule}
      onOpenChange={(o) => !o && close()}
      width="lg"
      title={rule?.ruleName ?? ""}
      description={rule ? <span className="font-mono">{rule.ruleKey}</span> : undefined}
    >
      {rule ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={rule.status} size="md" />
            {current?.valueStatus === "CONFIGURATION_REQUIRED" ? <StatusBadge status="CONFIGURATION_REQUIRED" size="md" /> : null}
          </div>

          <section>
            <h3 className="mb-2 text-overline uppercase text-fg-subtle">{t("requirement")}</h3>
            <p className="text-body-sm text-fg">{rule.requirement}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-body-sm">
              {[
                [t("act"), rule.actName],
                [t("ruleNumber"), [rule.ruleNumber, rule.sectionNumber].filter(Boolean).join(" · ") || "—"],
                [t("parameter"), <span key="p" className="font-mono text-[0.8125rem]">{rule.parameter}</span>],
                [t("appliesTo"), [rule.instrumentType ?? t("allTypes"), rule.stateCode ?? t("allStates")].join(" · ")],
              ].map(([k, val], i) => (
                <div key={i}>
                  <dt className="text-caption text-fg-subtle">{k}</dt>
                  <dd className="mt-0.5 text-fg">{val}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-lg border border-line p-4">
            <h3 className="mb-2 flex items-center gap-2 text-body-sm font-semibold text-fg">
              <ShieldCheck className="size-4 text-brand-700" /> {t("source")}
            </h3>
            {rule.sourceNotification || rule.sourceDocument || rule.source ? (
              <ul className="space-y-1.5 text-body-sm text-fg-muted">
                {rule.sourceNotification ? <li>{rule.sourceNotification}</li> : null}
                {rule.amendmentReference ? <li>{t("amendment")}: {rule.amendmentReference}</li> : null}
                {rule.source ? <li>{rule.source.title}</li> : null}
                {[rule.sourceDocument, rule.source?.url].filter(Boolean).map((u) => (
                  <li key={u!}>
                    <a href={u!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-brand-700 hover:underline">
                      {u} <ExternalLink className="size-3.5 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-warning-700">{t("noSource")}</p>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-overline uppercase text-fg-subtle">{t("versions")}</h3>
              {canManage && rule.status !== "RETIRED" ? (
                <Button size="sm" variant="secondary" onClick={() => setVersionOpen((o) => !o)}>
                  <GitBranchPlus /> {t("newVersion")}
                </Button>
              ) : null}
            </div>

            {versionOpen ? (
              <div className="mb-4 space-y-3 rounded-lg bg-surface-subtle p-4">
                <InlineAlert tone="info">{t("versionNote")}</InlineAlert>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="v-status" label={t("valueStatus")} required>
                    <Select value={v.valueStatus} onChange={(e) => setV({ ...v, valueStatus: e.target.value })}>
                      <option value="SET">{t("statusSet")}</option>
                      <option value="CONFIGURATION_REQUIRED">{t("statusConfig")}</option>
                    </Select>
                  </Field>
                  <Field id="v-value" label={`${t("value")}${rule.unit ? ` (${rule.unit})` : ""}`} required={v.valueStatus === "SET"}>
                    <Input value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} disabled={v.valueStatus !== "SET"} maxLength={200} />
                  </Field>
                  <Field id="v-from" label={t("effectiveFrom")} required hint={current ? t("mustFollow", { date: current.effectiveFrom }) : undefined}>
                    <Input type="date" value={v.effectiveFrom} min={current?.effectiveFrom} onChange={(e) => setV({ ...v, effectiveFrom: e.target.value })} />
                  </Field>
                </div>
                <Field id="v-reason" label={t("changeReason")} required hint={t("reasonHint")}>
                  <Textarea rows={3} value={v.changeReason} onChange={(e) => setV({ ...v, changeReason: e.target.value })} maxLength={1000} />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setVersionOpen(false)} disabled={busy}>
                    {t("cancel")}
                  </Button>
                  <Button
                    loading={busy}
                    disabled={!versionValid}
                    onClick={() =>
                      run(
                        () =>
                          api(`/api/rules/${rule.id}/versions`, {
                            body: {
                              value: v.valueStatus === "SET" ? v.value.trim() : null,
                              valueStatus: v.valueStatus,
                              effectiveFrom: v.effectiveFrom,
                              changeReason: v.changeReason.trim(),
                            },
                          }),
                        t("versionCreated")
                      )
                    }
                  >
                    {t("createVersion")}
                  </Button>
                </div>
              </div>
            ) : null}

            <ol className="relative space-y-3 border-l border-line pl-5">
              {rule.versions.map((ver, i) => (
                <li key={ver.id} className="relative">
                  <span className={cn("absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full ring-4 ring-surface", i === 0 ? "bg-brand-600" : "bg-ink-300")} aria-hidden />
                  <div className="rounded-lg border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-body-sm font-semibold text-fg">v{ver.versionNumber}</span>
                      <span className="text-caption text-fg-subtle tabular">
                        {ver.effectiveFrom} → {ver.effectiveUntil ?? t("open")}
                      </span>
                    </div>
                    <p className="mt-1 text-body-sm">
                      {ver.valueStatus === "SET" ? (
                        <span className="font-mono text-fg">
                          {ver.value} {rule.unit}
                        </span>
                      ) : (
                        <span className="font-medium text-warning-700">{t("statusConfig")}</span>
                      )}
                    </p>
                    {ver.changeReason ? <p className="mt-1 text-caption text-fg-muted">{ver.changeReason}</p> : null}
                    <p className="mt-1.5 flex flex-wrap gap-3 text-caption text-fg-subtle">
                      <span>{ver.approved ? t("approved") : t("notApproved")}</span>
                      {ver.certificates ? <span>{t("usedBy", { count: ver.certificates })}</span> : null}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {canManage && (NEXT[rule.status] ?? []).length ? (
            <section className="rounded-lg border border-line p-4">
              <h3 className="mb-3 text-body-sm font-semibold text-fg">{t("lifecycle")}</h3>
              <div className="flex flex-wrap gap-2">
                {(NEXT[rule.status] ?? []).map((s) => (
                  <Button key={s} size="sm" variant={s === "retire" ? "secondary" : step === s ? "primary" : "subtle"} onClick={() => setStep(step === s ? null : s)}>
                    {t(`steps.${s}`)}
                  </Button>
                ))}
              </div>
              {step === "activate" && current?.valueStatus !== "SET" ? <InlineAlert tone="warning" className="mt-3">{te("VALUE_NOT_CONFIGURED")}</InlineAlert> : null}
              {step ? (
                <div className="mt-3 space-y-3">
                  <Field id="lc-reason" label={t("reason")} required hint={t("reasonHint")}>
                    <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
                  </Field>
                  <div className="flex justify-end">
                    <Button
                      loading={busy}
                      variant={step === "retire" ? "danger" : "primary"}
                      disabled={reason.trim().length < 10 || (step === "activate" && current?.valueStatus !== "SET")}
                      onClick={() => run(() => api(`/api/rules/${rule.id}/lifecycle`, { body: { action: step, reason: reason.trim() } }), t(`done.${step}`))}
                    >
                      {t(`steps.${step}`)}
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
