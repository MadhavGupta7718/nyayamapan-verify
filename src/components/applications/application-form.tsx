"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, FileText, Search } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Stepper } from "@/components/ui/stepper";
import { StatusBadge } from "@/components/ui/status-badge";
import { InlineAlert } from "@/components/ui/states";
import { FormSection } from "@/components/ui/form-section";

type InstrumentOption = {
  id: string;
  code: string;
  serial: string;
  label: string;
  maker: string;
  location: string;
  organization: string | null;
  status: string;
  dueDate: string | null;
  requiredDocuments: string[];
  openApplication: { id: string; applicationNumber: string } | null;
};

type Draft = { instrumentId: string; verificationType: string; preferredDate: string; preferredSlot: string; remarks: string };

const SLOTS = ["09:00-11:00", "11:00-13:00", "14:00-16:00", "16:00-18:00"];
const STORAGE_KEY = "draft:new-application";

function minDate() {
  const d = new Date(Date.now() + 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function ApplicationForm({
  instruments,
  initialInstrumentId,
  initialType,
  locale,
}: {
  instruments: InstrumentOption[];
  initialInstrumentId?: string;
  initialType?: string;
  locale: string;
}) {
  const t = useTranslations("applyForm");
  const td = useTranslations("documents");
  const ta = useTranslations("applications");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<keyof Draft, string>>>({});
  const [draft, setDraft] = React.useState<Draft>({
    instrumentId: initialInstrumentId && instruments.some((i) => i.id === initialInstrumentId) ? initialInstrumentId : "",
    verificationType: initialType ?? "RE_VERIFICATION",
    preferredDate: "",
    preferredSlot: SLOTS[0],
    remarks: "",
  });

  React.useEffect(() => {
    if (initialInstrumentId) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved && typeof saved === "object") setDraft((d) => ({ ...d, ...saved }));
    } catch {
      /* ignore */
    }
  }, [initialInstrumentId]);
  React.useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const selected = instruments.find((i) => i.id === draft.instrumentId);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const filtered = instruments.filter((i) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return [i.code, i.serial, i.label, i.maker, i.location, i.organization ?? ""].some((s) => s.toLowerCase().includes(q));
  });

  function validate(s: number) {
    const e: typeof errors = {};
    if (s === 0) {
      if (!draft.instrumentId) e.instrumentId = t("errors.instrument");
      else if (selected?.openApplication) e.instrumentId = t("errors.openApplication", { number: selected.openApplication.applicationNumber });
    }
    if (s === 1) {
      if (draft.preferredDate && draft.preferredDate < minDate()) e.preferredDate = t("errors.date");
      if (draft.remarks.length > 2000) e.remarks = t("errors.remarks");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function create() {
    setSubmitting(true);
    try {
      const res = await api<{ data: { id: string; applicationNumber: string } }>("/api/applications", {
        body: {
          instrumentId: draft.instrumentId,
          verificationType: draft.verificationType,
          preferredDate: draft.preferredDate || undefined,
          preferredSlot: draft.preferredSlot,
          remarks: draft.remarks.trim() || undefined,
        },
      });
      sessionStorage.removeItem(STORAGE_KEY);
      toast.success(t("created", { number: res.data.applicationNumber }));
      router.push(`/applications/${res.data.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === "OPEN_APPLICATION_EXISTS") {
        toast.error(t("errors.openApplication", { number: String((e.details as { applicationNumber?: string })?.applicationNumber ?? "") }));
      } else toast.error(errorMessage(e, te));
      setSubmitting(false);
    }
  }

  const steps = [
    { key: "instrument", label: t("steps.instrument") },
    { key: "visit", label: t("steps.visit") },
    { key: "review", label: t("steps.review") },
  ];

  return (
    <div className="space-y-5">
      <Card className="px-4 py-5 sm:px-8">
        <Stepper steps={steps} current={step} onStepClick={(i) => i < step && setStep(i)} />
      </Card>

      <Card>
        <div className="px-5 py-6 sm:px-6">
          {step === 0 ? (
            <FormSection title={t("instrument.title")} description={t("instrument.desc")}>
              <div className="sm:col-span-2">
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-faint" aria-hidden />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("instrument.search")} className="pl-9" aria-label={t("instrument.search")} />
                </div>
                <div role="radiogroup" aria-label={t("instrument.title")} className="max-h-[22rem] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                  {filtered.map((i) => {
                    const active = draft.instrumentId === i.id;
                    return (
                      <button
                        key={i.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => set("instrumentId", i.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-[border-color,box-shadow,background-color]",
                          active ? "border-brand-500 bg-brand-50/60 shadow-focus" : "border-line hover:border-line-strong hover:bg-surface-subtle"
                        )}
                      >
                        <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", active ? "border-brand-700 bg-brand-700 text-white" : "border-line-strong")}>
                          {active ? <Check className="size-3" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-sm font-medium text-fg">
                            {i.label} · <span className="font-mono">{i.serial}</span>
                          </span>
                          <span className="block truncate text-caption text-fg-subtle">
                            {[i.code, i.maker, i.location, i.organization].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                          <StatusBadge status={i.status} withTooltip={false} />
                          {i.openApplication ? (
                            <span className="text-caption text-warning-700">{t("instrument.openApp")}</span>
                          ) : i.dueDate ? (
                            <span className="text-caption text-fg-subtle">{t("instrument.due", { date: formatDate(i.dueDate, locale) })}</span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                  {!filtered.length ? <p className="py-6 text-center text-body-sm text-fg-subtle">{t("instrument.noMatch")}</p> : null}
                </div>
                {errors.instrumentId ? (
                  <p role="alert" className="mt-2 text-caption font-medium text-danger-700">
                    {errors.instrumentId}{" "}
                    {selected?.openApplication ? (
                      <Link href={`/applications/${selected.openApplication.id}`} className="underline">
                        {t("instrument.viewOpen")}
                      </Link>
                    ) : null}
                  </p>
                ) : null}
                <p className="mt-3 text-caption text-fg-subtle">
                  {t("instrument.notListed")}{" "}
                  <Link href="/instruments/new" className="font-medium text-brand-700 hover:underline">
                    {t("instrument.register")}
                  </Link>
                </p>
              </div>
              <Field id="verificationType" label={t("fields.type")} required hint={t("fields.typeHint")} className="sm:col-span-2">
                <Select value={draft.verificationType} onChange={(e) => set("verificationType", e.target.value)}>
                  {["INITIAL_VERIFICATION", "RE_VERIFICATION", "OTHER_APPLICABLE"].map((v) => (
                    <option key={v} value={v}>
                      {ta(`types.${v}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </FormSection>
          ) : null}

          {step === 1 ? (
            <FormSection title={t("visit.title")} description={t("visit.desc")}>
              <Field id="preferredDate" label={t("fields.date")} hint={t("fields.dateHint")} error={errors.preferredDate}>
                <Input type="date" min={minDate()} value={draft.preferredDate} onChange={(e) => set("preferredDate", e.target.value)} />
              </Field>
              <Field id="preferredSlot" label={t("fields.slot")}>
                <Select value={draft.preferredSlot} onChange={(e) => set("preferredSlot", e.target.value)}>
                  {SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="remarks" label={t("fields.remarks")} hint={t("fields.remarksHint", { count: 2000 - draft.remarks.length })} error={errors.remarks} className="sm:col-span-2">
                <Textarea value={draft.remarks} onChange={(e) => set("remarks", e.target.value)} maxLength={2000} rows={4} />
              </Field>
            </FormSection>
          ) : null}

          {step === 2 && selected ? (
            <FormSection title={t("review.title")} description={t("review.desc")}>
              <dl className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                {[
                  [t("review.instrument"), `${selected.label} · ${selected.serial}`],
                  [t("review.code"), selected.code],
                  [t("fields.type"), ta(`types.${draft.verificationType}`)],
                  [t("fields.date"), draft.preferredDate ? `${formatDate(draft.preferredDate, locale)} · ${draft.preferredSlot}` : t("review.noPreference")],
                  [t("fields.remarks"), draft.remarks || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-surface-subtle px-4 py-3">
                    <dt className="text-caption text-fg-subtle">{k}</dt>
                    <dd className="mt-0.5 text-body-sm text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="sm:col-span-2">
                <InlineAlert tone="info" icon={<FileText />} title={t("review.docsTitle")}>
                  {selected.requiredDocuments.length ? (
                    <ul className="mt-1 list-disc pl-5">
                      {selected.requiredDocuments.map((d) => (
                        <li key={d}>{td.has(`types.${d}`) ? td(`types.${d}`) : d}</li>
                      ))}
                    </ul>
                  ) : (
                    t("review.noDocs")
                  )}
                  <p className="mt-2">{t("review.next")}</p>
                </InlineAlert>
              </div>
            </FormSection>
          ) : null}
        </div>
        <CardFooter className="justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting}>
            <ArrowLeft /> {t("back")}
          </Button>
          <div className="flex items-center gap-2">
            <span className="hidden text-caption text-fg-subtle sm:inline">{t("autosaved")}</span>
            {step < 2 ? (
              <Button onClick={() => validate(step) && setStep((s) => s + 1)}>
                {t("continue")} <ArrowRight />
              </Button>
            ) : (
              <Button onClick={create} loading={submitting}>
                {t("createDraft")} <ArrowRight />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
