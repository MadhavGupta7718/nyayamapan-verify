import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { QrCode } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import { CertificateLookup } from "@/components/public/certificate-lookup";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("verify"))("title") };
}

export default async function VerifyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("verify");
  return (
    <>
      <PublicHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-14 sm:py-20">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <QrCode className="size-6" />
          </span>
          <h1 className="mt-4 text-h1 text-fg">{t("title")}</h1>
          <p className="mx-auto mt-2 max-w-md text-body text-fg-muted">{t("desc")}</p>
        </div>
        <CertificateLookup size="lg" className="mt-8" />
        <p className="mt-8 text-center text-body-sm text-fg-subtle">{t("scanHint")}</p>
      </main>
      <PublicFooter />
    </>
  );
}
