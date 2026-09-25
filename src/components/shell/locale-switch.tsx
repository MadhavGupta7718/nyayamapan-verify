"use client";

import { useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LocaleSwitch({ variant = "default", className }: { variant?: "default" | "inverse"; className?: string }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const next = locale === "en" ? "hi" : "en";
  const qs = sp.toString();

  return (
    <button
      type="button"
      onClick={() => start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { locale: next, scroll: false }))}
      aria-label={t("switchLanguage")}
      lang={next}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-body-sm font-medium transition-colors disabled:opacity-60",
        variant === "inverse" ? "text-white/90 hover:bg-white/10" : "text-fg-muted hover:bg-ink-100 hover:text-fg",
        className
      )}
      disabled={pending}
    >
      <Languages className="size-4" aria-hidden />
      <span>{next === "hi" ? "हिन्दी" : "English"}</span>
    </button>
  );
}
