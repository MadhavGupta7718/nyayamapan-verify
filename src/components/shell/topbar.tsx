"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Bell, ChevronRight, LogOut, Menu, Search, Settings, UserRound, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Role } from "@prisma/client";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { cn, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { signOutAction } from "@/server/actions";
import { CommandPalette, useCommandPalette } from "./command-palette";
import { LocaleSwitch } from "./locale-switch";
import { SEGMENT_LABELS } from "./nav-config";
import { SidebarNav } from "./sidebar";
import { BrandLockup } from "./brand";

type ShellUser = { name: string; email: string; role: Role };

function Breadcrumbs() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return null;
  const crumbs = segments.map((seg, i) => {
    const href = `/${segments.slice(0, i + 1).join("/")}`;
    const key = i === 0 ? SEGMENT_LABELS[seg] : seg === "new" ? "new" : null;
    const label = key ? t(key) : t("details");
    return { href, label };
  });
  return (
    <nav aria-label={t("breadcrumbs")} className="hidden min-w-0 md:block">
      <ol className="flex items-center gap-1.5 text-body-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href} className="flex min-w-0 items-center gap-1.5">
              {i > 0 ? <ChevronRight className="size-3.5 shrink-0 text-fg-faint" aria-hidden /> : null}
              {last ? (
                <span aria-current="page" className="truncate font-medium text-fg">
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="truncate text-fg-subtle transition-colors hover:text-fg">
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function MobileMenu({ role, unread, brand, tagline }: { role: Role; unread: number; brand: string; tagline: string }) {
  const t = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("openMenu")}>
          <Menu />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink-900/50 lg:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[18rem] max-w-[85vw] animate-slide-in-left flex-col bg-brand-950 shadow-overlay focus:outline-none lg:hidden">
          <Dialog.Title className="sr-only">{t("menu")}</Dialog.Title>
          <Dialog.Description className="sr-only">{t("menu")}</Dialog.Description>
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
            <BrandLockup name={brand} tagline={tagline} inverse />
            <Dialog.Close asChild>
              <button className="grid size-9 place-items-center rounded-md text-brand-200 hover:bg-white/10" aria-label={t("close")}>
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>
          <SidebarNav role={role} unread={unread} onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function TopBar({
  user,
  unread,
  brand,
  tagline,
}: {
  user: ShellUser;
  unread: number;
  brand: string;
  tagline: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const palette = useCommandPalette();
  const router = useRouter();
  const [isMac, setIsMac] = React.useState(false);
  React.useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <MobileMenu role={user.role} unread={unread} brand={brand} tagline={tagline} />
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => palette.setOpen(true)}
          className="group flex h-9 items-center gap-2 rounded-md border border-line bg-surface-subtle px-2.5 text-body-sm text-fg-subtle transition-colors hover:border-line-strong hover:text-fg sm:w-64"
          aria-label={t("palette.trigger")}
          aria-keyshortcuts="Control+K Meta+K"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden min-w-0 flex-1 truncate text-left sm:inline">{t("palette.trigger")}</span>
          <kbd className="hidden shrink-0 rounded border border-line bg-surface px-1.5 font-mono text-[0.6875rem] text-fg-subtle sm:inline">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        </button>
        <LocaleSwitch className="hidden sm:inline-flex" />
        <Link
          href="/notifications"
          className="relative grid size-9 place-items-center rounded-md text-fg-muted transition-colors hover:bg-ink-100 hover:text-fg"
          aria-label={t("nav.notificationsCount", { count: unread })}
        >
          <Bell className="size-[18px]" />
          {unread ? (
            <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.625rem] font-bold leading-4 text-white ring-2 ring-surface">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Link>
        <Dropdown>
          <DropdownTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-full p-0.5 pr-0.5 transition-colors hover:bg-ink-100 sm:rounded-md sm:pr-2"
              aria-label={t("nav.accountMenu")}
            >
              <span className="grid size-8 place-items-center rounded-full bg-brand-100 text-caption font-semibold text-brand-800">
                {initials(user.name)}
              </span>
              <span className="hidden text-left leading-tight xl:block">
                <span className="block max-w-[10rem] truncate text-body-sm font-medium text-fg">{user.name}</span>
                <span className="block text-caption text-fg-subtle">{t(`roles.${user.role}`)}</span>
              </span>
            </button>
          </DropdownTrigger>
          <DropdownContent className="w-64">
            <div className="px-2.5 py-2">
              <p className="truncate text-body-sm font-medium text-fg">{user.name}</p>
              <p className="truncate text-caption text-fg-subtle">{user.email}</p>
              <p className="mt-1.5 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-caption font-medium text-brand-800">
                {t(`roles.${user.role}`)}
              </p>
            </div>
            <DropdownSeparator />
            <DropdownItem icon={<UserRound />} onSelect={() => router.push("/profile")}>
              {t("nav.profile")}
            </DropdownItem>
            <DropdownItem icon={<Settings />} onSelect={() => router.push("/settings")}>
              {t("nav.settings")}
            </DropdownItem>
            <div className="sm:hidden">
              <DropdownSeparator />
              <div className="px-1">
                <LocaleSwitch className="w-full justify-start" />
              </div>
            </div>
            <DropdownSeparator />
            <form action={signOutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-body-sm text-danger-700 outline-none transition-colors hover:bg-danger-50 focus-visible:bg-danger-50"
                )}
              >
                <LogOut className="size-4" /> {t("nav.logout")}
              </button>
            </form>
          </DropdownContent>
        </Dropdown>
      </div>
      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} role={user.role} />
    </header>
  );
}
