"use client";

import { ClipboardList, Home, MapPinned, ScanLine, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/** Bottom navigation for field officers on phones: large targets, one prominent Verify action. */
export function MobileFieldNav() {
  const t = useTranslations("field");
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: t("home"), icon: Home, match: (p: string) => p === "/dashboard" },
    { href: "/verification", label: t("assignments"), icon: ClipboardList, match: (p: string) => p === "/verification" },
    { href: "/verification/next", label: t("verify"), icon: ScanLine, primary: true, match: (p: string) => p.startsWith("/verification/") },
    { href: "/scheduling?view=map", label: t("map"), icon: MapPinned, match: (p: string) => p.startsWith("/scheduling") },
    { href: "/profile", label: t("profile"), icon: UserRound, match: (p: string) => p.startsWith("/profile") },
  ];
  return (
    <nav
      aria-label={t("navLabel")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md safe-bottom lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          if (item.primary) {
            return (
              <li key={item.href} className="flex justify-center">
                <Link
                  href={item.href}
                  className="-mt-5 flex flex-col items-center gap-1"
                  aria-current={active ? "page" : undefined}
                >
                  <span className="grid size-14 place-items-center rounded-full bg-brand-800 text-white shadow-lg ring-4 ring-surface transition-transform active:scale-95">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="text-[0.6875rem] font-semibold text-brand-800">{item.label}</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors",
                  active ? "text-brand-800" : "text-fg-subtle"
                )}
              >
                <Icon className={cn("size-[22px]", active && "stroke-[2.25]")} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
