import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Award, CalendarCheck2, ClipboardCheck, FileStack, MapPinned, QrCode, ShieldCheck, Smartphone, Stamp } from "lucide-react";
import { Link } from "@/i18n/routing";
import { platformConfig } from "@/server/config";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import { CertificateLookup } from "@/components/public/certificate-lookup";

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");

  const steps = [
    { icon: FileStack, key: "apply" },
    { icon: CalendarCheck2, key: "schedule" },
    { icon: ClipboardCheck, key: "inspect" },
    { icon: Award, key: "certify" },
  ];
  const audiences = [
    { icon: FileStack, key: "business" },
    { icon: Smartphone, key: "officers" },
    { icon: QrCode, key: "public" },
  ];

  return (
    <>
      <div className="relative overflow-hidden bg-brand-950">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_-10%,rgba(74,105,177,0.45),transparent),radial-gradient(40rem_24rem_at_-10%_110%,rgba(217,115,31,0.18),transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
        <PublicHeader tone="dark" />
        <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-16">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-caption font-medium text-brand-100 ring-1 ring-inset ring-white/15">
              <ShieldCheck className="size-3.5" /> {platformConfig.issuingAuthority}
            </p>
            <h1 className="mt-5 text-[2.25rem] font-semibold leading-[1.1] tracking-tight text-white sm:text-display">{t("hero.title")}</h1>
            <p className="mt-5 max-w-xl text-body text-brand-100/90 sm:text-[1.0625rem] sm:leading-7">{t("hero.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className={buttonVariants({ variant: "inverse", size: "lg" })}>
                {t("hero.primary")} <ArrowRight />
              </Link>
              <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "bg-white/10 ring-1 ring-inset ring-white/20 hover:bg-white/15")}>
                {t("hero.secondary")}
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md [perspective:1400px]" aria-hidden>
            <div className="absolute -inset-8 rounded-[2rem] bg-brand-500/20 blur-3xl" />
            <div className="relative animate-float [transform-style:preserve-3d]">
              <div className="absolute inset-0 translate-x-5 translate-y-5 rounded-2xl bg-white/10 ring-1 ring-white/10 [transform:translateZ(-60px)]" />
              <div className="relative overflow-hidden rounded-2xl bg-white shadow-overlay">
                <div className="h-1.5 bg-gradient-to-r from-brand-800 via-brand-600 to-accent" />
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-overline uppercase text-fg-subtle">{t("card.eyebrow")}</p>
                      <p className="mt-1 text-h3 text-fg">{t("card.title")}</p>
                    </div>
                    <div className="grid size-16 grid-cols-5 gap-0.5 rounded-md border border-line p-1.5">
                      {Array.from({ length: 25 }, (_, i) => (
                        <span key={i} className={(i * 7 + (i % 3)) % 5 < 2 ? "rounded-[1px] bg-brand-900" : ""} />
                      ))}
                    </div>
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-4 text-body-sm">
                    {(["type", "serial", "verified", "valid"] as const).map((k) => (
                      <div key={k}>
                        <dt className="text-caption text-fg-subtle">{t(`card.${k}`)}</dt>
                        <dd className="mt-0.5 h-3 w-24 rounded bg-ink-100" />
                      </div>
                    ))}
                  </dl>
                  <div className="mt-6 flex items-center justify-between rounded-lg bg-success-50 px-3 py-2.5 ring-1 ring-inset ring-success-200">
                    <span className="flex items-center gap-2 text-body-sm font-semibold text-success-800">
                      <ShieldCheck className="size-4" /> {t("card.status")}
                    </span>
                    <Stamp className="size-5 text-success-700" />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-6 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-lg ring-1 ring-line [transform:translateZ(40px)]">
                <MapPinned className="size-4 text-brand-700" />
                <span className="text-caption font-medium text-fg">{t("card.gps")}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <main className="flex-1">
        <section className="relative z-10 mx-auto -mt-10 max-w-3xl px-4 sm:px-6">
          <div className="rounded-2xl bg-surface p-5 shadow-lg ring-1 ring-line sm:p-6">
            <h2 className="text-h3 text-fg">{t("verify.title")}</h2>
            <p className="mb-4 mt-1 text-body-sm text-fg-muted">{t("verify.desc")}</p>
            <CertificateLookup />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-h1 text-fg">{t("how.title")}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-body text-fg-muted">{t("how.desc")}</p>
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ icon: Icon, key }, i) => (
              <li key={key} className="relative rounded-xl border border-line bg-surface p-5 shadow-xs">
                <span className="absolute right-4 top-4 text-caption font-semibold text-fg-faint tabular">0{i + 1}</span>
                <span className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-h4 text-fg">{t(`how.${key}.title`)}</h3>
                <p className="mt-1 text-body-sm text-fg-muted">{t(`how.${key}.desc`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-3">
            {audiences.map(({ icon: Icon, key }) => (
              <div key={key}>
                <Icon className="size-6 text-accent-strong" />
                <h3 className="mt-3 text-h3 text-fg">{t(`who.${key}.title`)}</h3>
                <p className="mt-1.5 text-body-sm text-fg-muted">{t(`who.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-brand-900 px-6 py-8 text-white sm:flex-row sm:items-center sm:px-10">
            <div>
              <h2 className="text-h2">{t("cta.title")}</h2>
              <p className="mt-1 text-body text-brand-100/90">{t("cta.desc")}</p>
            </div>
            <Link href="/register" className={buttonVariants({ variant: "inverse", size: "lg" })}>
              {t("cta.button")} <ArrowRight />
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
