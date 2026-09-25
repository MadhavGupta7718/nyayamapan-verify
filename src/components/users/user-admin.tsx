"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eye, EyeOff, MoreHorizontal, Pencil, UserPlus } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";

export type StateOption = { id: string; label: string; districts: { id: string; label: string }[] };
export type GatcOption = { id: string; label: string; stateId: string | null };

const needsDistricts = (role: string) => role === "LMO";
const needsGatc = (role: string) => role === "GATC_OFFICER";

/** Searchable checkbox list of the districts an LMO covers. */
function DistrictPicker({ id, districts, value, onChange }: { id: string; districts: { id: string; label: string }[]; value: string[]; onChange: (ids: string[]) => void }) {
  const t = useTranslations("users.create");
  const [q, setQ] = React.useState("");
  const shown = districts.filter((d) => !q || d.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div id={id} className="rounded-lg border border-line-strong">
      <div className="flex items-center gap-2 border-b border-line p-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchDistricts")} aria-label={t("searchDistricts")} className="h-8" />
        <span className="shrink-0 px-1 text-caption text-fg-subtle">{t("selectedCount", { count: value.length })}</span>
      </div>
      <ul className="max-h-48 overflow-y-auto p-1 scrollbar-thin">
        {shown.map((d) => {
          const checked = value.includes(d.id);
          return (
            <li key={d.id}>
              <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-body-sm hover:bg-surface-subtle", checked && "bg-brand-50")}>
                <input
                  type="checkbox"
                  className="size-4 accent-brand-700"
                  checked={checked}
                  onChange={(e) => onChange(e.target.checked ? [...value, d.id] : value.filter((x) => x !== d.id))}
                />
                {d.label}
              </label>
            </li>
          );
        })}
        {!shown.length ? <li className="px-2 py-3 text-caption text-fg-subtle">{t("noDistricts")}</li> : null}
      </ul>
    </div>
  );
}

const EMPTY = { name: "", email: "", mobile: "", role: "", stateId: "", districtIds: [] as string[], gatcId: "", password: "" };

export function UserCreateDrawer({
  roles,
  states,
  gatcs,
  defaultStateId,
}: {
  roles: string[];
  states: StateOption[];
  gatcs: GatcOption[];
  defaultStateId?: string | null;
}) {
  const t = useTranslations("users.create");
  const tr = useTranslations("roles");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const initial = React.useMemo(() => ({ ...EMPTY, role: roles[0] ?? "", stateId: defaultStateId ?? "" }), [roles, defaultStateId]);
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState(initial);
  const [show, setShow] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const state = states.find((s) => s.id === f.stateId);
  const stateGatcs = gatcs.filter((g) => g.stateId === f.stateId);

  function validate() {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = t("errors.name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = t("errors.email");
    if (f.mobile && !/^[6-9]\d{9}$/.test(f.mobile)) e.mobile = t("errors.mobile");
    if (!f.stateId) e.stateId = t("errors.state");
    if (needsDistricts(f.role) && !f.districtIds.length) e.districtIds = t("errors.districts");
    if (needsGatc(f.role) && !f.gatcId) e.gatcId = t("errors.gatc");
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
      await api("/api/users", {
        body: {
          name: f.name.trim(),
          email: f.email.trim(),
          mobile: f.mobile,
          role: f.role,
          stateId: f.stateId,
          districtIds: needsDistricts(f.role) ? f.districtIds : undefined,
          gatcId: needsGatc(f.role) ? f.gatcId : undefined,
          password: f.password,
        },
      });
      toast.success(t("created", { name: f.name.trim() }));
      setOpen(false);
      setF(initial);
      router.refresh();
    } catch (e) {
      if ((e as { code?: string }).code === "EMAIL_IN_USE") setErrors({ email: te("EMAIL_IN_USE") });
      toast.error(errorMessage(e, te));
    } finally {
      setBusy(false);
    }
  }

  if (!roles.length) return null;

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
            <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value, districtIds: [], gatcId: "" })} disabled={roles.length === 1}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {tr(r)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="uc-stateId" label={t("state")} required error={errors.stateId}>
            <Select value={f.stateId} onChange={(e) => setF({ ...f, stateId: e.target.value, districtIds: [], gatcId: "" })} disabled={states.length === 1}>
              <option value="">{t("select")}</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {needsDistricts(f.role) && state ? (
          <Field id="uc-districtIds" label={t("districts")} required error={errors.districtIds} hint={t("districtsHint")}>
            <DistrictPicker id="uc-districtIds" districts={state.districts} value={f.districtIds} onChange={(ids) => setF({ ...f, districtIds: ids })} />
          </Field>
        ) : null}
        {needsGatc(f.role) && f.stateId ? (
          <Field id="uc-gatcId" label={t("gatc")} required error={errors.gatcId} hint={stateGatcs.length ? undefined : t("noGatcs")}>
            <Select value={f.gatcId} onChange={(e) => setF({ ...f, gatcId: e.target.value })}>
              <option value="">{t("select")}</option>
              {stateGatcs.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
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

export type EditableUser = {
  id: string;
  name: string;
  mobile: string | null;
  role: string;
  status: string;
  stateId: string | null;
  districtIds: string[];
  gatcId: string | null;
};

function UserEditDrawer({
  user,
  open,
  onOpenChange,
  states,
  gatcs,
  canChangeState,
}: {
  user: EditableUser;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  states: StateOption[];
  gatcs: GatcOption[];
  canChangeState: boolean;
}) {
  const t = useTranslations("users.edit");
  const tc = useTranslations("users.create");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [f, setF] = React.useState({ name: user.name, mobile: user.mobile ?? "", stateId: user.stateId ?? "", districtIds: user.districtIds, gatcId: user.gatcId ?? "", reason: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const state = states.find((s) => s.id === f.stateId);
  const stateGatcs = gatcs.filter((g) => g.stateId === f.stateId);

  React.useEffect(() => {
    if (open) {
      setF({ name: user.name, mobile: user.mobile ?? "", stateId: user.stateId ?? "", districtIds: user.districtIds, gatcId: user.gatcId ?? "", reason: "" });
      setErrors({});
    }
  }, [open, user]);

  async function submit() {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = tc("errors.name");
    if (f.mobile && !/^[6-9]\d{9}$/.test(f.mobile)) e.mobile = tc("errors.mobile");
    if (needsDistricts(user.role) && !f.districtIds.length) e.districtIds = tc("errors.districts");
    if (needsGatc(user.role) && !f.gatcId) e.gatcId = tc("errors.gatc");
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api(`/api/users/${user.id}`, {
        method: "PATCH",
        body: {
          name: f.name.trim(),
          mobile: f.mobile,
          stateId: canChangeState && f.stateId ? f.stateId : undefined,
          districtIds: needsDistricts(user.role) ? f.districtIds : undefined,
          gatcId: needsGatc(user.role) ? f.gatcId : undefined,
          reason: f.reason.trim() || undefined,
        },
      });
      toast.success(t("saved", { name: f.name.trim() }));
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, te));
    } finally {
      setBusy(false);
    }
  }

  const prefix = `ue-${user.id}`;
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={t("title", { name: user.name })}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button onClick={submit} loading={busy}>
            {t("submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id={`${prefix}-name`} label={tc("name")} required error={errors.name}>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="off" />
        </Field>
        <Field id={`${prefix}-mobile`} label={tc("mobile")} error={errors.mobile} hint={tc("mobileHint")}>
          <Input inputMode="numeric" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
        </Field>
        {canChangeState && user.role !== "BUSINESS_USER" ? (
          <Field id={`${prefix}-state`} label={tc("state")} required>
            <Select value={f.stateId} onChange={(e) => setF({ ...f, stateId: e.target.value, districtIds: [], gatcId: "" })}>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {needsDistricts(user.role) && state ? (
          <Field id={`${prefix}-districts`} label={tc("districts")} required error={errors.districtIds} hint={tc("districtsHint")}>
            <DistrictPicker id={`${prefix}-districts`} districts={state.districts} value={f.districtIds} onChange={(ids) => setF({ ...f, districtIds: ids })} />
          </Field>
        ) : null}
        {needsGatc(user.role) ? (
          <Field id={`${prefix}-gatc`} label={tc("gatc")} required error={errors.gatcId}>
            <Select value={f.gatcId} onChange={(e) => setF({ ...f, gatcId: e.target.value })}>
              <option value="">{tc("select")}</option>
              {stateGatcs.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field id={`${prefix}-reason`} label={t("reason")} hint={t("reasonHint")}>
          <Textarea rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} maxLength={500} />
        </Field>
      </div>
    </Drawer>
  );
}

type Target = "ACTIVE" | "SUSPENDED" | "INACTIVE";

export function UserRowMenu({ user, states, gatcs, canChangeState }: { user: EditableUser; states: StateOption[]; gatcs: GatcOption[]; canChangeState: boolean }) {
  const t = useTranslations("users.status");
  const te = useTranslations("apiErrors");
  const tEdit = useTranslations("users.edit");
  const router = useRouter();
  const [target, setTarget] = React.useState<Target | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const options = (["ACTIVE", "SUSPENDED", "INACTIVE"] as Target[]).filter((s) => s !== user.status);
  const name = user.name;

  async function confirm() {
    if (!target) return;
    setBusy(true);
    try {
      await api(`/api/users/${user.id}`, { method: "PATCH", body: { status: target, reason: reason.trim() } });
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
          <DropdownItem icon={<Pencil />} onSelect={() => setEditing(true)}>
            {tEdit("action")}
          </DropdownItem>
          <DropdownSeparator />
          {options.map((s) => (
            <DropdownItem key={s} onSelect={() => setTarget(s)} tone={s !== "ACTIVE" ? "danger" : undefined}>
              {t(`to.${s}`)}
            </DropdownItem>
          ))}
        </DropdownContent>
      </Dropdown>
      <UserEditDrawer user={user} open={editing} onOpenChange={setEditing} states={states} gatcs={gatcs} canChangeState={canChangeState} />
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
        <Field id={`us-${user.id}`} label={t("reason")} required hint={t("reasonHint")}>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
      </ConfirmDialog>
    </>
  );
}
