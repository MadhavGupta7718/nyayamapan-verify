import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getSessionUser } from "@/server/session";
import { platformConfig, quickAccessPassword } from "@/server/config";
import { PublicHeader } from "@/components/public/public-shell";
import { LoginForm, type QuickAccount } from "@/components/public/login-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("login"))("title") };
}

const QUICK: [string, string][] = [
  ["super.admin@nyayamapan.in", "SUPER_ADMIN"],
  ["lmo.delhi@nyayamapan.in", "STATE_ADMIN"],
  ["vikram.lmo.newdelhi@nyayamapan.in", "LMO"],
  ["farhan.inspector.delhi@nyayamapan.in", "INSPECTOR"],
  ["gatc.delhi@nyayamapan.in", "GATC_ADMIN"],
  ["rohit.gatc.newdelhi@nyayamapan.in", "GATC_OFFICER"],
  ["ramesh.business@nyayamapan.in", "BUSINESS_USER"],
  ["auditor@nyayamapan.in", "AUDITOR"],
];

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ callbackUrl?: string }> }) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  if (await getSessionUser()) redirect(`/${locale}/dashboard`);
  const [t, tr] = await Promise.all([getTranslations("login"), getTranslations("roles")]);
  const pw = quickAccessPassword();
  const quick: QuickAccount[] = pw ? QUICK.map(([email, role]) => ({ email, role, label: tr(role) })) : [];

  return (
    <>
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl bg-surface shadow-lg ring-1 ring-line md:grid-cols-[1fr_1.1fr]">
          <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-950 p-8 text-white md:flex">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(30rem_20rem_at_100%_0%,rgba(74,105,177,0.5),transparent)]" />
            <div className="relative">
              <ShieldCheck className="size-8 text-brand-200" />
              <h2 className="mt-4 text-h2">{t("aside.title")}</h2>
              <p className="mt-2 text-body-sm text-brand-100/85">{t("aside.desc")}</p>
            </div>
            <ul className="relative space-y-2 text-body-sm text-brand-100/90">
              {(["one", "two", "three"] as const).map((k) => (
                <li key={k} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" /> {t(`aside.${k}`)}
                </li>
              ))}
            </ul>
            <p className="relative text-caption text-brand-200/80">{platformConfig.issuingAuthority}</p>
          </aside>
          <div className="p-6 sm:p-8">
            <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-fg-subtle hover:text-fg">
              <ArrowLeft className="size-4" aria-hidden /> {t("backHome")}
            </Link>
            <h1 className="text-h1 text-fg">{t("title")}</h1>
            <p className="mb-6 mt-1 text-body-sm text-fg-muted">{t("subtitle")}</p>
            <LoginForm callbackUrl={sp.callbackUrl ?? null} quick={quick} quickPassword={pw} />
            <p className="mt-6 text-center text-body-sm text-fg-muted">
              {t("noAccount")}{" "}
              <Link href="/register" className="font-medium text-brand-700 hover:text-brand-900">
                {t("register")}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
