"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/input";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";

type Kind = "state" | "district";
type Entry = {
  id: string;
  code?: string;
  name: string;
  nameHi: string | null;
  isActive: boolean;
};

const endpoint = (kind: Kind) => (kind === "state" ? "/api/geography/states" : "/api/geography/districts");

function GeoFormDrawer({
  kind,
  stateId,
  entry,
  open,
  onOpenChange,
  trigger,
}: {
  kind: Kind;
  stateId?: string;
  entry?: Entry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations("geography");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [f, setF] = React.useState({
    code: entry?.code ?? "",
    name: entry?.name ?? "",
    nameHi: entry?.nameHi ?? "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const prefix = `geo-${kind}-${entry?.id ?? "new"}`;

  React.useEffect(() => {
    if (open) {
      setF({
        code: entry?.code ?? "",
        name: entry?.name ?? "",
        nameHi: entry?.nameHi ?? "",
      });
      setErrors({});
    }
  }, [open, entry]);

  async function submit() {
    const e: Record<string, string> = {};
    if (kind === "state" && !entry && !/^[A-Za-z]{2,3}$/.test(f.code.trim())) e.code = t("errors.code");
    if (f.name.trim().length < 2) e.name = t("errors.name");
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (entry) {
        await api(`${endpoint(kind)}/${entry.id}`, {
          method: "PATCH",
          body: { name: f.name.trim(), nameHi: f.nameHi.trim() },
        });
      } else {
        await api(endpoint(kind), {
          body:
            kind === "state"
              ? {
                  code: f.code.trim(),
                  name: f.name.trim(),
                  nameHi: f.nameHi.trim(),
                }
              : { stateId, name: f.name.trim(), nameHi: f.nameHi.trim() },
        });
      }
      toast.success(t(entry ? "saved" : "added", { name: f.name.trim() }));
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, te));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      width="sm"
      trigger={trigger}
      title={t(`${entry ? "edit" : "add"}.${kind}`)}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} loading={busy}>
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {kind === "state" ? (
          <Field id={`${prefix}-code`} label={t("code")} required={!entry} error={errors.code} hint={t("codeHint")}>
            <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().slice(0, 3) })} disabled={!!entry} autoComplete="off" />
          </Field>
        ) : null}
        <Field id={`${prefix}-name`} label={t("nameEn")} required error={errors.name}>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} autoComplete="off" />
        </Field>
        <Field id={`${prefix}-nameHi`} label={t("nameHi")}>
          <Input value={f.nameHi} onChange={(e) => setF({ ...f, nameHi: e.target.value })} maxLength={80} lang="hi" autoComplete="off" />
        </Field>
      </div>
    </Drawer>
  );
}

export function GeoAddButton({ kind, stateId }: { kind: Kind; stateId?: string }) {
  const t = useTranslations("geography");
  const [open, setOpen] = React.useState(false);
  return (
    <GeoFormDrawer
      kind={kind}
      stateId={stateId}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button size="sm" variant={kind === "state" ? "secondary" : "primary"}>
          <Plus /> {t(`add.${kind}`)}
        </Button>
      }
    />
  );
}

export function GeoRowMenu({ kind, entry }: { kind: Kind; entry: Entry }) {
  const t = useTranslations("geography");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function toggle() {
    try {
      await api(`${endpoint(kind)}/${entry.id}`, {
        method: "PATCH",
        body: { isActive: !entry.isActive },
      });
      toast.success(t(entry.isActive ? "deactivated" : "activated", { name: entry.name }));
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, te));
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await api<{ data: { outcome: "deleted" | "deactivated" } }>(`${endpoint(kind)}/${entry.id}`, { method: "DELETE" });
      toast.success(
        t(res.data.outcome === "deleted" ? "deleted" : "deactivatedInUse", {
          name: entry.name,
        }),
      );
      setRemoving(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, te));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("menu", { name: entry.name })}>
            <MoreHorizontal />
          </Button>
        </DropdownTrigger>
        <DropdownContent align="end">
          <DropdownItem icon={<Pencil />} onSelect={() => setEditing(true)}>
            {t("editAction")}
          </DropdownItem>
          <DropdownItem icon={<Power />} onSelect={toggle}>
            {t(entry.isActive ? "deactivate" : "activate")}
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem icon={<Trash2 />} tone="danger" onSelect={() => setRemoving(true)}>
            {t("remove")}
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
      <GeoFormDrawer kind={kind} entry={entry} open={editing} onOpenChange={setEditing} />
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={t(`removeTitle.${kind}`, { name: entry.name })}
        description={t(`removeDesc.${kind}`)}
        confirmLabel={t("remove")}
        tone="danger"
        loading={busy}
        onConfirm={remove}
      />
    </>
  );
}
