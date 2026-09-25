"use client";

import * as React from "react";
import { useLinkStatus } from "next/link";
import { useTranslations } from "next-intl";
import type { Role } from "@prisma/client";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { ACCOUNT_ITEMS, isActivePath, navForRole, type NavItem } from "./nav-config";
import { BrandLockup } from "./brand";

function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      className={cn(
        "ml-auto size-1.5 rounded-full bg-accent transition-opacity duration-150",
        pending ? "animate-pulse opacity-100" : "opacity-0"
      )}
      aria-hidden
    />
  );
}

function NavLink({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-md px-3 text-body-sm font-medium transition-colors duration-150",
        active ? "bg-white/[0.09] text-white" : "text-brand-200 hover:bg-white/[0.05] hover:text-white"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent transition-transform duration-200 ease-out",
          active ? "scale-y-100" : "scale-y-0"
        )}
        aria-hidden
      />
      <Icon className={cn("size-[18px] shrink-0 transition-colors", active ? "text-white" : "text-brand-300 group-hover:text-white")} aria-hidden />
      <span className="truncate">{t(item.labelKey)}</span>
      {badge ? (
        <span className="ml-auto rounded-full bg-accent px-1.5 text-[0.6875rem] font-semibold leading-[1.125rem] text-white tabular">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : (
        <PendingDot />
      )}
    </Link>
  );
}

export function SidebarNav({
  role,
  unread,
  onNavigate,
}: {
  role: Role;
  unread: number;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const groups = navForRole(role);
  return (
    <nav aria-label={t("primary")} className="flex flex-1 flex-col overflow-y-auto px-3 pb-3 scrollbar-thin">
      {groups.map((g) => (
        <div key={g.key} className="mt-5 first:mt-2">
          {g.labelKey ? (
            <p className="mb-1.5 px-3 text-overline uppercase text-brand-400">{t(g.labelKey)}</p>
          ) : null}
          <ul className="space-y-0.5">
            {g.items.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={isActivePath(pathname, item.href)}
                  badge={item.module === "notifications" ? unread : undefined}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="mt-auto border-t border-white/10 pt-3">
        <ul className="space-y-0.5">
          {ACCOUNT_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActivePath(pathname, item.href)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export function Sidebar({ role, unread, brand, tagline }: { role: Role; unread: number; brand: string; tagline: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col bg-brand-950 lg:flex">
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-5">
        <Link href="/dashboard" className="min-w-0 rounded-md">
          <BrandLockup name={brand} tagline={tagline} inverse />
        </Link>
      </div>
      <SidebarNav role={role} unread={unread} />
    </aside>
  );
}
