"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { FormSection } from "@/components/ui/form-section";
import { InlineAlert } from "@/components/ui/states";

type State = { id: string; label: string; districts: { id: string; label: string }[] };
const ORG_TYPES = ["TRADER", "MANUFACTURER", "PACKER", "FUEL_STATION", "INSTITUTION", "OTHER"] as const;
const EMPTY = {
  organizationName: "",
  organizationType: "TRADER",
  gstin: "",
  stateId: "",
  districtId: "",
  address: "",
  name: "",
  email: "",
  mobile: "",
  password: "",
  confirm: "",
  acceptTerms: false,
};
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function RegisterForm({ states }: { states: State[] }) {
  const t = useTranslations("register");
  const te = useTranslations("apiErrors");
  const [f, setF] = React.useState(EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const districts = states.find((s) => s.id === f.stateId)?.districts ?? [];
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  function validate() {
    const e: Record<string, string> = {};
    if (f.organizationName.trim().length < 3) e.organizationName = t("errors.orgName");
    if (f.gstin && !GSTIN_RE.test(f.gstin.toUpperCase())) e.gstin = t("errors.gstin");
    if (!f.stateId) e.stateId = t("errors.state");
    if (f.address.trim().length < 5) e.address = t("errors.address");
    if (f.name.trim().length < 2) e.name = t("errors.name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = t("errors.email");
    if (!/^[6-9]\d{9}$/.test(f.mobile)) e.mobile = t("errors.mobile");
    if (f.password.length < 10 || !/[a-z]/.test(f.password) || !/[A-Z]/.test(f.password) || !/\d/.test(f.password)) e.password = t("errors.password");
    if (f.confirm !== f.password) e.confirm = t("errors.confirm");
    if (!f.acceptTerms) e.acceptTerms = t("errors.terms");
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) document.getElementById(`rg-${first}`)?.focus();
    return !first;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const { confirm: _confirm, ...body } = f;
      await api("/api/register", { body: { ...body, gstin: f.gstin.toUpperCase(), acceptTerms: true } });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_IN_USE") {
        setErrors({ email: te("EMAIL_IN_USE") });
        document.getElementById("rg-email")?.focus();
      } else setFormError(errorMessage(err, te));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success-600" />
        <h2 className="mt-4 text-h2 text-fg">{t("done.title")}</h2>
        <p className="mx-auto mt-2 max-w-md text-body-sm text-fg-muted">{t("done.desc", { email: f.email })}</p>
        <Link href="/login" className={buttonVariants({ size: "lg", className: "mt-6" })}>
          {t("done.signIn")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {formError ? <InlineAlert tone="danger" title={formError} /> : null}
      <FormSection title={t("sections.org")} description={t("sections.orgDesc")}>
          <Field id="rg-organizationName" label={t("orgName")} required error={errors.organizationName} className="sm:col-span-2">
            <Input value={f.organizationName} onChange={set("organizationName")} autoComplete="organization" />
          </Field>
          <Field id="rg-organizationType" label={t("orgType")} required>
            <Select value={f.organizationType} onChange={set("organizationType")}>
              {ORG_TYPES.map((o) => (
                <option key={o} value={o}>
                  {t(`orgTypes.${o}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="rg-gstin" label={t("gstin")} error={errors.gstin} hint={t("gstinHint")}>
            <Input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase().slice(0, 15) })} className="font-mono uppercase" />
          </Field>
          <Field id="rg-stateId" label={t("state")} required error={errors.stateId}>
            <Select value={f.stateId} onChange={(e) => setF({ ...f, stateId: e.target.value, districtId: "" })}>
              <option value="">{t("select")}</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="rg-districtId" label={t("district")}>
            <Select value={f.districtId} onChange={set("districtId")} disabled={!districts.length}>
              <option value="">{t("select")}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="rg-address" label={t("address")} required error={errors.address} className="sm:col-span-2">
            <Textarea rows={2} value={f.address} onChange={set("address")} autoComplete="street-address" />
          </Field>
      </FormSection>

      <FormSection title={t("sections.contact")} description={t("sections.contactDesc")}>
          <Field id="rg-name" label={t("name")} required error={errors.name}>
            <Input value={f.name} onChange={set("name")} autoComplete="name" />
          </Field>
          <Field id="rg-mobile" label={t("mobile")} required error={errors.mobile}>
            <Input inputMode="numeric" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} autoComplete="tel-national" />
          </Field>
          <Field id="rg-email" label={t("email")} required error={errors.email} className="sm:col-span-2">
            <Input type="email" value={f.email} onChange={set("email")} autoComplete="email" />
          </Field>
          <Field id="rg-password" label={t("password")} required error={errors.password} hint={t("passwordHint")}>
            <Input type="password" value={f.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
          <Field id="rg-confirm" label={t("confirm")} required error={errors.confirm}>
            <Input type="password" value={f.confirm} onChange={set("confirm")} autoComplete="new-password" />
          </Field>
      </FormSection>

      <div>
        <Checkbox id="rg-acceptTerms" checked={f.acceptTerms} onChange={(e) => setF({ ...f, acceptTerms: e.target.checked })} label={t("terms")} description={t("termsDesc")} />
        {errors.acceptTerms ? (
          <p role="alert" className="mt-1.5 text-caption font-medium text-danger-700">
            {errors.acceptTerms}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" block loading={busy}>
        {t("submit")}
      </Button>
    </form>
  );
}
