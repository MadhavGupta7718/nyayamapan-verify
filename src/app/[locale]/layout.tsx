import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Devanagari } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { routing } from "@/i18n/routing";
import "../globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const deva = IBM_Plex_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-deva",
  display: "swap",
  preload: false,
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: { default: `${t("brand")} — ${t("tagline")}`, template: `%s · ${t("brand")}` },
    description: t("subtitle"),
    manifest: "/manifest.json",
    applicationName: t("brand"),
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: "#111a33",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as "en" | "hi")) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${sans.variable} ${deva.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans">
        <NextIntlClientProvider messages={messages}>
          <TooltipProvider delayDuration={250} skipDelayDuration={150}>
            {children}
            <Toaster position="top-right" richColors closeButton toastOptions={{ duration: 4500 }} />
          </TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
