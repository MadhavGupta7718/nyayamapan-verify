import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { FilePlus2, FileText } from "lucide-react";
import { ApplicationStatus, type Prisma, type Role } from "@prisma/client";
import { prisma } from "@/db/client";
import { Link } from "@/i18n/routing";
import { guard } from "@/server/access";
import { applicationScope } from "@/server/scope";
import { INACTIVE_ASSIGNMENT } from "@/server/verification-access";
import { APPLICATION_STAGE_GROUPS } from "@/lib/status";
import { pageMeta, parseListParams, type RawSearchParams } from "@/lib/list-params";
import { formatDate, formatRelative } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { DataTable, type Column } from "@/components/data/data-table";
import { Pagination } from "@/components/data/pagination";
import { TableToolbar } from "@/components/data/table-toolbar";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("applications") };
}

const VIEWS = {
  all: null,
  needsReview: APPLICATION_STAGE_GROUPS.needsReview,
  readyToSchedule: APPLICATION_STAGE_GROUPS.readyToSchedule,
  inField: APPLICATION_STAGE_GROUPS.inField,
  certification: APPLICATION_STAGE_GROUPS.certification,
  completed: APPLICATION_STAGE_GROUPS.completed,
  actionRequired: APPLICATION_STAGE_GROUPS.actionRequired,
  closed: APPLICATION_STAGE_GROUPS.closed,
  open: [
    ...APPLICATION_STAGE_GROUPS.needsReview,
    ...APPLICATION_STAGE_GROUPS.readyToSchedule,
    ...APPLICATION_STAGE_GROUPS.inField,
    ...APPLICATION_STAGE_GROUPS.certification,
  ],
} as const;
type View = keyof typeof VIEWS;

/** Field officers only ever see their own work, so the column would just repeat their name. */
const OFFICER_COLUMN_ROLES: Role[] = ["SUPER_ADMIN", "STATE_ADMIN", "GATC_ADMIN", "AUDITOR", "BUSINESS_USER"];

const SORTS = {
  updatedAt: (dir: Prisma.SortOrder) => ({ updatedAt: dir }),
  createdAt: (dir: Prisma.SortOrder) => ({ createdAt: dir }),
  applicationNumber: (dir: Prisma.SortOrder) => ({ applicationNumber: dir }),
  status: (dir: Prisma.SortOrder) => ({ status: dir }),
} satisfies Record<string, (d: Prisma.SortOrder) => Prisma.ApplicationOrderByWithRelationInput>;

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { user, denied } = await guard("applications");
  if (denied) return denied;
  const [t, ts, locale, sp] = await Promise.all([getTranslations("applications"), getTranslations("status"), getLocale(), searchParams]);
  const params = parseListParams(sp, { defaultSort: "updatedAt", sortable: Object.keys(SORTS) });
  const view = (params.get("view") && params.get("view")! in VIEWS ? params.get("view") : "all") as View;
  const statusFilter = params.get("status");
  const typeFilter = params.get("type");

  const showOfficer = OFFICER_COLUMN_ROLES.includes(user.role);
  const scope = applicationScope(user);
  const where: Prisma.ApplicationWhereInput = {
    AND: [
      scope,
      VIEWS[view] ? { status: { in: VIEWS[view] as unknown as ApplicationStatus[] } } : {},
      statusFilter ? { status: statusFilter as ApplicationStatus } : {},
      typeFilter ? { verificationType: typeFilter as Prisma.EnumVerificationTypeFilter["equals"] } : {},
      params.q
        ? {
            OR: [
              { applicationNumber: { contains: params.q, mode: "insensitive" } },
              { organization: { name: { contains: params.q, mode: "insensitive" } } },
              { instrument: { serialNumber: { contains: params.q, mode: "insensitive" } } },
              { instrument: { instrumentCode: { contains: params.q, mode: "insensitive" } } },
              ...(showOfficer
                ? [{ assignments: { some: { status: { notIn: INACTIVE_ASSIGNMENT }, officer: { name: { contains: params.q, mode: "insensitive" as const } } } } }]
                : []),
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
    orderBy: [SORTS[params.sort as keyof typeof SORTS](params.dir), { id: "asc" }],
    skip: meta.skip,
    take: params.pageSize,
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      verificationType: true,
      updatedAt: true,
      createdAt: true,
      organization: { select: { name: true } },
      instrument: { select: { serialNumber: true, instrumentCode: true, instrumentType: { select: { name: true, nameHi: true } }, state: { select: { code: true } } } },
      schedules: { where: { status: "SCHEDULED" }, orderBy: { scheduledDate: "asc" }, take: 1, select: { scheduledDate: true } },
      assignments: {
        where: { status: { notIn: INACTIVE_ASSIGNMENT } },
        orderBy: { assignedAt: "desc" },
        take: 1,
        select: { authorityType: true, officer: { select: { name: true } }, gatc: { select: { name: true } } },
      },
    },
  });
  type Row = (typeof rows)[number];

  const countOf = (list: readonly string[] | null) =>
    grouped.filter((g) => !list || list.includes(g.status)).reduce((a, g) => a + g._count._all, 0);
  const tabKeys: View[] =
    user.role === "BUSINESS_USER"
      ? ["all", "open", "actionRequired", "completed", "closed"]
      : ["all", "needsReview", "readyToSchedule", "inField", "certification", "completed", "actionRequired", "closed"];
  const isBusiness = user.role === "BUSINESS_USER";
  const typeName = (r: Row) => (locale === "hi" && r.instrument.instrumentType.nameHi ? r.instrument.instrumentType.nameHi : r.instrument.instrumentType.name);
  const officerOf = (r: Row) => {
    const a = r.assignments[0];
    if (!a) return null;
    if (a.officer) return { name: a.officer.name, sub: a.authorityType === "GATC" ? a.gatc?.name ?? t("officer.gatc") : t("officer.lmo") };
    return { name: a.gatc?.name ?? t("officer.gatc"), sub: t("officer.pending") };
  };
  const officerCell = (r: Row, compact = false) => {
    const o = officerOf(r);
    if (!o) return <span className="text-fg-faint">{compact ? t("officer.none") : "—"}</span>;
    return compact ? (
      <span className="block truncate text-caption text-fg-muted">
        {t("officer.label")}: {o.name}
      </span>
    ) : (
      <span className="block max-w-[14rem]">
        <span className="block truncate text-fg">{o.name}</span>
        <span className="block truncate text-caption text-fg-subtle">{o.sub}</span>
      </span>
    );
  };

  const columns: Column<Row>[] = [
    {
      key: "applicationNumber",
      header: t("col.number"),
      sortable: true,
      cell: (r) => <span className="whitespace-nowrap font-mono text-[0.8125rem]">{r.applicationNumber}</span>,
    },
    ...(isBusiness
      ? []
      : [
          {
            key: "organization",
            header: t("col.applicant"),
            cell: (r: Row) => <span className="block max-w-[16rem] truncate">{r.organization.name}</span>,
          },
        ]),
    {
      key: "instrument",
      header: t("col.instrument"),
      cell: (r) => (
        <span className="block max-w-[18rem]">
          <span className="block truncate text-fg">{typeName(r)}</span>
          <span className="block truncate font-mono text-caption text-fg-subtle">{r.instrument.serialNumber}</span>
          {showOfficer ? <span className="block text-caption md:hidden">{officerCell(r, true)}</span> : null}
        </span>
      ),
    },
    ...(showOfficer ? [{ key: "officer", header: t("col.officer"), minBreakpoint: "md" as const, cell: (r: Row) => officerCell(r) }] : []),
    { key: "type", header: t("col.type"), minBreakpoint: "lg", cell: (r) => <span className="text-fg-muted">{t(`types.${r.verificationType}`)}</span> },
    {
      key: "visit",
      header: t("col.visit"),
      minBreakpoint: "xl",
      cell: (r) => (r.schedules[0] ? formatDate(r.schedules[0].scheduledDate, locale) : <span className="text-fg-faint">—</span>),
    },
    { key: "status", header: t("col.status"), sortable: true, cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "updatedAt",
      header: t("col.updated"),
      sortable: true,
      align: "right",
      minBreakpoint: "md",
      cell: (r) => (
        <time dateTime={r.updatedAt.toISOString()} title={formatDate(r.updatedAt, locale)} className="whitespace-nowrap text-fg-muted">
          {formatRelative(r.updatedAt, locale)}
        </time>
      ),
    },
  ];

  const present = new Set(grouped.map((g) => g.status));
  const statusOptions = Object.values(ApplicationStatus)
    .filter((s) => present.has(s))
    .map((s) => ({ value: s, label: ts(`${s}.label`) }));

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t(isBusiness ? "descBusiness" : "desc")}
        actions={
          isBusiness ? (
            <Link href="/applications/new" className={buttonVariants()}>
              <FilePlus2 /> {t("new")}
            </Link>
          ) : null
        }
      />
      <TableToolbar
        tableId="applications-table"
        searchPlaceholder={t("search")}
        tabs={tabKeys.map((k) => ({ value: k, label: t(`tabs.${k}`), count: countOf(VIEWS[k] as readonly string[] | null) }))}
        filters={[
          { key: "status", label: t("filters.status"), options: statusOptions },
          {
            key: "type",
            label: t("filters.type"),
            options: ["INITIAL_VERIFICATION", "RE_VERIFICATION", "OTHER_APPLICABLE"].map((v) => ({ value: v, label: t(`types.${v}`) })),
          },
        ]}
        columns={columns.filter((c) => c.key !== "applicationNumber").map((c) => ({ key: c.key, label: String(c.header) }))}
      />
      <DataTable
        id="applications-table"
        caption={t("title")}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/applications/${r.id}`}
        path="/applications"
        params={params.raw}
        sort={params.sort}
        dir={params.dir}
        empty={
          <EmptyState
            icon={FileText}
            title={params.q || statusFilter || typeFilter || view !== "all" ? t("emptyFilteredTitle") : t("emptyTitle")}
            description={params.q || statusFilter || typeFilter || view !== "all" ? t("emptyFilteredDesc") : t(isBusiness ? "emptyDescBusiness" : "emptyDesc")}
            action={
              isBusiness ? (
                <Link href="/applications/new" className={buttonVariants()}>
                  <FilePlus2 /> {t("new")}
                </Link>
              ) : undefined
            }
          />
        }
      />
      {total > 0 ? <Pagination path="/applications" params={params.raw} meta={meta} locale={locale} /> : null}
    </>
  );
}
