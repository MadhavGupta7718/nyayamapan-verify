import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { platformConfig } from "@/server/config";
import { PublicHeader } from "@/components/public/public-shell";
import { PublicVerifier } from "@/components/public/public-verifier";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("verify"))("resultTitle"), robots: { index: false, follow: false } };
}

export default async function VerifyTokenPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("verify");
  return (
    <>
      <PublicHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-14">
        <div className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line sm:p-8">
          <p className="text-center text-overline uppercase text-fg-subtle">{platformConfig.issuingAuthority}</p>
          <h1 className="mb-6 mt-1 text-center text-h3 text-fg">{t("resultTitle")}</h1>
          <PublicVerifier token={token} />
        </div>
      </main>
    </>
  );
}
