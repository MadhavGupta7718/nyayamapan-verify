import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Plus, Scale } from "lucide-react";
import { prisma } from "@/db/client";
import { Link } from "@/i18n/routing";
import { requireUser, Forbidden } from "@/server/access";
import { instrumentScope } from "@/server/scope";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { buttonVariants } from "@/components/ui/button";
import { ApplicationForm } from "@/components/applications/application-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("applyForm"))("title") };
}

const CLOSED = ["ACTIVE", "REJECTED", "CANCELLED", "EXPIRED", "REVOKED", "FAIL"] as const;

export default async function NewApplicationPage({ searchParams }: { searchParams: Promise<{ instrument?: string; type?: string }> }) {
  const user = await requireUser();
  if (!["BUSINESS_USER", "SUPER_ADMIN", "STATE_ADMIN"].includes(user.role)) return Forbidden();
  const [t, locale, sp] = await Promise.all([getTranslations("applyForm"), getLocale(), searchParams]);

  const instruments = await prisma.instrument.findMany({
    where: instrumentScope(user),
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      instrumentCode: true,
      serialNumber: true,
      manufacturer: true,
      modelName: true,
      locationLabel: true,
      nextDueDate: true,
      verificationStatus: true,
      organization: { select: { name: true } },
      instrumentType: { select: { name: true, nameHi: true, requiredDocuments: true } },
      applications: { where: { status: { notIn: [...CLOSED] } }, take: 1, select: { id: true, applicationNumber: true } },
    },
  });

  return (
    <>
      <PageHeader title={t("title")} description={t("desc")} />
      {instruments.length === 0 ? (
        <Card>
          <EmptyState
            icon={Scale}
            title={t("noInstrumentsTitle")}
            description={t("noInstrumentsDesc")}
            action={
              <Link href="/instruments/new" className={buttonVariants()}>
                <Plus /> {t("registerInstrument")}
              </Link>
            }
          />
        </Card>
      ) : (
        <ApplicationForm
          locale={locale}
          initialInstrumentId={sp.instrument}
          initialType={sp.type === "RE_VERIFICATION" || sp.type === "INITIAL_VERIFICATION" ? sp.type : undefined}
          instruments={instruments.map((i) => ({
            id: i.id,
            code: i.instrumentCode,
            serial: i.serialNumber,
            label: `${locale === "hi" && i.instrumentType.nameHi ? i.instrumentType.nameHi : i.instrumentType.name}`,
            maker: `${i.manufacturer} ${i.modelName}`,
            location: i.locationLabel ?? "",
            organization: user.role === "BUSINESS_USER" ? null : i.organization.name,
            status: i.verificationStatus,
            dueDate: i.nextDueDate?.toISOString() ?? null,
            requiredDocuments: Array.isArray(i.instrumentType.requiredDocuments) ? (i.instrumentType.requiredDocuments as string[]) : [],
            openApplication: i.applications[0] ?? null,
          }))}
        />
      )}
    </>
  );
}
