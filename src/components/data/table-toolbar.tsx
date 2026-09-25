"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Columns3, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownCheckboxItem, DropdownContent, DropdownLabel, DropdownTrigger } from "@/components/ui/dropdown";

export type ToolbarFilter = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

export type QuickTab = { value: string; label: string; count?: number };

/**
 * URL-driven toolbar: debounced search, filter selects, quick tabs and column visibility.
 * Every change resets pagination and runs in a transition so the current page stays interactive.
 */
export function TableToolbar({
  tableId,
  searchPlaceholder,
  filters = [],
  columns = [],
  tabs,
  tabKey = "view",
  actions,
}: {
  tableId?: string;
  searchPlaceholder?: string;
  filters?: ToolbarFilter[];
  columns?: { key: string; label: string }[];
  tabs?: QuickTab[];
  tabKey?: string;
  actions?: React.ReactNode;
}) {
  const t = useTranslations("table");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = React.useTransition();
  const [q, setQ] = React.useState(sp.get("q") ?? "");
  const [hidden, setHidden] = React.useState<string[]>([]);

  const update = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      next.delete("page");
      const qs = next.toString();
      start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [sp, pathname, router]
  );

  // Only typing writes `q` to the URL. Reacting to every URL change would re-apply a stale query
  // on Back, or bounce the user back to the list while a row navigation is in flight.
  const typed = React.useRef(false);
  const updateRef = React.useRef(update);
  updateRef.current = update;
  const urlQ = sp.get("q") ?? "";

  React.useEffect(() => {
    if (!typed.current) return;
    const id = window.setTimeout(() => {
      typed.current = false;
      updateRef.current({ q: q.trim() || null });
    }, 300);
    return () => window.clearTimeout(id);
  }, [q]);

  React.useEffect(() => {
    if (!typed.current) setQ(urlQ);
  }, [urlQ]);

  function typeQuery(value: string) {
    typed.current = true;
    setQ(value);
  }

  React.useEffect(() => {
    if (!tableId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`cols:${tableId}`) ?? "[]");
      if (Array.isArray(saved)) setHidden(saved);
    } catch {
      /* ignore malformed preference */
    }
  }, [tableId]);

  function toggleColumn(key: string) {
    setHidden((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      if (tableId) localStorage.setItem(`cols:${tableId}`, JSON.stringify(next));
      return next;
    });
  }

  const activeFilters = filters.filter((f) => sp.get(f.key));
  const activeTab = tabs ? sp.get(tabKey) ?? tabs[0]?.value : undefined;

  return (
    <div className="mb-3 space-y-3">
      {tableId && hidden.length ? (
        <style>{hidden.map((k) => `#${tableId} [data-col="${k}"]{display:none}`).join("")}</style>
      ) : null}

      {tabs ? (
        <div className="relative -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-thin" role="tablist">
          {tabs.map((tab) => {
            const active = tab.value === activeTab;
            return (
              <button
                key={tab.value}
                role="tab"
                aria-selected={active}
                onClick={() => update({ [tabKey]: tab.value === tabs[0].value ? null : tab.value })}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-2 rounded-full px-3.5 text-body-sm font-medium transition-colors",
                  active ? "bg-brand-800 text-white" : "bg-surface text-fg-muted ring-1 ring-inset ring-line hover:text-fg hover:ring-line-strong"
                )}
              >
                {tab.label}
                {tab.count != null ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-caption tabular",
                      active ? "bg-white/20 text-white" : "bg-ink-100 text-fg-subtle"
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-faint" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => typeQuery(e.target.value)}
            placeholder={searchPlaceholder ?? t("search")}
            aria-label={searchPlaceholder ?? t("search")}
            className="field-control h-9 pl-9 pr-8"
          />
          {q ? (
            <button
              type="button"
              onClick={() => typeQuery("")}
              className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-fg-faint hover:text-fg"
              aria-label={t("clearSearch")}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <label key={f.key} className="relative">
              <span className="sr-only">{f.label}</span>
              <select
                value={sp.get(f.key) ?? ""}
                onChange={(e) => update({ [f.key]: e.target.value || null })}
                className={cn(
                  "h-9 appearance-none rounded-md border bg-surface pl-3 pr-8 text-body-sm shadow-xs transition-colors",
                  sp.get(f.key) ? "border-brand-300 bg-brand-50 text-brand-800" : "border-line-strong text-fg-muted hover:border-ink-400"
                )}
              >
                <option value="">{f.label}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
              </svg>
            </label>
          ))}
          {activeFilters.length || sp.get("q") ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                update(Object.fromEntries([...filters.map((f) => [f.key, null]), ["q", null]]));
              }}
            >
              <X /> {t("reset")}
            </Button>
          ) : null}
          {columns.length ? (
            <Dropdown>
              <DropdownTrigger asChild>
                <Button variant="secondary" size="sm" aria-label={t("columns")}>
                  <Columns3 /> <span className="hidden sm:inline">{t("columns")}</span>
                </Button>
              </DropdownTrigger>
              <DropdownContent>
                <DropdownLabel>{t("visibleColumns")}</DropdownLabel>
                {columns.map((c) => (
                  <DropdownCheckboxItem key={c.key} checked={!hidden.includes(c.key)} onCheckedChange={() => toggleColumn(c.key)}>
                    {c.label}
                  </DropdownCheckboxItem>
                ))}
              </DropdownContent>
            </Dropdown>
          ) : null}
          {actions}
        </div>
      </div>
      <div className="relative h-0.5 overflow-hidden rounded-full" aria-hidden>
        {pending ? <div className="absolute inset-y-0 w-1/3 animate-progress-indeterminate rounded-full bg-brand-500" /> : null}
      </div>
    </div>
  );
}
