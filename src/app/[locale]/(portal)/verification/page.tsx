import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, ClipboardCheck, MapPin } from "lucide-react";
import type { ApplicationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { Link } from "@/i18n/routing";
import { guard } from "@/server/access";
import { applicationScope } from "@/server/scope";
import { pageMeta, parseListParams, type RawSearchParams } from "@/lib/list-params";
import { cn, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/data/pagination";
import { TableToolbar } from "@/components/data/table-toolbar";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("verification") };
}

const VIEWS: Record<string, ApplicationStatus[]> = {
  assigned: ["ASSIGNED", "SCHEDULED"],
  inProgress: ["FIELD_VERIFICATION", "INSPECTION_COMPLETED", "PASS", "STAMPING"],
  history: ["CERTIFICATE_ISSUED", "ACTIVE", "FAIL", "EXPIRED", "REVOKED", "SUSPENDED"],
};

export default async function VerificationPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { user, denied } = await guard("verification");
  if (denied) return denied;
  const [t, locale, sp] = await Promise.all([getTranslations("verification"), getLocale(), searchParams]);
  const params = parseListParams(sp, { defaultSort: "date", sortable: ["date"], defaultDir: "asc" });
  const view = params.get("view") && params.get("view")! in VIEWS ? params.get("view")! : "assigned";
  const scope = applicationScope(user);

  const where: Prisma.ApplicationWhereInput = {
    AND: [
      scope,
      { status: { in: VIEWS[view] } },
      params.q
        ? {
            OR: [
              { applicationNumber: { contains: params.q, mode: "insensitive" } },
              { organization: { name: { contains: params.q, mode: "insensitive" } } },
              { instrument: { serialNumber: { contains: params.q, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };
  const [total, grouped] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
  ]);
  const meta = pageMeta(total, params.page, params.pageSize);
  const rows = await prisma.application.findMany({
    where,
    orderBy: view === "history" ? { updatedAt: "desc" } : { updatedAt: "asc" },
    skip: meta.skip,
    take: params.pageSize,
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      updatedAt: true,
      organization: { select: { name: true } },
      instrument: {
        select: {
          serialNumber: true,
          address: true,
          locationLabel: true,
          latitude: true,
          longitude: true,
          instrumentType: { select: { name: true, nameHi: true } },
          district: { select: { name: true } },
        },
      },
      schedules: { orderBy: { scheduledDate: "desc" }, take: 1, select: { scheduledDate: true, timeSlot: true } },
    },
  });
  const count = (list: ApplicationStatus[]) => grouped.filter((g) => list.includes(g.status)).reduce((a, g) => a + g._count._all, 0);
  const today = new Date().toDateString();

  return (
    <>
      <PageHeader title={t("title")} description={t("desc")} />
      <TableToolbar
        searchPlaceholder={t("search")}
        tabs={Object.keys(VIEWS).map((k) => ({ value: k, label: t(`tabs.${k}`), count: count(VIEWS[k]) }))}
      />
      {rows.length ? (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((r) => {
            const s = r.schedules[0];
            const isToday = s && s.scheduledDate.toDateString() === today;
            const inst = r.instrument;
            return (
              <li key={r.id}>
                <Card className={cn("flex h-full flex-col transition-shadow hover:shadow-md", isToday && "ring-1 ring-brand-300")}>
                  <div className="flex items-start justify-between gap-3 px-4 pt-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{r.organization.name}</p>
                      <p className="font-mono text-caption text-fg-subtle">{r.applicationNumber}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <dl className="grid flex-1 grid-cols-2 gap-3 px-4 py-3 text-body-sm">
                    <div>
                      <dt className="text-caption text-fg-subtle">{t("instrument")}</dt>
                      <dd className="truncate text-fg">{locale === "hi" && inst.instrumentType.nameHi ? inst.instrumentType.nameHi : inst.instrumentType.name}</dd>
                    </div>
                    <div>
                      <dt className="text-caption text-fg-subtle">{t("visit")}</dt>
                      <dd className={cn("text-fg", isToday && "font-semibold text-brand-800")}>
                        {s ? `${isToday ? t("today") : formatDate(s.scheduledDate, locale)} · ${s.timeSlot ?? ""}` : "—"}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-caption text-fg-subtle">{t("site")}</dt>
                      <dd className="truncate text-fg-muted">{[inst.locationLabel, inst.address, inst.district?.name].filter(Boolean).join(", ")}</dd>
                    </div>
                  </dl>
                  <div className="flex gap-2 border-t border-line px-4 py-3">
                    {inst.latitude != null ? (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${inst.latitude}&mlon=${inst.longitude}#map=17/${inst.latitude}/${inst.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                      >
                        <MapPin /> {t("navigate")}
                      </a>
                    ) : null}
                    <Link href={view === "history" ? `/applications/${r.id}` : `/verification/${r.id}`} className={cn(buttonVariants({ size: "sm", variant: view === "history" ? "secondary" : "primary" }), "ml-auto")}>
                      {view === "history" ? t("viewRecord") : r.status === "ASSIGNED" ? t("start") : t("continue")}
                    </Link>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <EmptyState
            icon={view === "history" ? ClipboardCheck : CalendarDays}
            title={t(`empty.${view}.title`)}
            description={t(`empty.${view}.desc`)}
          />
        </Card>
      )}
      {total > 0 ? <Pagination path="/verification" params={params.raw} meta={meta} locale={locale} /> : null}
    </>
  );
}
