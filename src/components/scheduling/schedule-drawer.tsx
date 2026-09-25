"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarPlus, TriangleAlert } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/states";

export type QueueItem = {
  id: string;
  number: string;
  organization: string;
  instrumentType: string;
  instrumentTypeId: string;
  stateId: string | null;
  preferredDate: string | null;
  preferredSlot: string | null;
};
type Officer = { id: string; name: string; role: string; stateId: string | null };
type Gatc = { id: string; name: string; approvalNumber: string; stateId: string | null; authorizations: { instrumentTypeId: string }[] };
type Conflict = { code: string; message: string };

const SLOTS = ["09:00-11:00", "11:00-13:00", "14:00-16:00", "16:00-18:00"];

/** Assigns an approved application to an officer/GATC. Conflicts must be resolved or explicitly overridden with a recorded reason. */
export function ScheduleDrawer({ items }: { items: QueueItem[] }) {
  const t = useTranslations("scheduling.drawer");
  const te = useTranslations("apiErrors");
  const tr = useTranslations("roles");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const selectedId = sp.get("application");
  const item = items.find((i) => i.id === selectedId) ?? null;
  const [meta, setMeta] = React.useState<{ officers: Officer[]; gatcs: Gatc[] } | null>(null);
  const [authority, setAuthority] = React.useState<"LMO" | "GATC">("LMO");
  const [officerId, setOfficerId] = React.useState("");
  const [gatcId, setGatcId] = React.useState("");
  const [date, setDate] = React.useState("");
  const [slot, setSlot] = React.useState(SLOTS[0]);
  const [conflicts, setConflicts] = React.useState<Conflict[]>([]);
  const [override, setOverride] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!item || meta) return;
    api<{ officers: Officer[]; gatcs: Gatc[] }>("/api/meta/types?include=officers,gatcs")
      .then(setMeta)
      .catch((e) => toast.error(errorMessage(e, te)));
  }, [item, meta, te]);

  React.useEffect(() => {
    if (!item) return;
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    setDate(item.preferredDate && item.preferredDate >= tomorrow ? item.preferredDate : tomorrow);
    setSlot(item.preferredSlot && SLOTS.includes(item.preferredSlot) ? item.preferredSlot : SLOTS[0]);
    setConflicts([]);
    setOverride("");
    setOfficerId("");
    setGatcId("");
    setAuthority("LMO");
  }, [item]);

  function close() {
    const next = new URLSearchParams(sp.toString());
    next.delete("application");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const gatcs = (meta?.gatcs ?? []).filter((g) => (!item?.stateId || g.stateId === item.stateId) && g.authorizations.some((a) => a.instrumentTypeId === item?.instrumentTypeId));
  const officers = (meta?.officers ?? []).filter((o) =>
    authority === "GATC" ? o.role === "GATC_OFFICER" : o.role === "LMO" || o.role === "INSPECTOR"
  );
  const sameState = officers.filter((o) => !item?.stateId || o.stateId === item.stateId);
  const otherState = officers.filter((o) => item?.stateId && o.stateId !== item.stateId);
  const valid = !!officerId && !!date && (authority === "LMO" || !!gatcId) && (!conflicts.length || override.trim().length >= 10);

  async function submit() {
    if (!item) return;
    setSaving(true);
    try {
      await api("/api/schedules", {
        body: {
          applicationId: item.id,
          authorityType: authority,
          officerId,
          gatcId: authority === "GATC" ? gatcId : undefined,
          scheduledDate: date,
          timeSlot: slot,
          overrideReason: conflicts.length ? override.trim() : undefined,
        },
      });
      toast.success(t("scheduled", { number: item.number }));
      close();
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === "CONFLICTS") {
        setConflicts(((e.details as { conflicts?: Conflict[] })?.conflicts ?? []) as Conflict[]);
      } else toast.error(errorMessage(e, te));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={!!item}
      onOpenChange={(o) => !o && close()}
      title={t("title")}
      description={item ? `${item.number} · ${item.organization}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} loading={saving} disabled={!valid} variant={conflicts.length ? "danger" : "primary"}>
            <CalendarPlus /> {conflicts.length ? t("overrideAndSchedule") : t("schedule")}
          </Button>
        </>
      }
    >
      {item ? (
        <div className="space-y-5">
          <div className="rounded-lg bg-surface-subtle p-3 text-body-sm">
            <p className="font-medium text-fg">{item.instrumentType}</p>
            <p className="text-fg-subtle">{item.preferredDate ? t("preferred", { date: item.preferredDate, slot: item.preferredSlot ?? "" }) : t("noPreference")}</p>
          </div>
          <Field id="authority" label={t("authority")} required>
            <Select
              value={authority}
              onChange={(e) => {
                setAuthority(e.target.value as "LMO" | "GATC");
                setOfficerId("");
                setConflicts([]);
              }}
            >
              <option value="LMO">{t("authorityLmo")}</option>
              <option value="GATC" disabled={!gatcs.length}>
                {t("authorityGatc")}
                {!gatcs.length && meta ? ` — ${t("noGatc")}` : ""}
              </option>
            </Select>
          </Field>
          {authority === "GATC" ? (
            <Field id="gatc" label={t("gatc")} required>
              <Select value={gatcId} onChange={(e) => setGatcId(e.target.value)}>
                <option value="">{t("select")}</option>
                {gatcs.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} · {g.approvalNumber}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field id="officer" label={t("officer")} required hint={!meta ? t("loadingOfficers") : undefined}>
            <Select
              value={officerId}
              onChange={(e) => {
                setOfficerId(e.target.value);
                setConflicts([]);
              }}
              disabled={!meta}
            >
              <option value="">{t("select")}</option>
              {sameState.length ? (
                <optgroup label={t("inJurisdiction")}>
                  {sameState.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} · {tr(o.role)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {otherState.length ? (
                <optgroup label={t("outsideJurisdiction")}>
                  {otherState.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} · {tr(o.role)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="date" label={t("date")} required>
              <Input
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  setDate(e.target.value);
                  setConflicts([]);
                }}
              />
            </Field>
            <Field id="slot" label={t("slot")} required>
              <Select
                value={slot}
                onChange={(e) => {
                  setSlot(e.target.value);
                  setConflicts([]);
                }}
              >
                {SLOTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
          </div>
          {conflicts.length ? (
            <div className="space-y-3">
              <InlineAlert tone="warning" icon={<TriangleAlert />} title={t("conflictsTitle", { count: conflicts.length })}>
                <ul className="list-disc space-y-0.5 pl-5">
                  {conflicts.map((c) => (
                    <li key={c.code}>{t.has(`conflicts.${c.code}`) ? t(`conflicts.${c.code}`) : c.message}</li>
                  ))}
                </ul>
              </InlineAlert>
              <Field id="override" label={t("overrideReason")} required hint={t("overrideHint")}>
                <Textarea value={override} onChange={(e) => setOverride(e.target.value)} rows={3} maxLength={500} />
              </Field>
            </div>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
