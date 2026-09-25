import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { FilePlus2, Plus } from "lucide-react";
import { Link } from "@/i18n/routing";
import { requireUser } from "@/server/access";
import { isAdminRole, isFieldRole } from "@/lib/permissions";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton, StatsSkeleton } from "@/components/ui/loading";
import { formatDate } from "@/lib/utils";
import {
  ActivityFeed,
  AdminAlerts,
  AdminKpis,
  BusinessActionRequired,
  BusinessKpis,
  BusinessRecent,
  CertificateHealth,
  FieldKpis,
  FieldToday,
  FieldUpcoming,
  GeographyPanel,
  PipelineFunnel,
  UpcomingVisits,
  VolumeTrend,
  WorkloadPanel,
} from "./sections";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("overview") };
}

function greetingKey() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [t, tr, locale] = await Promise.all([getTranslations("dashboard"), getTranslations("roles"), getLocale()]);
  const firstName = user.name.split(" ")[0];

  const header = (
    <PageHeader
      eyebrow={formatDate(new Date(), locale)}
      title={t(`greeting.${greetingKey()}`, { name: firstName })}
      description={t(`intro.${isAdminRole(user.role) || user.role === "GATC_ADMIN" ? "admin" : isFieldRole(user.role) ? "field" : "business"}`)}
      meta={<Badge tone="brand">{tr(user.role)}</Badge>}
      actions={
        user.role === "BUSINESS_USER" ? (
          <>
            <Link href="/instruments/new" className={buttonVariants({ variant: "secondary" })}>
              <Plus /> {t("actions.registerInstrument")}
            </Link>
            <Link href="/applications/new" className={buttonVariants()}>
              <FilePlus2 /> {t("actions.newApplication")}
            </Link>
          </>
        ) : isFieldRole(user.role) ? (
          <Link href="/verification" className={buttonVariants()}>
            {t("actions.openAssignments")}
          </Link>
        ) : null
      }
    />
  );

  if (user.role === "BUSINESS_USER") {
    return (
      <div className="space-y-6">
        {header}
        <Suspense fallback={<StatsSkeleton />}>
          <BusinessKpis user={user} />
        </Suspense>
        <div className="grid gap-4 lg:grid-cols-5">
          <Suspense fallback={<CardSkeleton lines={5} className="lg:col-span-3" />}>
            <BusinessActionRequired user={user} className="lg:col-span-3" />
          </Suspense>
          <Suspense fallback={<CardSkeleton lines={5} className="lg:col-span-2" />}>
            <UpcomingVisits user={user} className="lg:col-span-2" />
          </Suspense>
        </div>
        <Suspense fallback={<CardSkeleton lines={6} />}>
          <BusinessRecent user={user} />
        </Suspense>
      </div>
    );
  }

  if (isFieldRole(user.role)) {
    return (
      <div className="space-y-6">
        {header}
        <Suspense fallback={<StatsSkeleton />}>
          <FieldKpis user={user} />
        </Suspense>
        <div className="grid gap-4 lg:grid-cols-5">
          <Suspense fallback={<CardSkeleton lines={6} className="lg:col-span-3" />}>
            <FieldToday user={user} className="lg:col-span-3" />
          </Suspense>
          <Suspense fallback={<CardSkeleton lines={6} className="lg:col-span-2" />}>
            <FieldUpcoming user={user} className="lg:col-span-2" />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <Suspense fallback={<StatsSkeleton count={6} />}>
        <AdminKpis user={user} />
      </Suspense>
      <div className="grid gap-4 xl:grid-cols-3">
        <Suspense fallback={<CardSkeleton lines={7} className="xl:col-span-2" />}>
          <PipelineFunnel user={user} className="xl:col-span-2" />
        </Suspense>
        <Suspense fallback={<CardSkeleton lines={7} />}>
          <AdminAlerts user={user} />
        </Suspense>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Suspense fallback={<CardSkeleton lines={6} className="xl:col-span-2" />}>
          <VolumeTrend user={user} className="xl:col-span-2" />
        </Suspense>
        <Suspense fallback={<CardSkeleton lines={6} />}>
          <CertificateHealth user={user} />
        </Suspense>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton lines={6} />}>
          <WorkloadPanel user={user} />
        </Suspense>
        <Suspense fallback={<CardSkeleton lines={6} />}>
          <GeographyPanel user={user} />
        </Suspense>
      </div>
      <Suspense fallback={<CardSkeleton lines={6} />}>
        <ActivityFeed user={user} />
      </Suspense>
    </div>
  );
}
