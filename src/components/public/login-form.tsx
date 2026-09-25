"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/states";

export type QuickAccount = { email: string; role: string; label: string };

function safeCallback(raw: string | null, locale: string) {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) return raw;
  return `/${locale}/dashboard`;
}

export function LoginForm({ callbackUrl, quick, quickPassword }: { callbackUrl: string | null; quick: QuickAccount[]; quickPassword: string | null }) {
  const t = useTranslations("login");
  const locale = useLocale();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function login(em: string, pw: string, key: string) {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.trim()) || !pw) {
      setError(t("errors.missing"));
      return;
    }
    setBusy(key);
    try {
      const res = await signIn("credentials", { email: em.trim().toLowerCase(), password: pw, redirect: false });
      if (!res || res.error) {
        setError(t("errors.invalid"));
        setBusy(null);
        return;
      }
      window.location.assign(safeCallback(callbackUrl, locale));
    } catch {
      setError(navigator.onLine ? t("errors.server") : t("errors.offline"));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void login(email, password, "form");
        }}
        className="space-y-4"
        noValidate
      >
        {error ? (
          <InlineAlert tone="danger" title={error}>
            {t("errors.hint")}
          </InlineAlert>
        ) : null}
        <Field id="login-email" label={t("email")} required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus inputMode="email" />
        </Field>
        <div>
          <Field id="login-password" label={t("password")} required>
            <Input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <button type="button" onClick={() => setShow((s) => !s)} className="mt-1.5 inline-flex items-center gap-1.5 text-caption font-medium text-brand-700 hover:text-brand-900">
            {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {show ? t("hidePassword") : t("showPassword")}
          </button>
        </div>
        <Button type="submit" block size="lg" loading={busy === "form"} disabled={!!busy}>
          <LogIn /> {t("submit")}
        </Button>
      </form>

      {quick.length && quickPassword ? (
        <div>
          <div className="relative my-2 text-center">
            <span className="absolute inset-x-0 top-1/2 h-px bg-line" aria-hidden />
            <span className="relative bg-surface px-3 text-caption font-medium uppercase tracking-wide text-fg-subtle">{t("quick.title")}</span>
          </div>
          <p className="mb-3 text-center text-caption text-fg-subtle">{t("quick.desc")}</p>
          <div className="grid grid-cols-2 gap-2">
            {quick.map((q) => (
              <button
                key={q.email}
                type="button"
                disabled={!!busy}
                onClick={() => login(q.email, quickPassword, q.email)}
                className="flex min-w-0 flex-col items-start rounded-lg border border-line px-3 py-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60"
              >
                <span className="block w-full truncate text-body-sm font-medium text-fg">{busy === q.email ? t("quick.signingIn") : q.label}</span>
                <span className="block w-full truncate text-caption text-fg-subtle">{q.email}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
