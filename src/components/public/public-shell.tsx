import * as React from "react";
import { getTranslations } from "next-intl/server";
import { LogIn, QrCode } from "lucide-react";
import { Link } from "@/i18n/routing";
import { platformConfig } from "@/server/config";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { BrandLockup } from "@/components/shell/brand";
import { LocaleSwitch } from "@/components/shell/locale-switch";

export async function PublicHeader({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [t, tb] = await Promise.all([getTranslations("public"), getTranslations()]);
  const dark = tone === "dark";
  return (
    <header className={cn("relative z-20", dark ? "text-white" : "border-b border-line bg-surface/90 backdrop-blur")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
          <BrandLockup name={tb("brand")} tagline={tb("tagline")} inverse={dark} />
        </Link>
        <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label={t("navLabel")}>
          <Link
            href="/verify"
            className={cn(
              "hidden h-9 items-center gap-1.5 rounded-md px-3 text-body-sm font-medium transition-colors sm:inline-flex",
              dark ? "text-white/90 hover:bg-white/10" : "text-fg-muted hover:bg-ink-100 hover:text-fg"
            )}
          >
            <QrCode className="size-4" /> {t("verify")}
          </Link>
          <React.Suspense fallback={<span className="inline-block h-9 w-20" />}>
            <LocaleSwitch variant={dark ? "inverse" : "default"} />
          </React.Suspense>
          <Link href="/login" className={buttonVariants({ variant: dark ? "inverse" : "primary", size: "md" })}>
            <LogIn /> <span className="hidden sm:inline">{t("signIn")}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export async function PublicFooter() {
  const [t, tb] = await Promise.all([getTranslations("public"), getTranslations()]);
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-body-sm sm:grid-cols-[1fr_auto] sm:px-6">
        <div>
          <p className="font-medium text-fg">{tb("brand")}</p>
          <p className="mt-1 max-w-xl text-caption text-fg-subtle">{t("footerNote", { authority: platformConfig.issuingAuthority })}</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-fg-muted" aria-label={t("footerNav")}>
          <Link href="/verify" className="hover:text-fg">
            {t("verify")}
          </Link>
          <Link href="/register" className="hover:text-fg">
            {t("register")}
          </Link>
          <Link href="/login" className="hover:text-fg">
            {t("signIn")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
