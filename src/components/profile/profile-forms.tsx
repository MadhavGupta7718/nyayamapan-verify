"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { KeyRound, Save } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/routing";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";

export function PreferencesForm({
  initial,
}: {
  initial: { name: string; mobile: string; locale: string; emailAlerts: boolean; expiryDigest: boolean };
}) {
  const t = useTranslations("profile.prefs");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const pathname = usePathname();
  const active = useLocale();
  const [f, setF] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.name.trim().length < 2) errs.name = t("errors.name");
    if (f.mobile && !/^[6-9]\d{9}$/.test(f.mobile)) errs.mobile = t("errors.mobile");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api("/api/profile", { method: "PATCH", body: { kind: "preferences", ...f, name: f.name.trim() } });
      toast.success(t("saved"));
      if (f.locale !== active) router.replace(pathname, { locale: f.locale as "en" | "hi" });
      else router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, te));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={save} noValidate>
        <CardHeader title={t("title")} description={t("desc")} />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field id="pf-name" label={t("name")} required error={errors.name}>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
          </Field>
          <Field id="pf-mobile" label={t("mobile")} error={errors.mobile} hint={t("mobileHint")}>
            <Input inputMode="numeric" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} autoComplete="tel-national" />
          </Field>
          <Field id="pf-locale" label={t("language")}>
            <Select value={f.locale} onChange={(e) => setF({ ...f, locale: e.target.value })}>
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </Select>
          </Field>
          <div className="space-y-3 sm:col-span-2">
            <p className="text-label text-fg">{t("alerts")}</p>
            <Checkbox label={t("emailAlerts")} description={t("emailAlertsDesc")} checked={f.emailAlerts} onChange={(e) => setF({ ...f, emailAlerts: e.target.checked })} />
            <Checkbox label={t("expiryDigest")} description={t("expiryDigestDesc")} checked={f.expiryDigest} onChange={(e) => setF({ ...f, expiryDigest: e.target.checked })} />
          </div>
        </div>
        <CardFooter>
          <Button type="submit" loading={busy} disabled={!dirty}>
            <Save /> {t("save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function strength(p: string) {
  let s = 0;
  if (p.length >= 10) s++;
  if (p.length >= 14) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

export function PasswordForm() {
  const t = useTranslations("profile.password");
  const te = useTranslations("apiErrors");
  const [f, setF] = React.useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const score = strength(f.next);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.current) errs.current = t("errors.current");
    if (f.next.length < 10 || !/[a-z]/.test(f.next) || !/[A-Z]/.test(f.next) || !/\d/.test(f.next)) errs.next = t("errors.policy");
    else if (f.next === f.current) errs.next = t("errors.same");
    if (f.confirm !== f.next) errs.confirm = t("errors.match");
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      document.getElementById(`pw-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await api("/api/profile", { method: "PATCH", body: { kind: "password", currentPassword: f.current, newPassword: f.next } });
      toast.success(t("changed"));
      setF({ current: "", next: "", confirm: "" });
    } catch (err) {
      if (err instanceof ApiError && err.code === "CURRENT_PASSWORD_INCORRECT") setErrors({ current: te("CURRENT_PASSWORD_INCORRECT") });
      else toast.error(errorMessage(err, te));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={save} noValidate>
        <CardHeader icon={<KeyRound />} title={t("title")} description={t("desc")} />
        <div className="space-y-4 px-5 py-5">
          <Field id="pw-current" label={t("current")} required error={errors.current}>
            <Input type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} autoComplete="current-password" />
          </Field>
          <div>
            <Field id="pw-next" label={t("new")} required error={errors.next} hint={t("policy")}>
              <Input type="password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} autoComplete="new-password" />
            </Field>
            {f.next ? (
              <div className="mt-2 flex items-center gap-2" aria-live="polite">
                <div className="flex flex-1 gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={
                        "h-1 flex-1 rounded-full " + (i < score ? (score <= 2 ? "bg-danger-500" : score <= 3 ? "bg-warning-500" : "bg-success-500") : "bg-ink-100")
                      }
                    />
                  ))}
                </div>
                <span className="text-caption text-fg-subtle">{t(`strength.${Math.min(score, 4)}`)}</span>
              </div>
            ) : null}
          </div>
          <Field id="pw-confirm" label={t("confirm")} required error={errors.confirm}>
            <Input type="password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} autoComplete="new-password" />
          </Field>
        </div>
        <CardFooter>
          <Button type="submit" loading={busy}>
            {t("submit")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function ExpiryAlertSettings({ initial }: { initial: number[] }) {
  const t = useTranslations("settings.alerts");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [value, setValue] = React.useState(initial.join(", "));
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const days = value
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number);
    if (!days.length || days.length > 10 || days.some((d) => !Number.isInteger(d) || d < 1 || d > 365)) {
      setError(t("error"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ data: { expiryAlertDays: number[] } }>("/api/settings", { method: "PATCH", body: { expiryAlertDays: days } });
      setValue(r.data.expiryAlertDays.join(", "));
      toast.success(t("saved"));
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, te));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={save} noValidate>
        <CardHeader title={t("title")} description={t("desc")} />
        <div className="px-5 py-5">
          <Field id="alert-days" label={t("label")} error={error} hint={t("hint")}>
            <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" className="max-w-xs" />
          </Field>
        </div>
        <CardFooter>
          <Button type="submit" loading={busy} disabled={value === initial.join(", ")}>
            <Save /> {t("save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
