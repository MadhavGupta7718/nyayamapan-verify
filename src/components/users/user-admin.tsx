"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eye, EyeOff, MoreHorizontal, UserPlus } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from "@/components/ui/dropdown";

const EMPTY = { name: "", email: "", mobile: "", role: "LMO", stateId: "", password: "" };

export function UserCreateDrawer({ roles, states, defaultStateId }: { roles: string[]; states: { id: string; label: string }[]; defaultStateId?: string | null }) {
  const t = useTranslations("users.create");
  const tr = useTranslations("roles");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ ...EMPTY, stateId: defaultStateId ?? "" });
  const [show, setShow] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = t("errors.name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = t("errors.email");
    if (f.mobile && !/^[6-9]\d{9}$/.test(f.mobile)) e.mobile = t("errors.mobile");
    if (!f.stateId) e.stateId = t("errors.state");
    if (f.password.length < 10 || !/[a-z]/.test(f.password) || !/[A-Z]/.test(f.password) || !/\d/.test(f.password)) e.password = t("errors.password");
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) document.getElementById(`uc-${first}`)?.focus();
    return !first;
  }

  async function submit() {
    if (!validate()) return;
    setBusy(true);
    try {
      await api("/api/users", { body: { ...f, name: f.name.trim(), email: f.email.trim() } });
      toast.success(t("created", { name: f.name.trim() }));
      setOpen(false);
      setF({ ...EMPTY, stateId: defaultStateId ?? "" });
      router.refresh();
    } catch (e) {
      if ((e as { code?: string }).code === "EMAIL_IN_USE") setErrors({ email: te("EMAIL_IN_USE") });
      toast.error(errorMessage(e, te));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={t("title")}
      description={t("desc")}
      trigger={
        <Button>
          <UserPlus /> {t("button")}
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
        <Field id="uc-name" label={t("name")} required error={errors.name}>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="off" />
        </Field>
        <Field id="uc-email" label={t("email")} required error={errors.email}>
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="off" />
        </Field>
        <Field id="uc-mobile" label={t("mobile")} error={errors.mobile} hint={t("mobileHint")}>
          <Input inputMode="numeric" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="uc-role" label={t("role")} required>
            <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {tr(r)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="uc-stateId" label={t("state")} required error={errors.stateId}>
            <Select value={f.stateId} onChange={(e) => setF({ ...f, stateId: e.target.value })} disabled={states.length === 1}>
              <option value="">{t("select")}</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <Field id="uc-password" label={t("password")} required error={errors.password} hint={t("passwordHint")}>
            <Input type={show ? "text" : "password"} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
          </Field>
          <button type="button" onClick={() => setShow((s) => !s)} className="mt-1.5 inline-flex items-center gap-1.5 text-caption font-medium text-brand-700 hover:text-brand-900">
            {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {show ? t("hidePassword") : t("showPassword")}
          </button>
        </div>
      </div>
    </Drawer>
  );
}

type Target = "ACTIVE" | "SUSPENDED" | "INACTIVE";

export function UserStatusMenu({ id, name, status }: { id: string; name: string; status: string }) {
  const t = useTranslations("users.status");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [target, setTarget] = React.useState<Target | null>(null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const options = (["ACTIVE", "SUSPENDED", "INACTIVE"] as Target[]).filter((s) => s !== status);

  async function confirm() {
    if (!target) return;
    setBusy(true);
    try {
      await api(`/api/users/${id}`, { method: "PATCH", body: { status: target, reason: reason.trim() } });
      toast.success(t("done", { name }));
      setTarget(null);
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e, te));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("menu", { name })}>
            <MoreHorizontal />
          </Button>
        </DropdownTrigger>
        <DropdownContent align="end">
          {options.map((s) => (
            <DropdownItem key={s} onSelect={() => setTarget(s)} tone={s !== "ACTIVE" ? "danger" : undefined}>
              {t(`to.${s}`)}
            </DropdownItem>
          ))}
        </DropdownContent>
      </Dropdown>
      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => {
          if (!o) {
            setTarget(null);
            setReason("");
          }
        }}
        title={target ? t(`title.${target}`, { name }) : ""}
        description={target ? t(`desc.${target}`) : undefined}
        confirmLabel={target ? t(`to.${target}`) : ""}
        tone={target === "ACTIVE" ? "success" : "danger"}
        loading={busy}
        confirmDisabled={reason.trim().length < 5}
        onConfirm={confirm}
      >
        <Field id={`us-${id}`} label={t("reason")} required hint={t("reasonHint")}>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
      </ConfirmDialog>
    </>
  );
}
