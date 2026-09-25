"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Award,
  Camera,
  Check,
  ClipboardCheck,
  CloudOff,
  Crosshair,
  FlaskConical,
  Gavel,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  ScanLine,
  Stamp,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { EVIDENCE_REASON_MIN, missingEvidence } from "@/lib/evidence";
import { enqueue, flushQueue, listQueue } from "@/lib/offline-queue";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { FileUploader } from "@/components/ui/file-uploader";

type ChecklistItem = { id: string; label: string; result: string; remarks: string; ruleRef: string | null };
type TestRow = { id: string; testName: string; expectedValue: string | null; observedValue: string | null; unit: string | null; result: string; permissibleError: string | null; calculatedError: string | null };

export type FieldData = {
  id: string;
  number: string;
  status: string;
  organization: string;
  instrument: { type: string; serial: string; maker: string; capacity: string | null; site: string; lat: number | null; lng: number | null };
  visit: { date: string; slot: string | null } | null;
  requiredPhotos: string[];
  inspection: {
    id: string;
    open: boolean;
    serialConfirmed: boolean;
    result: string;
    observations: string | null;
    checklist: ChecklistItem[];
    tests: TestRow[];
    photos: { id: string; category: string; capturedAt: string }[];
    arrival: { accuracy: number | null; capturedAt: string; lat: number; lng: number } | null;
    stamp: { id: string | null; date: string } | null;
  } | null;
  certificate: { id: string; number: string } | null;
};

const STEPS = ["arrival", "identity", "photos", "checklist", "tests", "result", "stamping", "certificate"] as const;
type StepKey = (typeof STEPS)[number];
const ICONS: Record<StepKey, React.ElementType> = {
  arrival: MapPin,
  identity: ScanLine,
  photos: Camera,
  checklist: ClipboardCheck,
  tests: FlaskConical,
  result: Gavel,
  stamping: Stamp,
  certificate: Award,
};

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unavailable"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 });
  });
}

function useConnectivity() {
  const [online, setOnline] = React.useState(true);
  const [pending, setPending] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);
  const refresh = React.useCallback(() => listQueue().then((q) => setPending(q.length)).catch(() => undefined), []);
  const sync = React.useCallback(async () => {
    setSyncing(true);
    try {
      const r = await flushQueue();
      return r;
    } finally {
      setSyncing(false);
      refresh();
    }
  }, [refresh]);
  React.useEffect(() => {
    setOnline(navigator.onLine);
    refresh();
    const on = () => {
      setOnline(true);
      sync();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("offline-queue-changed", refresh);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("offline-queue-changed", refresh);
    };
  }, [refresh, sync]);
  return { online, pending, syncing, sync };
}

export function FieldVerification({ data, locale }: { data: FieldData; locale: string }) {
  const t = useTranslations("field");
  const te = useTranslations("apiErrors");
  const tp = useTranslations("field.photoTypes");
  const router = useRouter();
  const conn = useConnectivity();
  const insp = data.inspection;

  const stage: "waiting" | "notStarted" | "inspection" | "stamping" | "certificate" | "done" =
    data.status === "SCHEDULED"
      ? "waiting"
      : data.status === "ASSIGNED"
        ? "notStarted"
        : data.status === "FIELD_VERIFICATION" && insp?.open
          ? "inspection"
          : data.status === "PASS"
            ? "stamping"
            : data.status === "STAMPING"
              ? "certificate"
              : "done";

  const [checklist, setChecklist] = React.useState<ChecklistItem[]>(insp?.checklist ?? []);
  const [serialConfirmed, setSerialConfirmed] = React.useState(insp?.serialConfirmed ?? false);
  const [tests, setTests] = React.useState<TestRow[]>(insp?.tests ?? []);
  const [photos, setPhotos] = React.useState(insp?.photos ?? []);
  const [arrival, setArrival] = React.useState(insp?.arrival ?? null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const photoDone = (c: string) => photos.some((p) => p.category === c);
  const progress: Record<StepKey, boolean> = {
    arrival: !!arrival,
    identity: serialConfirmed,
    photos: data.requiredPhotos.every(photoDone),
    checklist: checklist.length > 0 && checklist.every((c) => c.result !== "PENDING"),
    tests: tests.length > 0,
    result: ["stamping", "certificate", "done"].includes(stage),
    stamping: ["certificate", "done"].includes(stage) && data.status !== "FAIL",
    certificate: !!data.certificate,
  };
  const firstOpen = STEPS.findIndex((s) => !progress[s]);
  const [step, setStep] = React.useState<StepKey>(
    stage === "stamping" ? "stamping" : stage === "certificate" ? "certificate" : stage === "done" ? "certificate" : STEPS[Math.max(0, Math.min(5, firstOpen))]
  );
  React.useEffect(() => {
    if (stage === "stamping") setStep("stamping");
    else if (stage === "certificate" || stage === "done") setStep("certificate");
  }, [stage]);
  const stepIndex = STEPS.indexOf(step);
  const canVisit = (s: StepKey) => {
    const i = STEPS.indexOf(s);
    if (stage === "inspection") return i <= 5;
    if (stage === "stamping") return i === 6;
    if (stage === "certificate") return i === 7;
    return stage === "done" && i === 7;
  };

  async function mutate(url: string, method: "POST" | "PATCH", body: unknown, label: string, queueable: boolean) {
    if (queueable && !navigator.onLine) {
      await enqueue({ url, method, body, label });
      toast.message(t("savedOffline"));
      return { queued: true as const };
    }
    try {
      return { queued: false as const, data: await api(url, { method, body }) };
    } catch (e) {
      if (queueable && e instanceof ApiError && ["NETWORK", "OFFLINE", "TIMEOUT"].includes(e.code)) {
        await enqueue({ url, method, body, label });
        toast.message(t("savedOffline"));
        return { queued: true as const };
      }
      throw e;
    }
  }

  async function start() {
    setBusy("start");
    try {
      await api(`/api/verifications/${data.id}/start`, { method: "POST" });
      toast.success(t("started"));
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e, te));
    } finally {
      setBusy(null);
    }
  }

  async function captureArrival() {
    if (!insp) return;
    setBusy("gps");
    try {
      const pos = await getPosition();
      const rec = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, capturedAt: new Date().toISOString() };
      await mutate(
        `/api/verifications/${data.id}/gps`,
        "POST",
        { inspectionId: insp.id, latitude: rec.lat, longitude: rec.lng, accuracy: rec.accuracy, purpose: "ARRIVAL" },
        "GPS arrival",
        true
      );
      setArrival(rec);
      toast.success(t("gpsCaptured", { accuracy: Math.round(rec.accuracy) }));
    } catch (e) {
      if (e instanceof GeolocationPositionError || (e instanceof Error && e.message === "unavailable")) toast.error(t("gpsDenied"));
      else toast.error(errorMessage(e, te));
    } finally {
      setBusy(null);
    }
  }

  async function saveChecklist(next: ChecklistItem[], serial = serialConfirmed) {
    if (!insp) return;
    await mutate(
      `/api/verifications/${data.id}/checklist`,
      "PATCH",
      { inspectionId: insp.id, serialConfirmed: serial, items: next.map((c) => ({ id: c.id, result: c.result, remarks: c.remarks || undefined })) },
      "Checklist",
      true
    ).catch((e) => toast.error(errorMessage(e, te)));
  }

  const distance = arrival && data.instrument.lat != null ? distanceMeters(arrival, { lat: data.instrument.lat, lng: data.instrument.lng! }) : null;

  // ------------------------------------------------------------- stages without a step flow
  if (stage === "waiting") {
    return (
      <Card>
        <EmptyState icon={Navigation} title={t("waitingTitle")} description={t("waitingDesc")} />
      </Card>
    );
  }
  if (stage === "notStarted") {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <SiteCard data={data} locale={locale} className="lg:col-span-2" />
        <Card>
          <CardHeader icon={<ClipboardCheck />} title={t("readyTitle")} description={t("readyDesc")} />
          <CardBody>
            <Button block size="lg" onClick={start} loading={busy === "start"}>
              {t("startVerification")}
            </Button>
            <p className="mt-3 text-caption text-fg-subtle">{t("startHint")}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!conn.online || conn.pending > 0 ? (
        <InlineAlert tone={conn.online ? "info" : "warning"} icon={<CloudOff />} title={conn.online ? t("pendingSync", { count: conn.pending }) : t("offlineTitle")}>
          <div className="flex flex-wrap items-center gap-3">
            <span>{conn.online ? t("pendingSyncDesc") : t("offlineDesc")}</span>
            {conn.online ? (
              <Button
                size="sm"
                variant="secondary"
                loading={conn.syncing}
                onClick={async () => {
                  const r = await conn.sync();
                  if (r.synced) toast.success(t("synced", { count: r.synced }));
                  router.refresh();
                }}
              >
                <RefreshCw /> {t("syncNow")}
              </Button>
            ) : null}
          </div>
        </InlineAlert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label={t("stepsLabel")} className="relative -mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ol className="flex gap-2 lg:flex-col lg:gap-1">
            {STEPS.map((s, i) => {
              const Icon = ICONS[s];
              const active = s === step;
              const done = progress[s];
              const enabled = canVisit(s);
              return (
                <li key={s} className="shrink-0">
                  <button
                    type="button"
                    disabled={!enabled}
                    onClick={() => setStep(s)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-body-sm transition-colors",
                      active ? "bg-brand-800 text-white shadow-sm" : enabled ? "bg-surface text-fg hover:bg-surface-subtle lg:bg-transparent" : "text-fg-faint",
                      !active && "ring-1 ring-inset ring-line lg:ring-0"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full text-caption",
                        active ? "bg-white/15" : done ? "bg-success-100 text-success-700" : "bg-ink-100 text-fg-subtle"
                      )}
                    >
                      {done && !active ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                    </span>
                    <span className="whitespace-nowrap font-medium">
                      <span className="sr-only">{i + 1}. </span>
                      {t(`steps.${s}`)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0 animate-fade-in" key={step}>
          {step === "arrival" && insp ? (
            <Card>
              <CardHeader icon={<MapPin />} title={t("arrival.title")} description={t("arrival.desc")} />
              <CardBody className="space-y-4">
                <SiteDetails data={data} locale={locale} />
                {arrival ? (
                  <InlineAlert tone={distance != null && distance > 500 ? "warning" : "success"} icon={<Crosshair />} title={t("arrival.captured", { time: formatDateTime(arrival.capturedAt, locale) })}>
                    {t("arrival.accuracy", { m: Math.round(arrival.accuracy ?? 0) })}
                    {distance != null ? ` · ${t("arrival.distance", { m: Math.round(distance) })}` : ""}
                    {distance != null && distance > 500 ? <p className="mt-1">{t("arrival.far")}</p> : null}
                  </InlineAlert>
                ) : null}
              </CardBody>
              <CardFooter className="justify-between">
                {data.instrument.lat != null ? (
                  <a
                    href={`https://www.openstreetmap.org/directions?to=${data.instrument.lat}%2C${data.instrument.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    <Navigation /> {t("navigate")}
                  </a>
                ) : (
                  <span />
                )}
                <div className="ml-auto flex flex-wrap justify-end gap-2">
                  <Button variant={arrival ? "secondary" : "primary"} onClick={captureArrival} loading={busy === "gps"}>
                    <Crosshair /> {arrival ? t("arrival.recapture") : t("arrival.capture")}
                  </Button>
                  {arrival ? <Button onClick={() => setStep("identity")}>{t("next")}</Button> : null}
                </div>
              </CardFooter>
            </Card>
          ) : null}

          {step === "identity" && insp ? (
            <Card>
              <CardHeader icon={<ScanLine />} title={t("identity.title")} description={t("identity.desc")} />
              <CardBody className="space-y-4">
                <div className="rounded-lg border border-line bg-surface-subtle p-4">
                  <p className="text-caption text-fg-subtle">{t("identity.expected")}</p>
                  <p className="mt-1 font-mono text-h3 tracking-wide text-fg">{data.instrument.serial}</p>
                  <p className="mt-1 text-body-sm text-fg-muted">
                    {data.instrument.maker}
                    {data.instrument.capacity ? ` · ${data.instrument.capacity}` : ""}
                  </p>
                </div>
                <Checkbox
                  checked={serialConfirmed}
                  onChange={(e) => {
                    setSerialConfirmed(e.target.checked);
                    saveChecklist(checklist, e.target.checked);
                  }}
                  label={t("identity.confirm")}
                  description={t("identity.confirmHint")}
                />
              </CardBody>
              <CardFooter>
                <Button onClick={() => setStep("photos")} disabled={!serialConfirmed}>
                  {t("next")}
                </Button>
              </CardFooter>
            </Card>
          ) : null}

          {step === "photos" && insp ? (
            <Card>
              <CardHeader icon={<Camera />} title={t("photos.title")} description={conn.online ? t("photos.desc") : t("photos.offline")} />
              <CardBody className="grid gap-3 sm:grid-cols-2">
                {data.requiredPhotos.map((c) => (
                  <div key={c}>
                    <p className="mb-1.5 flex items-center gap-2 text-label text-fg">
                      {tp.has(c) ? tp(c) : c.replaceAll("_", " ")}
                      {photoDone(c) ? <Check className="size-4 text-success-600" aria-label={t("photos.done")} /> : null}
                    </p>
                    <FileUploader
                      compact
                      capture="environment"
                      accept="image/jpeg,image/png,image/webp"
                      url={`/api/verifications/${data.id}/photos`}
                      fields={{ inspectionId: insp.id, category: c, ...(arrival ? { latitude: String(arrival.lat), longitude: String(arrival.lng) } : {}) }}
                      label={photoDone(c) ? t("photos.retake") : t("photos.take")}
                      hint={t("photos.hint")}
                      disabled={!conn.online}
                      onUploaded={(r) => {
                        const p = (r as { data?: { id: string; category: string; capturedAt: string } })?.data;
                        if (p) setPhotos((prev) => [...prev, p]);
                      }}
                    />
                  </div>
                ))}
              </CardBody>
              <CardFooter>
                <Button onClick={() => setStep("checklist")}>{t("next")}</Button>
              </CardFooter>
            </Card>
          ) : null}

          {step === "checklist" && insp ? (
            <Card>
              <CardHeader
                icon={<ClipboardCheck />}
                title={t("checklist.title")}
                description={t("checklist.desc", { done: checklist.filter((c) => c.result !== "PENDING").length, total: checklist.length })}
              />
              <ul className="divide-y divide-line">
                {checklist.map((c, idx) => (
                  <li key={c.id} className="px-5 py-3.5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <p className="min-w-0 flex-1 text-body-sm font-medium text-fg">{c.label}</p>
                      <div role="radiogroup" aria-label={c.label} className="inline-flex shrink-0 self-start overflow-hidden rounded-md ring-1 ring-inset ring-line-strong sm:self-auto">
                        {(["PASS", "FAIL", "NA"] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            role="radio"
                            aria-checked={c.result === r}
                            onClick={() => {
                              const next = checklist.map((x, i) => (i === idx ? { ...x, result: r } : x));
                              setChecklist(next);
                              saveChecklist(next);
                            }}
                            className={cn(
                              "h-9 min-w-[4.25rem] border-l border-line px-3 text-body-sm font-medium transition-colors first:border-l-0",
                              c.result === r
                                ? r === "PASS"
                                  ? "bg-success-600 text-white"
                                  : r === "FAIL"
                                    ? "bg-danger-600 text-white"
                                    : "bg-ink-600 text-white"
                                : "bg-surface text-fg-muted hover:bg-surface-subtle"
                            )}
                          >
                            {t(`checklist.${r}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {c.result === "FAIL" ? (
                      <Input
                        className="mt-2"
                        placeholder={t("checklist.remarks")}
                        aria-label={t("checklist.remarks")}
                        defaultValue={c.remarks}
                        maxLength={500}
                        onBlur={(e) => {
                          const next = checklist.map((x, i) => (i === idx ? { ...x, remarks: e.target.value } : x));
                          setChecklist(next);
                          saveChecklist(next);
                        }}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
              <CardFooter className="justify-between">
                <span className="text-caption text-fg-subtle">{t("checklist.autosave")}</span>
                <Button onClick={() => setStep("tests")}>{t("next")}</Button>
              </CardFooter>
            </Card>
          ) : null}

          {step === "tests" && insp ? <TestsStep appId={data.id} inspectionId={insp.id} tests={tests} setTests={setTests} mutate={mutate} onNext={() => setStep("result")} /> : null}

          {step === "result" && insp ? (
            <ResultStep
              appId={data.id}
              inspectionId={insp.id}
              progress={progress}
              checklist={checklist}
              tests={tests}
              missing={missingEvidence(!!arrival, data.requiredPhotos, photos.map((p) => p.category))}
              photoLabel={(c) => (tp.has(c) ? tp(c) : c.replaceAll("_", " "))}
            />
          ) : null}

          {step === "stamping" ? <StampingStep appId={data.id} /> : null}

          {step === "certificate" ? <CertificateStep data={data} /> : null}
        </div>
      </div>
      <p className="text-caption text-fg-subtle">{t("stepCounter", { current: stepIndex + 1, total: STEPS.length })}</p>
    </div>
  );
}

function SiteDetails({ data, locale }: { data: FieldData; locale: string }) {
  const t = useTranslations("field");
  return (
    <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
      <div>
        <dt className="text-caption text-fg-subtle">{t("site.applicant")}</dt>
        <dd className="text-fg">{data.organization}</dd>
      </div>
      <div>
        <dt className="text-caption text-fg-subtle">{t("site.visit")}</dt>
        <dd className="text-fg">{data.visit ? `${formatDate(data.visit.date, locale)} · ${data.visit.slot ?? ""}` : "—"}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-caption text-fg-subtle">{t("site.address")}</dt>
        <dd className="text-fg">{data.instrument.site || "—"}</dd>
      </div>
      <div>
        <dt className="text-caption text-fg-subtle">{t("site.instrument")}</dt>
        <dd className="text-fg">{data.instrument.type}</dd>
      </div>
      <div>
        <dt className="text-caption text-fg-subtle">{t("site.maker")}</dt>
        <dd className="text-fg">{data.instrument.maker}</dd>
      </div>
    </dl>
  );
}

function SiteCard({ data, locale, className }: { data: FieldData; locale: string; className?: string }) {
  const t = useTranslations("field");
  return (
    <Card className={className}>
      <CardHeader
        icon={<MapPin />}
        title={t("site.title")}
        action={
          data.instrument.lat != null ? (
            <a
              href={`https://www.openstreetmap.org/directions?to=${data.instrument.lat}%2C${data.instrument.lng}`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <Navigation /> {t("navigate")}
            </a>
          ) : null
        }
      />
      <CardBody>
        <SiteDetails data={data} locale={locale} />
      </CardBody>
    </Card>
  );
}

function TestsStep({
  appId,
  inspectionId,
  tests,
  setTests,
  mutate,
  onNext,
}: {
  appId: string;
  inspectionId: string;
  tests: TestRow[];
  setTests: React.Dispatch<React.SetStateAction<TestRow[]>>;
  mutate: (url: string, method: "POST" | "PATCH", body: unknown, label: string, queueable: boolean) => Promise<{ queued: boolean; data?: unknown }>;
  onNext: () => void;
}) {
  const t = useTranslations("field.tests");
  const tf = useTranslations("field");
  const te = useTranslations("apiErrors");
  const [form, setForm] = React.useState({ testName: "", unit: "", referenceValue: "", observedValue: "" });
  const [saving, setSaving] = React.useState(false);
  const valid = form.testName.trim().length >= 2 && form.referenceValue !== "" && form.observedValue !== "" && !Number.isNaN(Number(form.referenceValue)) && !Number.isNaN(Number(form.observedValue));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    const body = { inspectionId, testName: form.testName.trim(), unit: form.unit.trim() || undefined, referenceValue: Number(form.referenceValue), observedValue: Number(form.observedValue) };
    try {
      const r = await mutate(`/api/verifications/${appId}/tests`, "POST", body, `Test ${body.testName}`, true);
      const row = (r.data as { data?: TestRow } | undefined)?.data;
      setTests((p) => [
        ...p,
        row ?? {
          id: crypto.randomUUID(),
          testName: body.testName,
          expectedValue: String(body.referenceValue),
          observedValue: String(body.observedValue),
          unit: body.unit ?? null,
          result: "PENDING",
          permissibleError: null,
          calculatedError: String(body.observedValue - body.referenceValue),
        },
      ]);
      setForm({ testName: "", unit: form.unit, referenceValue: "", observedValue: "" });
    } catch (err) {
      toast.error(errorMessage(err, te));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader icon={<FlaskConical />} title={t("title")} description={t("desc")} />
      <CardBody className="space-y-4">
        <InlineAlert tone="info">{t("mpeNote")}</InlineAlert>
        {tests.length ? (
          <div className="relative overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[520px] text-body-sm">
              <thead className="bg-surface-subtle text-left text-caption uppercase tracking-wide text-fg-subtle">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t("name")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("reference")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("observed")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("error")}</th>
                  <th className="px-3 py-2 font-semibold">{t("result")}</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((x) => (
                  <tr key={x.id} className="border-t border-line">
                    <td className="px-3 py-2">{x.testName}</td>
                    <td className="px-3 py-2 text-right font-mono tabular">
                      {x.expectedValue} {x.unit}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular">
                      {x.observedValue} {x.unit}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular">{x.calculatedError ?? "—"}</td>
                    <td className="px-3 py-2">
                      {x.result === "PENDING" && x.permissibleError === "CONFIGURATION_REQUIRED" ? (
                        <StatusBadge status="CONFIGURATION_REQUIRED" />
                      ) : (
                        <StatusBadge status={x.result} withTooltip={false} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <form onSubmit={add} className="grid gap-3 rounded-lg border border-dashed border-line-strong p-4 sm:grid-cols-[1.4fr_1fr_1fr_0.7fr_auto] sm:items-end">
          <Field id="t-name" label={t("name")} required>
            <Input value={form.testName} onChange={(e) => setForm({ ...form, testName: e.target.value })} placeholder={t("namePlaceholder")} maxLength={120} />
          </Field>
          <Field id="t-ref" label={t("reference")} required>
            <Input inputMode="decimal" value={form.referenceValue} onChange={(e) => setForm({ ...form, referenceValue: e.target.value })} className="font-mono" />
          </Field>
          <Field id="t-obs" label={t("observed")} required>
            <Input inputMode="decimal" value={form.observedValue} onChange={(e) => setForm({ ...form, observedValue: e.target.value })} className="font-mono" />
          </Field>
          <Field id="t-unit" label={t("unit")}>
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} maxLength={20} />
          </Field>
          <Button type="submit" variant="secondary" loading={saving} disabled={!valid}>
            <Plus /> {t("add")}
          </Button>
        </form>
      </CardBody>
      <CardFooter>
        <Button onClick={onNext}>{tf("next")}</Button>
      </CardFooter>
    </Card>
  );
}

function ResultStep({
  appId,
  inspectionId,
  progress,
  checklist,
  tests,
  missing: localMissing,
  photoLabel,
}: {
  appId: string;
  inspectionId: string;
  progress: Record<StepKey, boolean>;
  checklist: ChecklistItem[];
  tests: TestRow[];
  missing: string[];
  photoLabel: (category: string) => string;
}) {
  const t = useTranslations("field.result");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [result, setResult] = React.useState<"" | "PASS" | "FAIL">("");
  const [observations, setObservations] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [serverMissing, setServerMissing] = React.useState<string[]>([]);
  const [confirm, setConfirm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const missing = [...new Set([...localMissing, ...serverMissing])];
  const failures = checklist.filter((c) => c.result === "FAIL").length + tests.filter((x) => x.result === "FAIL").length;
  const blockers = [
    !progress.identity && t("blockers.serial"),
    !progress.checklist && t("blockers.checklist"),
    result === "PASS" && failures > 0 && t("blockers.failures", { count: failures }),
    result === "FAIL" && observations.trim().length < 10 && t("blockers.observations"),
    missing.length > 0 && reason.trim().length < EVIDENCE_REASON_MIN && t("blockers.evidence"),
  ].filter(Boolean) as string[];

  async function submit() {
    setSaving(true);
    try {
      await api(`/api/verifications/${appId}/result`, {
        body: {
          inspectionId,
          overallResult: result,
          observations: observations.trim() || undefined,
          evidenceExceptionReason: missing.length ? reason.trim() : undefined,
        },
      });
      toast.success(t(result === "PASS" ? "passRecorded" : "failRecorded"));
      setConfirm(false);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === "EVIDENCE_REASON_REQUIRED") {
        const m = (e.details as { missing?: unknown } | undefined)?.missing;
        setServerMissing(Array.isArray(m) ? m.filter((x): x is string => typeof x === "string") : []);
        setConfirm(false);
      }
      toast.error(errorMessage(e, te));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader icon={<Gavel />} title={t("title")} description={t("desc")} />
      <CardBody className="space-y-4">
        <div role="radiogroup" aria-label={t("title")} className="grid gap-3 sm:grid-cols-2">
          {(["PASS", "FAIL"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={result === r}
              onClick={() => setResult(r)}
              className={cn(
                "rounded-xl border-2 p-4 text-left transition-colors",
                result === r ? (r === "PASS" ? "border-success-600 bg-success-50" : "border-danger-600 bg-danger-50") : "border-line hover:border-line-strong"
              )}
            >
              <p className={cn("text-h4", r === "PASS" ? "text-success-800" : "text-danger-800")}>{t(r)}</p>
              <p className="mt-1 text-body-sm text-fg-muted">{t(`${r}desc`)}</p>
            </button>
          ))}
        </div>
        <Field id="observations" label={t("observations")} required={result === "FAIL"} hint={t("observationsHint")}>
          <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={4} maxLength={4000} />
        </Field>
        {missing.length ? (
          <div className="space-y-3 rounded-lg border border-warning-200 bg-warning-50 p-4">
            <div>
              <p className="text-body-sm font-semibold text-warning-800">{t("evidence.title")}</p>
              <ul className="mt-1 list-disc pl-5 text-body-sm text-warning-800">
                {missing.map((m) => (
                  <li key={m}>{m === "arrival" ? t("evidence.arrival") : t("evidence.photo", { category: photoLabel(m.replace(/^photo:/, "")) })}</li>
                ))}
              </ul>
            </div>
            <Field id="evidenceReason" label={t("evidence.reason")} required hint={t("evidence.reasonHint")}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} />
            </Field>
          </div>
        ) : null}
        {result && blockers.length ? (
          <InlineAlert tone="warning" title={t("blockersTitle")}>
            <ul className="list-disc pl-5">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </InlineAlert>
        ) : null}
        <p className="text-caption text-fg-subtle">{t("legalNote")}</p>
      </CardBody>
      <CardFooter>
        <Button variant={result === "FAIL" ? "danger" : "success"} disabled={!result || blockers.length > 0} onClick={() => setConfirm(true)}>
          {t("record")}
        </Button>
      </CardFooter>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("confirmTitle", { result: result ? t(result) : "" })}
        description={t("confirmDesc")}
        confirmLabel={t("confirm")}
        tone={result === "FAIL" ? "danger" : "success"}
        loading={saving}
        onConfirm={submit}
      />
    </Card>
  );
}

function StampingStep({ appId }: { appId: string }) {
  const t = useTranslations("field.stamping");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [stampIdentifier, setId] = React.useState("");
  const [stampType, setType] = React.useState("LEAD_WIRE_SEAL");
  const [remarks, setRemarks] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/verifications/${appId}/stamping`, { body: { stampIdentifier: stampIdentifier.trim(), stampType, remarks: remarks.trim() || undefined } });
      toast.success(t("done"));
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, te));
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader icon={<Stamp />} title={t("title")} description={t("desc")} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field id="stampId" label={t("identifier")} required hint={t("identifierHint")}>
            <Input value={stampIdentifier} onChange={(e) => setId(e.target.value)} className="font-mono" maxLength={80} />
          </Field>
          <Field id="stampType" label={t("type")}>
            <Select value={stampType} onChange={(e) => setType(e.target.value)}>
              {["LEAD_WIRE_SEAL", "PUNCH_STAMP", "TAMPER_LABEL", "ELECTRONIC_SEAL"].map((s) => (
                <option key={s} value={s}>
                  {t(`types.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="stampRemarks" label={t("remarks")} className="sm:col-span-2">
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} maxLength={1000} />
          </Field>
        </CardBody>
        <CardFooter>
          <Button type="submit" loading={saving} disabled={stampIdentifier.trim().length < 2}>
            <Stamp /> {t("record")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

function CertificateStep({ data }: { data: FieldData }) {
  const t = useTranslations("field.certificate");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  if (data.status === "FAIL") {
    return (
      <Card>
        <EmptyState icon={Gavel} title={t("failedTitle")} description={t("failedDesc")} action={<Link href={`/applications/${data.id}`} className={buttonVariants({ variant: "secondary" })}>{t("viewRecord")}</Link>} />
      </Card>
    );
  }
  if (data.certificate) {
    return (
      <Card>
        <EmptyState
          icon={Award}
          title={t("issuedTitle")}
          description={t("issuedDesc", { number: data.certificate.number })}
          action={
            <>
              <Link href={`/certificates/${data.certificate.id}`} className={buttonVariants()}>
                {t("open")}
              </Link>
              <Link href="/verification" className={buttonVariants({ variant: "secondary" })}>
                {t("backToAssignments")}
              </Link>
            </>
          }
        />
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader icon={<Award />} title={t("title")} description={t("desc")} />
      <CardBody>
        <InlineAlert tone="info">{t("validityNote")}</InlineAlert>
      </CardBody>
      <CardFooter>
        <Button
          loading={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const r = await api<{ data: { certificateNumber: string } }>(`/api/verifications/${data.id}/certificate`, { method: "POST" });
              toast.success(t("issued", { number: r.data.certificateNumber }));
              router.refresh();
            } catch (e) {
              toast.error(errorMessage(e, te));
              setSaving(false);
            }
          }}
        >
          <Award /> {t("issue")}
        </Button>
      </CardFooter>
    </Card>
  );
}
