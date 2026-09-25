"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/states";

const EMPTY = {
  ruleKey: "",
  actName: "Legal Metrology Act, 2009",
  ruleName: "",
  ruleNumber: "",
  parameter: "",
  valueStatus: "CONFIGURATION_REQUIRED",
  value: "",
  unit: "",
  requirement: "",
  sourceNotification: "",
  sourceDocument: "",
  instrumentTypeId: "",
  stateCode: "",
  effectiveFrom: "",
};

/** New rules are always created as DRAFT; a value marked SET must cite a legal source. */
export function RuleCreateDrawer({ types }: { types: { id: string; label: string }[] }) {
  const t = useTranslations("rules.create");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState(EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  function validate() {
    const e: Record<string, string> = {};
    if (!/^[A-Z0-9_.]{3,80}$/.test(f.ruleKey)) e.ruleKey = t("errors.ruleKey");
    if (f.ruleName.trim().length < 3) e.ruleName = t("errors.required");
    if (f.actName.trim().length < 3) e.actName = t("errors.required");
    if (f.parameter.trim().length < 2) e.parameter = t("errors.required");
    if (f.requirement.trim().length < 3) e.requirement = t("errors.required");
    if (!f.effectiveFrom) e.effectiveFrom = t("errors.required");
    if (f.valueStatus === "SET" && !f.value.trim()) e.value = t("errors.value");
    if (f.valueStatus === "SET" && !f.sourceNotification.trim() && !f.sourceDocument.trim()) e.sourceNotification = t("errors.source");
    if (f.sourceDocument && !/^https?:\/\//.test(f.sourceDocument)) e.sourceDocument = t("errors.url");
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) document.getElementById(`rc-${first}`)?.focus();
    return !first;
  }

  async function submit() {
    if (!validate()) return;
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || undefined]));
      body.valueStatus = f.valueStatus;
      await api("/api/rules", { body });
      toast.success(t("created"));
      setOpen(false);
      setF(EMPTY);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === "VALIDATION_ERROR") setErrors({ ruleKey: te("VALIDATION_ERROR") });
      toast.error(errorMessage(e, te));
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof typeof EMPTY, label: string, node: React.ReactElement<{ id?: string }>, opts: { required?: boolean; hint?: string; className?: string } = {}) => (
    <Field id={`rc-${k}`} label={label} required={opts.required} hint={opts.hint} error={errors[k]} className={opts.className}>
      {node}
    </Field>
  );

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      width="lg"
      title={t("title")}
      description={t("desc")}
      trigger={
        <Button>
          <Plus /> {t("button")}
        </Button>
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} loading={busy}>
            {t("submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InlineAlert tone="info">{t("note")}</InlineAlert>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("ruleKey", t("ruleKey"), <Input value={f.ruleKey} onChange={(e) => setF({ ...f, ruleKey: e.target.value.toUpperCase() })} placeholder="VERIFICATION.PERIOD.WEIGH" />, { required: true, hint: t("ruleKeyHint") })}
          {field("parameter", t("parameter"), <Input value={f.parameter} onChange={set("parameter")} placeholder="validity_months" />, { required: true })}
          {field("ruleName", t("ruleName"), <Input value={f.ruleName} onChange={set("ruleName")} />, { required: true, className: "sm:col-span-2" })}
          {field("actName", t("actName"), <Input value={f.actName} onChange={set("actName")} />, { required: true })}
          {field("ruleNumber", t("ruleNumber"), <Input value={f.ruleNumber} onChange={set("ruleNumber")} />)}
          {field("requirement", t("requirement"), <Textarea rows={3} value={f.requirement} onChange={set("requirement")} />, { required: true, className: "sm:col-span-2" })}
          {field(
            "instrumentTypeId",
            t("instrumentType"),
            <Select value={f.instrumentTypeId} onChange={set("instrumentTypeId")}>
              <option value="">{t("allTypes")}</option>
              {types.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </Select>
          )}
          {field("stateCode", t("stateCode"), <Input value={f.stateCode} onChange={(e) => setF({ ...f, stateCode: e.target.value.toUpperCase() })} maxLength={10} placeholder={t("allStates")} />)}
          {field(
            "valueStatus",
            t("valueStatus"),
            <Select value={f.valueStatus} onChange={set("valueStatus")}>
              <option value="CONFIGURATION_REQUIRED">{t("statusConfig")}</option>
              <option value="SET">{t("statusSet")}</option>
            </Select>,
            { required: true }
          )}
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            {field("value", t("value"), <Input value={f.value} onChange={set("value")} disabled={f.valueStatus !== "SET"} />, { required: f.valueStatus === "SET" })}
            {field("unit", t("unit"), <Input value={f.unit} onChange={set("unit")} />)}
          </div>
          {field("sourceNotification", t("sourceNotification"), <Input value={f.sourceNotification} onChange={set("sourceNotification")} />, {
            required: f.valueStatus === "SET",
            className: "sm:col-span-2",
            hint: t("sourceHint"),
          })}
          {field("sourceDocument", t("sourceDocument"), <Input type="url" value={f.sourceDocument} onChange={set("sourceDocument")} placeholder="https://" />, { className: "sm:col-span-2" })}
          {field("effectiveFrom", t("effectiveFrom"), <Input type="date" value={f.effectiveFrom} onChange={set("effectiveFrom")} />, { required: true })}
        </div>
      </div>
    </Drawer>
  );
}
