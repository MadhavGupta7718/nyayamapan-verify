import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, CircleDashed, Server } from "lucide-react";
import { prisma } from "@/db/client";
import { Link } from "@/i18n/routing";
import { guard } from "@/server/access";
import { platformConfig } from "@/server/config";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ExpiryAlertSettings } from "@/components/profile/profile-forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("settings") };
}

const DEFAULT_ALERT_DAYS = [90, 60, 30, 15, 7, 1];

export default async function SettingsPage() {
  const { user, denied } = await guard("settings");
  if (denied) return denied;
  const t = await getTranslations("settings");
  const isSuper = user.role === "SUPER_ADMIN";
  const alertSetting = isSuper ? await prisma.systemSetting.findUnique({ where: { key: "expiry_alert_days" } }) : null;
  const alertDays = Array.isArray(alertSetting?.value) ? (alertSetting!.value as number[]) : DEFAULT_ALERT_DAYS;

  const integrations = [
    { key: "authority", ok: !!process.env.NEXT_PUBLIC_ISSUING_AUTHORITY, detail: platformConfig.issuingAuthority },
    { key: "signer", ok: process.env.DSC_MODE === "production", detail: t(process.env.DSC_MODE === "production" ? "integrations.signerDsc" : "integrations.signerPlatform") },
    { key: "storage", ok: !!process.env.BLOB_READ_WRITE_TOKEN, detail: t(process.env.BLOB_READ_WRITE_TOKEN ? "integrations.storageBlob" : "integrations.storageLocal") },
    { key: "email", ok: !!process.env.EMAIL_API_KEY, detail: t(process.env.EMAIL_API_KEY ? "integrations.emailOn" : "integrations.emailOff") },
    { key: "payment", ok: process.env.PAYMENT_MODE === "gateway", detail: t(process.env.PAYMENT_MODE === "gateway" ? "integrations.paymentOn" : "integrations.paymentOff") },
    { key: "cron", ok: !!process.env.CRON_SECRET, detail: t(process.env.CRON_SECRET ? "integrations.cronOn" : "integrations.cronOff") },
  ];

  return (
    <>
      <PageHeader title={t("title")} description={t(isSuper ? "descAdmin" : "desc")} />
      <div className="grid max-w-4xl gap-6">
        <Card>
          <CardHeader title={t("personal.title")} description={t("personal.desc")} action={<Link href="/profile" className={buttonVariants({ variant: "secondary", size: "sm" })}>{t("personal.open")}</Link>} />
        </Card>
        {isSuper ? (
          <>
            <ExpiryAlertSettings initial={alertDays} />
            <Card>
              <CardHeader icon={<Server />} title={t("integrations.title")} description={t("integrations.desc")} />
              <ul className="divide-y divide-line">
                {integrations.map((i) => (
                  <li key={i.key} className="flex items-start gap-3 px-5 py-3.5">
                    {i.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-600" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-warning-600" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-medium text-fg">{t(`integrations.${i.key}`)}</p>
                      <p className="text-caption text-fg-subtle">{i.detail}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-caption font-medium", i.ok ? "bg-success-50 text-success-800" : "bg-warning-50 text-warning-800")}>
                      {t(i.ok ? "integrations.configured" : "integrations.required")}
                    </span>
                  </li>
                ))}
              </ul>
              <CardBody className="border-t border-line">
                <p className="text-caption text-fg-subtle">{t("integrations.note")}</p>
              </CardBody>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
