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
  districtId: string | null;
  districtName: string | null;
  gatcId: string | null;
  gatcName: string | null;
  preferredDate: string | null;
  preferredSlot: string | null;
};
export type AssignableOfficer = { id: string; name: string; role: string; gatcId: string | null; districtIds: string[]; openTasks: number };
type Conflict = { code: string; message: string };

export const SLOTS = ["09:00-11:00", "11:00-13:00", "14:00-16:00", "16:00-18:00"];

/** Officers eligible for an item, split into those covering its district (or its GATC) and the rest, least loaded first. */
export function groupOfficers(officers: AssignableOfficer[], item: Pick<QueueItem, "districtId" | "gatcId">, mode: "LMO" | "GATC") {
  const byLoad = [...officers].sort((a, b) => a.openTasks - b.openTasks || a.name.localeCompare(b.name));
  if (mode === "GATC") return { primary: byLoad.filter((o) => o.gatcId === item.gatcId), other: [] as AssignableOfficer[] };
  const covers = (o: AssignableOfficer) => !!item.districtId && o.districtIds.includes(item.districtId);
  return { primary: byLoad.filter(covers), other: byLoad.filter((o) => !covers(o)) };
}

export function useAssignableOfficers(enabled: boolean) {
  const te = useTranslations("apiErrors");
  const [officers, setOfficers] = React.useState<AssignableOfficer[] | null>(null);
  React.useEffect(() => {
    if (!enabled || officers) return;
    api<{ officers: AssignableOfficer[] }>("/api/meta/types?include=officers")
      .then((r) => setOfficers(r.officers))
      .catch((e) => toast.error(errorMessage(e, te)));
  }, [enabled, officers, te]);
  return officers;
}

export function OfficerOptions({ primary, other, primaryLabel, otherLabel }: { primary: AssignableOfficer[]; other: AssignableOfficer[]; primaryLabel: string; otherLabel: string }) {
  const tr = useTranslations("roles");
  const t = useTranslations("scheduling.drawer");
  const option = (o: AssignableOfficer) => (
    <option key={o.id} value={o.id}>
      {o.name} · {tr(o.role)} · {t("openTasks", { count: o.openTasks })}
    </option>
  );
  return (
    <>
      {primary.length ? <optgroup label={primaryLabel}>{primary.map(option)}</optgroup> : null}
      {other.length ? <optgroup label={otherLabel}>{other.map(option)}</optgroup> : null}
    </>
  );
}

/**
 * Manual assignment for approved applications that weren't assigned automatically. State Admins pick an
 * LMO or Inspector of their state; GATC Admins pick an officer of the centre the applicant chose.
 * Conflicts must be resolved or explicitly overridden with a recorded reason.
 */
export function ScheduleDrawer({ items, mode }: { items: QueueItem[]; mode: "LMO" | "GATC" }) {
  const t = useTranslations("scheduling.drawer");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const selectedId = sp.get("application");
  const item = items.find((i) => i.id === selectedId) ?? null;
  const officers = useAssignableOfficers(!!item);
  const [officerId, setOfficerId] = React.useState("");
  const [date, setDate] = React.useState("");
  const [slot, setSlot] = React.useState(SLOTS[0]);
  const [conflicts, setConflicts] = React.useState<Conflict[]>([]);
  const [override, setOverride] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!item) return;
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    setDate(item.preferredDate && item.preferredDate >= tomorrow ? item.preferredDate : tomorrow);
    setSlot(item.preferredSlot && SLOTS.includes(item.preferredSlot) ? item.preferredSlot : SLOTS[0]);
    setConflicts([]);
    setOverride("");
    setOfficerId("");
  }, [item]);

  function close() {
    const next = new URLSearchParams(sp.toString());
    next.delete("application");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const { primary, other } = item && officers ? groupOfficers(officers, item, mode) : { primary: [], other: [] };
  const valid = !!officerId && !!date && (!conflicts.length || override.trim().length >= 10);

  async function submit() {
    if (!item) return;
    setSaving(true);
    try {
      await api("/api/schedules", {
        body: { applicationId: item.id, officerId, scheduledDate: date, timeSlot: slot, overrideReason: conflicts.length ? override.trim() : undefined },
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
            <p className="text-fg-subtle">{mode === "GATC" ? t("viaGatc", { name: item.gatcName ?? "—" }) : t("inDistrict", { name: item.districtName ?? "—" })}</p>
            <p className="text-fg-subtle">{item.preferredDate ? t("preferred", { date: item.preferredDate, slot: item.preferredSlot ?? "" }) : t("noPreference")}</p>
          </div>
          <Field
            id="officer"
            label={t("officer")}
            required
            hint={!officers ? t("loadingOfficers") : !primary.length && !other.length ? t(mode === "GATC" ? "noGatcOfficers" : "noOfficers") : t("officerHint")}
          >
            <Select
              value={officerId}
              onChange={(e) => {
                setOfficerId(e.target.value);
                setConflicts([]);
              }}
              disabled={!officers}
            >
              <option value="">{t("select")}</option>
              <OfficerOptions primary={primary} other={other} primaryLabel={t(mode === "GATC" ? "centreOfficers" : "coversDistrict")} otherLabel={t("otherOfficers")} />
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
