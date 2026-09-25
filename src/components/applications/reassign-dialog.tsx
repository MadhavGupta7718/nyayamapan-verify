"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserRoundCog } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { OfficerOptions, SLOTS, groupOfficers, useAssignableOfficers } from "@/components/scheduling/schedule-drawer";

/** Moves a not-yet-started verification to another officer. The reason is recorded in the audit log and both officers are notified. */
export function ReassignDialog({
  applicationId,
  mode,
  currentOfficerId,
  districtId,
  gatcId,
  scheduledDate,
  timeSlot,
}: {
  applicationId: string;
  mode: "LMO" | "GATC";
  currentOfficerId: string | null;
  districtId: string | null;
  gatcId: string | null;
  scheduledDate: string;
  timeSlot: string | null;
}) {
  const t = useTranslations("applications.reassign");
  const ts = useTranslations("scheduling.drawer");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const officers = useAssignableOfficers(open);
  const [officerId, setOfficerId] = React.useState("");
  const [date, setDate] = React.useState(scheduledDate);
  const [slot, setSlot] = React.useState(timeSlot && SLOTS.includes(timeSlot) ? timeSlot : SLOTS[0]);
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const eligible = (officers ?? []).filter((o) => o.id !== currentOfficerId);
  const { primary, other } = groupOfficers(eligible, { districtId, gatcId }, mode);
  const valid = !!officerId && !!date && reason.trim().length >= 10;

  async function submit() {
    setSaving(true);
    try {
      await api(`/api/applications/${applicationId}/assignment`, { method: "PATCH", body: { officerId, reason: reason.trim(), scheduledDate: date, timeSlot: slot } });
      toast.success(t("done"));
      setOpen(false);
      setOfficerId("");
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e, te));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !saving && setOpen(o)}
      title={t("title")}
      description={t("desc")}
      trigger={
        <Button variant="secondary">
          <UserRoundCog /> {t("action")}
        </Button>
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
            {ts("cancel")}
          </Button>
          <Button onClick={submit} loading={saving} disabled={!valid}>
            <UserRoundCog /> {t("submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          id="reassign-officer"
          label={ts("officer")}
          required
          hint={!officers ? ts("loadingOfficers") : !primary.length && !other.length ? ts(mode === "GATC" ? "noGatcOfficers" : "noOfficers") : ts("officerHint")}
        >
          <Select value={officerId} onChange={(e) => setOfficerId(e.target.value)} disabled={!officers}>
            <option value="">{ts("select")}</option>
            <OfficerOptions primary={primary} other={other} primaryLabel={ts(mode === "GATC" ? "centreOfficers" : "coversDistrict")} otherLabel={ts("otherOfficers")} />
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="reassign-date" label={ts("date")} required>
            <Input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field id="reassign-slot" label={ts("slot")} required>
            <Select value={slot} onChange={(e) => setSlot(e.target.value)}>
              {SLOTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id="reassign-reason" label={t("reason")} required hint={t("reasonHint")}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
        </Field>
      </div>
    </Modal>
  );
}
