"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Search } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QrScanButton } from "./qr-scanner";

export function CertificateLookup({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const t = useTranslations("verify.lookup");
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = value.trim().toUpperCase();
    if (!/^[A-Z0-9-]{6,40}$/.test(n)) {
      setError(t("invalid"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ token: string }>(`/api/public/lookup?number=${encodeURIComponent(n)}`);
      router.push(`/verify/${r.token}`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "SERVER_ERROR";
      setError(code === "NOT_FOUND" ? t("notFound") : code === "RATE_LIMITED" ? t("rateLimited") : code === "OFFLINE" || code === "NETWORK" ? t("network") : t("error"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={cn("w-full", className)} noValidate>
      <label htmlFor="cert-lookup" className="sr-only">
        {t("label")}
      </label>
      <div className={cn("flex gap-2 rounded-xl bg-surface p-1.5 shadow-md ring-1 ring-line", size === "lg" && "p-2")}>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-faint" aria-hidden />
          <input
            id="cert-lookup"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("placeholder")}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? "cert-lookup-error" : undefined}
            className={cn("h-11 w-full rounded-lg bg-transparent pl-9 pr-3 font-mono text-body uppercase tracking-wide text-fg placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-fg-faint focus:outline-none", size === "lg" && "h-12")}
          />
        </div>
        <Button type="submit" loading={busy} size={size === "lg" ? "lg" : "md"} className={size === "lg" ? "h-12" : "h-11"}>
          {t("submit")} <ArrowRight />
        </Button>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        {error ? (
          <p id="cert-lookup-error" role="alert" className="text-body-sm font-medium text-danger-700">
            {error}
          </p>
        ) : (
          <p className="text-caption text-fg-subtle">{t("hint")}</p>
        )}
        <QrScanButton size="md" className="shrink-0 self-start" />
      </div>
    </form>
  );
}
