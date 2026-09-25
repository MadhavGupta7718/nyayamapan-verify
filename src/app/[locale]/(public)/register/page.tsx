import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Info } from "lucide-react";
import { prisma } from "@/db/client";
import { Link } from "@/i18n/routing";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import { RegisterForm } from "@/components/public/register-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("register"))("title") };
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, states] = await Promise.all([
    getTranslations("register"),
    prisma.state.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameHi: true, districts: { where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, nameHi: true } } },
    }),
  ]);
  const label = (x: { name: string; nameHi: string | null }) => (locale === "hi" && x.nameHi ? x.nameHi : x.name);

  return (
    <>
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="mt-1 text-body text-fg-muted">{t("subtitle")}</p>
        <p className="mt-4 flex gap-2 rounded-lg bg-info-50 px-4 py-3 text-body-sm text-info-800 ring-1 ring-inset ring-info-200">
          <Info className="mt-0.5 size-4 shrink-0" /> {t("notice")}
        </p>
        <div className="mt-6 rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line sm:p-8">
          <RegisterForm states={states.map((s) => ({ id: s.id, label: label(s), districts: s.districts.map((d) => ({ id: d.id, label: label(d) })) }))} />
        </div>
        <p className="mt-6 text-center text-body-sm text-fg-muted">
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-900">
            {t("signIn")}
          </Link>
        </p>
      </main>
      <PublicFooter />
    </>
  );
}
