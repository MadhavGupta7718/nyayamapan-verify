import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Award } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { guard } from "@/server/access";
import { certificateScope } from "@/server/scope";
import { publicStatusOf } from "@/lib/certificate-status";
import { pageMeta, parseListParams, type RawSearchParams } from "@/lib/list-params";
import { cn, daysUntil, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { DataTable, type Column } from "@/components/data/data-table";
import { Pagination } from "@/components/data/pagination";
import { TableToolbar } from "@/components/data/table-toolbar";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("certificates") };
}

const DAY = 86_400_000;
const EXPIRING_WINDOW_DAYS = 90;

const SORTS = {
  verificationDate: (dir: Prisma.SortOrder) => ({ verificationDate: dir }),
  validUntil: (dir: Prisma.SortOrder) => ({ validUntil: { sort: dir, nulls: "last" as const } }),
  certificateNumber: (dir: Prisma.SortOrder) => ({ certificateNumber: dir }),
} satisfies Record<string, (d: Prisma.SortOrder) => Prisma.CertificateOrderByWithRelationInput>;

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { user, denied } = await guard("certificates");
  if (denied) return denied;
  const [t, locale, sp] = await Promise.all([getTranslations("certificates"), getLocale(), searchParams]);
  const params = parseListParams(sp, { defaultSort: "verificationDate", sortable: Object.keys(SORTS) });
  const now = new Date();
  const soon = new Date(now.getTime() + EXPIRING_WINDOW_DAYS * DAY);

  const VIEWS: Record<string, Prisma.CertificateWhereInput | null> = {
    all: null,
    valid: { status: "ACTIVE", OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
    expiring: { status: "ACTIVE", validUntil: { gte: now, lte: soon } },
    expired: { OR: [{ status: "EXPIRED" }, { status: "ACTIVE", validUntil: { lt: now } }] },
    suspended: { status: "SUSPENDED" },
    revoked: { status: "REVOKED" },
  };
  const view = params.get("view") && params.get("view")! in VIEWS ? params.get("view")! : "all";
  const scope = certificateScope(user);
  const isBusiness = user.role === "BUSINESS_USER";
  const where: Prisma.CertificateWhereInput = {
    AND: [
      scope,
      VIEWS[view] ?? {},
      params.q
        ? {
            OR: [
              { certificateNumber: { contains: params.q, mode: "insensitive" } },
              { instrument: { serialNumber: { contains: params.q, mode: "insensitive" } } },
              { application: { applicationNumber: { contains: params.q, mode: "insensitive" } } },
              ...(isBusiness ? [] : [{ application: { organization: { name: { contains: params.q, mode: "insensitive" as const } } } }]),
            ],
          }
        : {},
    ],
  };

  const keys = Object.keys(VIEWS);
  const [total, ...counts] = await Promise.all([
    prisma.certificate.count({ where }),
    ...keys.map((k) => prisma.certificate.count({ where: { AND: [scope, VIEWS[k] ?? {}] } })),
  ]);
  const meta = pageMeta(total, params.page, params.pageSize);
  const rows = await prisma.certificate.findMany({
    where,
    orderBy: [SORTS[params.sort as keyof typeof SORTS](params.dir), { id: "asc" }],
    skip: meta.skip,
    take: params.pageSize,
    select: {
      id: true,
      certificateNumber: true,
      status: true,
      verificationDate: true,
      validUntil: true,
      result: true,
      application: { select: { applicationNumber: true, organization: { select: { name: true } } } },
      instrument: { select: { serialNumber: true, instrumentType: { select: { name: true, nameHi: true } } } },
    },
  });
  type Row = (typeof rows)[number];

  const columns: Column<Row>[] = [
    { key: "certificateNumber", header: t("col.number"), sortable: true, cell: (r) => <span className="whitespace-nowrap font-mono text-[0.8125rem]">{r.certificateNumber}</span> },
    ...(isBusiness
      ? []
      : [{ key: "holder", header: t("col.holder"), cell: (r: Row) => <span className="block max-w-[15rem] truncate">{r.application.organization.name}</span> }]),
    {
      key: "instrument",
      header: t("col.instrument"),
      cell: (r) => (
        <span className="block max-w-[18rem]">
          <span className="block truncate text-fg">{locale === "hi" && r.instrument.instrumentType.nameHi ? r.instrument.instrumentType.nameHi : r.instrument.instrumentType.name}</span>
          <span className="block truncate font-mono text-caption text-fg-subtle">{r.instrument.serialNumber}</span>
        </span>
      ),
    },
    { key: "verificationDate", header: t("col.verified"), sortable: true, minBreakpoint: "lg", cell: (r) => <span className="whitespace-nowrap text-fg-muted">{formatDate(r.verificationDate, locale)}</span> },
    {
      key: "validUntil",
      header: t("col.validUntil"),
      sortable: true,
      cell: (r) => {
        if (!r.validUntil) return <span className="text-caption text-warning-700">{t("validityNotConfigured")}</span>;
        const d = daysUntil(r.validUntil) ?? 0;
        return (
          <span className="block whitespace-nowrap">
            <span className="block">{formatDate(r.validUntil, locale)}</span>
            {r.status === "ACTIVE" ? (
              <span className={cn("block text-caption", d < 0 ? "text-danger-700" : d <= EXPIRING_WINDOW_DAYS ? "text-warning-700" : "text-fg-subtle")}>
                {d < 0 ? t("expiredAgo", { days: -d }) : t("daysLeft", { days: d })}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: "status",
      header: t("col.status"),
      cell: (r) => {
        const s = publicStatusOf(r, now);
        const d = r.validUntil ? daysUntil(r.validUntil) ?? 0 : null;
        return <StatusBadge status={s === "VALID" && d !== null && d <= EXPIRING_WINDOW_DAYS ? "EXPIRING" : s} />;
      },
    },
  ];

  return (
    <>
      <PageHeader title={t("title")} description={t(isBusiness ? "descBusiness" : "desc")} />
      <TableToolbar
        tableId="certificates-table"
        searchPlaceholder={t(isBusiness ? "searchBusiness" : "search")}
        tabs={keys.map((k, i) => ({ value: k, label: t(`tabs.${k}`), count: counts[i] }))}
        columns={columns.filter((c) => c.key !== "certificateNumber").map((c) => ({ key: c.key, label: String(c.header) }))}
      />
      <DataTable
        id="certificates-table"
        caption={t("title")}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/certificates/${r.id}`}
        path="/certificates"
        params={params.raw}
        sort={params.sort}
        dir={params.dir}
        empty={
          <EmptyState
            icon={Award}
            title={params.q || view !== "all" ? t("emptyFilteredTitle") : t("emptyTitle")}
            description={params.q || view !== "all" ? t("emptyFilteredDesc") : t(isBusiness ? "emptyDescBusiness" : "emptyDesc")}
          />
        }
      />
      {total > 0 ? <Pagination path="/certificates" params={params.raw} meta={meta} locale={locale} /> : null}
    </>
  );
}
