import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Plus, Scale } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { Link } from "@/i18n/routing";
import { guard } from "@/server/access";
import { instrumentScope } from "@/server/scope";
import { pageMeta, parseListParams, type RawSearchParams } from "@/lib/list-params";
import { cn, daysUntil, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { DataTable, type Column } from "@/components/data/data-table";
import { Pagination } from "@/components/data/pagination";
import { TableToolbar } from "@/components/data/table-toolbar";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("instruments") };
}

const VIEWS: Record<string, Prisma.InstrumentWhereInput | null> = {
  all: null,
  verified: { verificationStatus: "VERIFIED" },
  due: { verificationStatus: "EXPIRING_SOON" },
  expired: { verificationStatus: "EXPIRED" },
  pending: { verificationStatus: { in: ["PENDING", "REGISTERED"] } },
};

const SORTS = {
  createdAt: (d: Prisma.SortOrder) => ({ createdAt: d }),
  instrumentCode: (d: Prisma.SortOrder) => ({ instrumentCode: d }),
  nextDueDate: (d: Prisma.SortOrder) => ({ nextDueDate: { sort: d, nulls: "last" as const } }),
  manufacturer: (d: Prisma.SortOrder) => ({ manufacturer: d }),
} satisfies Record<string, (d: Prisma.SortOrder) => Prisma.InstrumentOrderByWithRelationInput>;

export default async function InstrumentsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { user, denied } = await guard("instruments");
  if (denied) return denied;
  const [t, locale, sp] = await Promise.all([getTranslations("instruments"), getLocale(), searchParams]);
  const params = parseListParams(sp, { defaultSort: "createdAt", sortable: Object.keys(SORTS) });
  const view = params.get("view") && params.get("view")! in VIEWS ? params.get("view")! : "all";
  const typeFilter = params.get("type");
  const scope = instrumentScope(user);
  const isBusiness = user.role === "BUSINESS_USER";
  const canRegister = user.role === "BUSINESS_USER";

  const where: Prisma.InstrumentWhereInput = {
    AND: [
      scope,
      VIEWS[view] ?? {},
      typeFilter ? { instrumentTypeId: typeFilter } : {},
      params.q
        ? {
            OR: [
              { instrumentCode: { contains: params.q, mode: "insensitive" } },
              { serialNumber: { contains: params.q, mode: "insensitive" } },
              { manufacturer: { contains: params.q, mode: "insensitive" } },
              { modelName: { contains: params.q, mode: "insensitive" } },
              { organization: { name: { contains: params.q, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };

  const [total, grouped, types] = await Promise.all([
    prisma.instrument.count({ where }),
    prisma.instrument.groupBy({ by: ["verificationStatus"], where: scope, _count: { _all: true } }),
    prisma.instrumentType.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, nameHi: true } }),
  ]);
  const meta = pageMeta(total, params.page, params.pageSize);
  const rows = await prisma.instrument.findMany({
    where,
    orderBy: [SORTS[params.sort as keyof typeof SORTS](params.dir), { id: "asc" }],
    skip: meta.skip,
    take: params.pageSize,
    select: {
      id: true,
      instrumentCode: true,
      serialNumber: true,
      manufacturer: true,
      modelName: true,
      capacity: true,
      locationLabel: true,
      verificationStatus: true,
      nextDueDate: true,
      organization: { select: { name: true } },
      state: { select: { code: true } },
      district: { select: { name: true, nameHi: true } },
      instrumentType: { select: { name: true, nameHi: true } },
    },
  });
  type Row = (typeof rows)[number];
  const count = (statuses: string[] | null) => grouped.filter((g) => !statuses || statuses.includes(g.verificationStatus)).reduce((a, g) => a + g._count._all, 0);
  const tn = (x: { name: string; nameHi: string | null }) => (locale === "hi" && x.nameHi ? x.nameHi : x.name);

  const columns: Column<Row>[] = [
    { key: "instrumentCode", header: t("col.code"), sortable: true, cell: (r) => <span className="whitespace-nowrap font-mono text-[0.8125rem]">{r.instrumentCode}</span> },
    {
      key: "type",
      header: t("col.instrument"),
      cell: (r) => (
        <span className="block max-w-[16rem]">
          <span className="block truncate">{tn(r.instrumentType)}</span>
          <span className="block truncate font-mono text-caption text-fg-subtle">{r.serialNumber}</span>
        </span>
      ),
    },
    {
      key: "manufacturer",
      header: t("col.make"),
      sortable: true,
      minBreakpoint: "lg",
      cell: (r) => (
        <span className="block max-w-[14rem] truncate text-fg-muted">
          {r.manufacturer} {r.modelName}
          {r.capacity ? <span className="text-fg-faint"> · {r.capacity}</span> : null}
        </span>
      ),
    },
    ...(isBusiness ? [] : [{ key: "owner", header: t("col.owner"), minBreakpoint: "md" as const, cell: (r: Row) => <span className="block max-w-[14rem] truncate">{r.organization.name}</span> }]),
    {
      key: "location",
      header: t("col.location"),
      minBreakpoint: "xl",
      cell: (r) => (
        <span className="text-fg-muted">
          {[r.locationLabel, r.district ? tn(r.district) : null, r.state?.code].filter(Boolean).join(" · ")}
        </span>
      ),
    },
    { key: "status", header: t("col.status"), cell: (r) => <StatusBadge status={r.verificationStatus} /> },
    {
      key: "nextDueDate",
      header: t("col.due"),
      sortable: true,
      align: "right",
      cell: (r) => {
        const d = daysUntil(r.nextDueDate);
        return r.nextDueDate ? (
          <span className={cn("whitespace-nowrap tabular", d != null && d < 0 ? "text-danger-700" : d != null && d <= 60 ? "text-warning-700" : "text-fg-muted")}>
            {formatDate(r.nextDueDate, locale)}
          </span>
        ) : (
          <span className="text-fg-faint">—</span>
        );
      },
    },
  ];

  const filtered = !!(params.q || typeFilter || view !== "all");
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t(isBusiness ? "descBusiness" : "desc")}
        actions={
          canRegister ? (
            <Link href="/instruments/new" className={buttonVariants()}>
              <Plus /> {t("register")}
            </Link>
          ) : null
        }
      />
      <TableToolbar
        tableId="instruments-table"
        searchPlaceholder={t("search")}
        tabs={[
          { value: "all", label: t("tabs.all"), count: count(null) },
          { value: "verified", label: t("tabs.verified"), count: count(["VERIFIED"]) },
          { value: "due", label: t("tabs.due"), count: count(["EXPIRING_SOON"]) },
          { value: "expired", label: t("tabs.expired"), count: count(["EXPIRED"]) },
          { value: "pending", label: t("tabs.pending"), count: count(["PENDING", "REGISTERED"]) },
        ]}
        filters={[{ key: "type", label: t("filters.type"), options: types.map((x) => ({ value: x.id, label: tn(x) })) }]}
        columns={columns.filter((c) => c.key !== "instrumentCode").map((c) => ({ key: c.key, label: String(c.header) }))}
      />
      <DataTable
        id="instruments-table"
        caption={t("title")}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/instruments/${r.id}`}
        path="/instruments"
        params={params.raw}
        sort={params.sort}
        dir={params.dir}
        empty={
          <EmptyState
            icon={Scale}
            title={filtered ? t("emptyFilteredTitle") : t("emptyTitle")}
            description={filtered ? t("emptyFilteredDesc") : t("emptyDesc")}
            action={
              !filtered && canRegister ? (
                <Link href="/instruments/new" className={buttonVariants()}>
                  <Plus /> {t("register")}
                </Link>
              ) : undefined
            }
          />
        }
      />
      {total > 0 ? <Pagination path="/instruments" params={params.raw} meta={meta} locale={locale} /> : null}
    </>
  );
}
