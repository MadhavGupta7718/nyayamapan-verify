"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { ArrowRight, Award, CornerDownLeft, FilePlus2, FileStack, Gauge, Loader2, QrCode, Search, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Role } from "@prisma/client";
import { useRouter } from "@/i18n/routing";
import { canAccessModule } from "@/lib/permissions";
import { StatusBadge } from "@/components/ui/status-badge";
import { ACCOUNT_ITEMS, navForRole } from "./nav-config";

type SearchResults = {
  applications: { id: string; applicationNumber: string; status: string; subtitle: string }[];
  instruments: { id: string; instrumentCode: string; subtitle: string; verificationStatus: string }[];
  certificates: { id: string; certificateNumber: string; status: string; subtitle: string }[];
  users: { id: string; name: string; subtitle: string }[];
};

const EMPTY: SearchResults = { applications: [], instruments: [], certificates: [], users: [] };

export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

const itemCls =
  "flex cursor-pointer select-none items-center gap-3 rounded-md px-3 py-2.5 text-body-sm text-fg outline-none data-[selected=true]:bg-brand-50 data-[selected=true]:text-brand-900 [&_svg]:size-4";

export function CommandPalette({ open, onOpenChange, role }: { open: boolean; onOpenChange: (o: boolean) => void; role: Role }) {
  const t = useTranslations();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResults>(EMPTY);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(EMPTY);
      setFailed(false);
    }
  }, [open]);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { data: SearchResults };
        setResults(json.data);
        setFailed(false);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setFailed(true);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      window.clearTimeout(id);
    };
  }, [query]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const q = query.trim().toLowerCase();
  const navItems = [...navForRole(role).flatMap((g) => g.items), ...ACCOUNT_ITEMS].filter(
    (i) => !q || t(`nav.${i.labelKey}`).toLowerCase().includes(q) || i.href.includes(q)
  );
  const actions = [
    canAccessModule(role, "applications") && role === "BUSINESS_USER"
      ? { key: "newApp", label: t("palette.newApplication"), href: "/applications/new", icon: FilePlus2 }
      : null,
    role === "BUSINESS_USER"
      ? { key: "newInstrument", label: t("palette.registerInstrument"), href: "/instruments/new", icon: Gauge }
      : null,
    { key: "verify", label: t("palette.verifyCertificate"), href: "/verify", icon: QrCode },
  ].filter((a): a is NonNullable<typeof a> => !!a && (!q || a.label.toLowerCase().includes(q)));
  const hasResults =
    results.applications.length + results.instruments.length + results.certificates.length + results.users.length > 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] animate-fade-in bg-ink-900/40 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-x-0 top-[12vh] z-[60] mx-auto w-[calc(100vw-1.5rem)] max-w-xl animate-scale-in overflow-hidden rounded-xl bg-surface shadow-overlay focus:outline-none">
          <Dialog.Title className="sr-only">{t("palette.title")}</Dialog.Title>
          <Dialog.Description className="sr-only">{t("palette.description")}</Dialog.Description>
          <Command shouldFilter={false} loop label={t("palette.title")}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              {loading ? <Loader2 className="size-4 animate-spin text-fg-subtle" /> : <Search className="size-4 text-fg-subtle" />}
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t("palette.placeholder")}
                className="h-12 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-faint"
              />
              <kbd className="hidden rounded border border-line bg-surface-subtle px-1.5 py-0.5 font-mono text-[0.6875rem] text-fg-subtle sm:block">ESC</kbd>
            </div>
            <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2 scrollbar-thin">
              {failed ? <p className="px-3 py-6 text-center text-body-sm text-danger-700">{t("palette.searchFailed")}</p> : null}
              {!loading && q.length >= 2 && !hasResults && !navItems.length && !actions.length && !failed ? (
                <p className="px-3 py-8 text-center text-body-sm text-fg-subtle">{t("palette.noResults", { query })}</p>
              ) : null}

              {results.applications.length ? (
                <Command.Group heading={t("nav.applications")} className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-overline [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-fg-subtle">
                  {results.applications.map((r) => (
                    <Command.Item key={r.id} value={`app-${r.id}`} onSelect={() => go(`/applications/${r.id}`)} className={itemCls}>
                      <FileStack className="text-fg-subtle" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.applicationNumber}</span>
                        <span className="block truncate text-caption text-fg-subtle">{r.subtitle}</span>
                      </span>
                      <StatusBadge status={r.status} withTooltip={false} />
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {results.instruments.length ? (
                <Command.Group heading={t("nav.instruments")} className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-overline [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-fg-subtle">
                  {results.instruments.map((r) => (
                    <Command.Item key={r.id} value={`ins-${r.id}`} onSelect={() => go(`/instruments/${r.id}`)} className={itemCls}>
                      <Gauge className="text-fg-subtle" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.instrumentCode}</span>
                        <span className="block truncate text-caption text-fg-subtle">{r.subtitle}</span>
                      </span>
                      <StatusBadge status={r.verificationStatus} withTooltip={false} />
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {results.certificates.length ? (
                <Command.Group heading={t("nav.certificates")} className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-overline [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-fg-subtle">
                  {results.certificates.map((r) => (
                    <Command.Item key={r.id} value={`cert-${r.id}`} onSelect={() => go(`/certificates/${r.id}`)} className={itemCls}>
                      <Award className="text-fg-subtle" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.certificateNumber}</span>
                        <span className="block truncate text-caption text-fg-subtle">{r.subtitle}</span>
                      </span>
                      <StatusBadge status={r.status} withTooltip={false} />
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {results.users.length ? (
                <Command.Group heading={t("nav.users")} className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-overline [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-fg-subtle">
                  {results.users.map((r) => (
                    <Command.Item key={r.id} value={`user-${r.id}`} onSelect={() => go(`/users?q=${encodeURIComponent(r.name)}`)} className={itemCls}>
                      <UserRound className="text-fg-subtle" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.name}</span>
                        <span className="block truncate text-caption text-fg-subtle">{r.subtitle}</span>
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              {actions.length ? (
                <Command.Group heading={t("palette.actions")} className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-overline [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-fg-subtle">
                  {actions.map((a) => (
                    <Command.Item key={a.key} value={`action-${a.key}`} onSelect={() => go(a.href)} className={itemCls}>
                      <a.icon className="text-fg-subtle" />
                      <span className="flex-1">{a.label}</span>
                      <ArrowRight className="text-fg-faint" />
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {navItems.length ? (
                <Command.Group heading={t("palette.goTo")} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-overline [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-fg-subtle">
                  {navItems.map((i) => (
                    <Command.Item key={i.href} value={`nav-${i.href}`} onSelect={() => go(i.href)} className={itemCls}>
                      <i.icon className="text-fg-subtle" />
                      <span className="flex-1">{t(`nav.${i.labelKey}`)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
            </Command.List>
            <div className="flex items-center justify-between border-t border-line bg-surface-subtle px-4 py-2 text-caption text-fg-subtle">
              <span>{t("palette.hint")}</span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="size-3.5" /> {t("palette.open")}
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
