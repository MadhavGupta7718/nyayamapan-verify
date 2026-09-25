import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BookOpenCheck, TriangleAlert } from "lucide-react";
import type { Prisma, RuleStatus } from "@prisma/client";
import { prisma } from "@/db/client";
import { guard } from "@/server/access";
import { buildHref, pageMeta, parseListParams, type RawSearchParams } from "@/lib/list-params";
import { formatRelative } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { DataTable, type Column } from "@/components/data/data-table";
import { Pagination } from "@/components/data/pagination";
import { TableToolbar } from "@/components/data/table-toolbar";
import { RuleDrawer, type RuleDetail } from "@/components/rules/rule-drawer";
import { RuleCreateDrawer } from "@/components/rules/rule-create-drawer";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("rules") };
}

const VIEWS: Record<string, Prisma.LegalRuleWhereInput | null> = {
  all: null,
  active: { status: "ACTIVE" },
  review: { status: { in: ["DRAFT", "UNDER_REVIEW", "APPROVED"] } },
  config: { OR: [{ valueStatus: "CONFIGURATION_REQUIRED" }, { status: "CONFIGURATION_REQUIRED" }] },
  retired: { status: "RETIRED" },
};
const SORTS = {
  updatedAt: (dir: Prisma.SortOrder) => ({ updatedAt: dir }),
  ruleKey: (dir: Prisma.SortOrder) => ({ ruleKey: dir }),
  status: (dir: Prisma.SortOrder) => ({ status: dir }),
} satisfies Record<string, (d: Prisma.SortOrder) => Prisma.LegalRuleOrderByWithRelationInput>;
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export default async function RulesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { user, denied } = await guard("rules");
  if (denied) return denied;
  const [t, locale, sp] = await Promise.all([getTranslations("rules"), getLocale(), searchParams]);
  const params = parseListParams(sp, { defaultSort: "updatedAt", sortable: Object.keys(SORTS) });
  const view = params.get("view") && params.get("view")! in VIEWS ? params.get("view")! : "all";
  const statusFilter = params.get("status");
  const canManage = user.role === "SUPER_ADMIN";
  const where: Prisma.LegalRuleWhereInput = {
    AND: [
      VIEWS[view] ?? {},
      statusFilter ? { status: statusFilter as RuleStatus } : {},
      params.q
        ? {
            OR: [
              { ruleKey: { contains: params.q, mode: "insensitive" } },
              { ruleName: { contains: params.q, mode: "insensitive" } },
              { parameter: { contains: params.q, mode: "insensitive" } },
              { ruleNumber: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };
  const keys = Object.keys(VIEWS);
  const selectedId = params.get("rule");
  const [total, counts, selected, types] = await Promise.all([
    prisma.legalRule.count({ where }),
    Promise.all(keys.map((k) => prisma.legalRule.count({ where: VIEWS[k] ?? {} }))),
    selectedId && /^[0-9a-f-]{36}$/i.test(selectedId)
      ? prisma.legalRule.findUnique({
          where: { id: selectedId },
          select: {
            id: true,
            ruleKey: true,
            ruleName: true,
            actName: true,
            ruleNumber: true,
            sectionNumber: true,
            parameter: true,
            requirement: true,
            unit: true,
            status: true,
            stateCode: true,
            sourceNotification: true,
            sourceDocument: true,
            amendmentReference: true,
            instrumentType: { select: { name: true, nameHi: true } },
            source: { select: { title: true, documentUrl: true } },
            versions: {
              orderBy: { versionNumber: "desc" },
              select: {
                id: true,
                versionNumber: true,
                value: true,
                valueStatus: true,
                effectiveFrom: true,
                effectiveUntil: true,
                changeReason: true,
                approvedById: true,
                _count: { select: { certificates: true } },
              },
            },
          },
        })
      : Promise.resolve(null),
    canManage ? prisma.instrumentType.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, nameHi: true } }) : Promise.resolve([]),
  ]);
  const meta = pageMeta(total, params.page, params.pageSize);
  const rows = await prisma.legalRule.findMany({
    where,
    orderBy: [SORTS[params.sort as keyof typeof SORTS](params.dir), { id: "asc" }],
    skip: meta.skip,
    take: params.pageSize,
    select: {
      id: true,
      ruleKey: true,
      ruleName: true,
      ruleNumber: true,
      parameter: true,
      value: true,
      unit: true,
      valueStatus: true,
      status: true,
      updatedAt: true,
      instrumentType: { select: { name: true, nameHi: true } },
      versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { versionNumber: true } },
    },
  });
  type Row = (typeof rows)[number];
  const tn = (x: { name: string; nameHi: string | null } | null) => (x ? (locale === "hi" && x.nameHi ? x.nameHi : x.name) : null);

  const detail: RuleDetail | null = selected
    ? {
        ...selected,
        instrumentType: tn(selected.instrumentType),
        source: selected.source ? { title: selected.source.title, url: selected.source.documentUrl } : null,
        versions: selected.versions.map((v) => ({
          id: v.id,
          versionNumber: v.versionNumber,
          value: v.value,
          valueStatus: v.valueStatus,
          effectiveFrom: iso(v.effectiveFrom)!,
          effectiveUntil: iso(v.effectiveUntil),
          changeReason: v.changeReason,
          approved: !!v.approvedById,
          certificates: v._count.certificates,
        })),
      }
    : null;

  const columns: Column<Row>[] = [
    {
      key: "ruleKey",
      header: t("col.rule"),
      sortable: true,
      cell: (r) => (
        <span className="block max-w-[22rem]">
          <span className="block truncate text-fg">{r.ruleName}</span>
          <span className="block truncate font-mono text-caption text-fg-subtle">{r.ruleKey}</span>
        </span>
      ),
    },
    { key: "parameter", header: t("col.parameter"), minBreakpoint: "lg", cell: (r) => <span className="font-mono text-[0.8125rem] text-fg-muted">{r.parameter}</span> },
    { key: "scope", header: t("col.appliesTo"), minBreakpoint: "xl", cell: (r) => <span className="text-fg-muted">{tn(r.instrumentType) ?? t("allTypes")}</span> },
    {
      key: "value",
      header: t("col.value"),
      cell: (r) =>
        r.valueStatus === "SET" ? (
          <span className="font-mono text-[0.8125rem]">
            {r.value} {r.unit}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-caption font-medium text-warning-700">
            <TriangleAlert className="size-3.5" /> {t("configRequired")}
          </span>
        ),
    },
    { key: "version", header: t("col.version"), minBreakpoint: "md", cell: (r) => <span className="tabular text-fg-muted">v{r.versions[0]?.versionNumber ?? 1}</span> },
    { key: "status", header: t("col.status"), sortable: true, cell: (r) => <StatusBadge status={r.status} /> },
    { key: "updatedAt", header: t("col.updated"), sortable: true, align: "right", minBreakpoint: "lg", cell: (r) => <span className="whitespace-nowrap text-fg-muted">{formatRelative(r.updatedAt, locale)}</span> },
  ];

  const configCount = counts[keys.indexOf("config")];

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("desc")}
        actions={canManage ? <RuleCreateDrawer types={types.map((x) => ({ id: x.id, label: tn(x)! }))} /> : null}
      />
      {configCount ? (
        <InlineAlert tone="warning" className="mb-4" icon={<TriangleAlert />} title={t("configBannerTitle", { count: configCount })}>
          {t("configBannerBody")}
        </InlineAlert>
      ) : null}
      <TableToolbar
        tableId="rules-table"
        searchPlaceholder={t("search")}
        tabs={keys.map((k, i) => ({ value: k, label: t(`tabs.${k}`), count: counts[i] }))}
        filters={[
          {
            key: "status",
            label: t("filters.status"),
            options: ["DRAFT", "UNDER_REVIEW", "APPROVED", "ACTIVE", "RETIRED", "CONFIGURATION_REQUIRED"].map((s) => ({ value: s, label: t(`statuses.${s}`) })),
          },
        ]}
        columns={columns.filter((c) => c.key !== "ruleKey").map((c) => ({ key: c.key, label: String(c.header) }))}
      />
      <DataTable
        id="rules-table"
        caption={t("title")}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => buildHref("/rules", params.raw, { rule: r.id })}
        path="/rules"
        params={params.raw}
        sort={params.sort}
        dir={params.dir}
        empty={<EmptyState icon={BookOpenCheck} title={params.q || view !== "all" ? t("emptyFilteredTitle") : t("emptyTitle")} description={t("emptyDesc")} />}
      />
      {total > 0 ? <Pagination path="/rules" params={params.raw} meta={meta} locale={locale} /> : null}
      <RuleDrawer rule={detail} canManage={canManage} />
    </>
  );
}
