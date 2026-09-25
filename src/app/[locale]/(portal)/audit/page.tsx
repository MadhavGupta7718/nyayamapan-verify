import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ScrollText } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { guard } from "@/server/access";
import { auditScope } from "@/server/scope";
import { pageMeta, parseListParams, type RawSearchParams } from "@/lib/list-params";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/data/data-table";
import { Pagination } from "@/components/data/pagination";
import { TableToolbar } from "@/components/data/table-toolbar";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("audit") };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const SENSITIVE = /password|hash|token|secret/i;

function redact(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(redact);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SENSITIVE.test(k) ? "••••" : redact(x)]));
  return v;
}

function tone(action: string): "danger" | "warning" | "success" | "brand" | "neutral" {
  if (/REVOK|REJECT|FAIL|DELETE|SUSPEND|RETIRE|DENIED|LOCKED/.test(action)) return "danger";
  if (/RETURN|OVERRIDE|CONFLICT|RESET/.test(action)) return "warning";
  if (/ISSUED|APPROV|ACTIVAT|PASS|REINSTAT|CREATED/.test(action)) return "success";
  if (/LOGIN|DOWNLOAD|EXPORT|VIEW/.test(action)) return "neutral";
  return "brand";
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { user, denied } = await guard("audit");
  if (denied) return denied;
  const [t, tr, locale, sp] = await Promise.all([getTranslations("audit"), getTranslations("roles"), getLocale(), searchParams]);
  const params = parseListParams(sp, { defaultSort: "createdAt", sortable: ["createdAt"], defaultPageSize: 50 });
  const entity = params.get("entity");
  const action = params.get("action");
  const from = params.get("from");
  const to = params.get("to");
  const scope = auditScope(user);
  const where: Prisma.AuditLogWhereInput = {
    AND: [
      scope,
      entity ? { entity } : {},
      action ? { action } : {},
      from && ISO.test(from) ? { createdAt: { gte: new Date(from) } } : {},
      to && ISO.test(to) ? { createdAt: { lte: new Date(`${to}T23:59:59`) } } : {},
      params.q
        ? {
            OR: [
              { entityId: { contains: params.q, mode: "insensitive" } },
              { reason: { contains: params.q, mode: "insensitive" } },
              { actor: { name: { contains: params.q, mode: "insensitive" } } },
              { actor: { email: { contains: params.q, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };

  const [total, entities, actions] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["entity"], where: scope, _count: { _all: true }, orderBy: { entity: "asc" } }),
    prisma.auditLog.groupBy({ by: ["action"], where: { AND: [scope, entity ? { entity } : {}] }, _count: { _all: true }, orderBy: { action: "asc" } }),
  ]);
  const meta = pageMeta(total, params.page, params.pageSize);
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: params.dir }, { id: "asc" }],
    skip: meta.skip,
    take: params.pageSize,
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      reason: true,
      before: true,
      after: true,
      ip: true,
      createdAt: true,
      actor: { select: { name: true, role: true } },
    },
  });
  type Row = (typeof rows)[number];
  const human = (s: string) => s.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

  const columns: Column<Row>[] = [
    {
      key: "createdAt",
      header: t("col.time"),
      sortable: true,
      cell: (r) => (
        <time dateTime={r.createdAt.toISOString()} className="whitespace-nowrap font-mono text-[0.8125rem] text-fg-muted">
          {formatDateTime(r.createdAt, locale)}
        </time>
      ),
    },
    {
      key: "actor",
      header: t("col.actor"),
      cell: (r) =>
        r.actor ? (
          <span className="block max-w-[12rem]">
            <span className="block truncate text-fg">{r.actor.name}</span>
            <span className="block truncate text-caption text-fg-subtle">{tr(r.actor.role)}</span>
          </span>
        ) : (
          <span className="text-fg-faint">{t("system")}</span>
        ),
    },
    { key: "action", header: t("col.action"), cell: (r) => <Badge tone={tone(r.action)}>{t.has(`actions.${r.action}`) ? t(`actions.${r.action}`) : human(r.action)}</Badge> },
    {
      key: "entity",
      header: t("col.entity"),
      minBreakpoint: "md",
      cell: (r) => (
        <span className="block">
          <span className="block text-fg">{r.entity}</span>
          {r.entityId ? <span className="block max-w-[10rem] truncate font-mono text-caption text-fg-subtle" title={r.entityId}>{r.entityId}</span> : null}
        </span>
      ),
    },
    {
      key: "details",
      header: t("col.details"),
      cell: (r) =>
        r.reason || r.before || r.after ? (
          <details className="group/d max-w-[22rem]">
            <summary className="cursor-pointer list-none text-body-sm text-fg-muted [&::-webkit-details-marker]:hidden">
              <span className="line-clamp-1">{r.reason ?? t("viewChanges")}</span>
              <span className="text-caption font-medium text-brand-700 group-open/d:hidden">{t("expand")}</span>
            </summary>
            <div className="mt-2 space-y-2">
              {r.reason ? <p className="whitespace-pre-wrap text-body-sm text-fg">{r.reason}</p> : null}
              {r.before ? (
                <div>
                  <p className="text-caption text-fg-subtle">{t("before")}</p>
                  <pre className="max-h-40 overflow-auto rounded-md bg-surface-subtle p-2 text-[0.6875rem] leading-4 text-fg-muted">{JSON.stringify(redact(r.before), null, 2)}</pre>
                </div>
              ) : null}
              {r.after ? (
                <div>
                  <p className="text-caption text-fg-subtle">{t("after")}</p>
                  <pre className="max-h-40 overflow-auto rounded-md bg-surface-subtle p-2 text-[0.6875rem] leading-4 text-fg-muted">{JSON.stringify(redact(r.after), null, 2)}</pre>
                </div>
              ) : null}
              {r.ip ? <p className="font-mono text-caption text-fg-faint">IP {r.ip}</p> : null}
            </div>
          </details>
        ) : (
          <span className="text-fg-faint">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader title={t("title")} description={t("desc")} meta={<Badge tone="neutral">{t("immutable")}</Badge>} />
      <TableToolbar
        tableId="audit-table"
        searchPlaceholder={t("search")}
        filters={[
          { key: "entity", label: t("filters.entity"), options: entities.map((e) => ({ value: e.entity, label: `${e.entity} (${e._count._all})` })) },
          { key: "action", label: t("filters.action"), options: actions.map((a) => ({ value: a.action, label: t.has(`actions.${a.action}`) ? t(`actions.${a.action}`) : human(a.action) })) },
        ]}
        columns={columns.filter((c) => c.key !== "createdAt").map((c) => ({ key: c.key, label: String(c.header) }))}
      />
      <DataTable
        id="audit-table"
        caption={t("title")}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        path="/audit"
        params={params.raw}
        sort={params.sort}
        dir={params.dir}
        empty={<EmptyState icon={ScrollText} title={params.q || entity || action ? t("emptyFilteredTitle") : t("emptyTitle")} description={t("emptyDesc")} />}
      />
      {total > 0 ? <Pagination path="/audit" params={params.raw} meta={meta} locale={locale} /> : null}
    </>
  );
}
