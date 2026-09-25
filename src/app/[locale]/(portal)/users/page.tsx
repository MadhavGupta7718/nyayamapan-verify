import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/db/client";
import { guard } from "@/server/access";
import { userScope } from "@/server/scope";
import { pageMeta, parseListParams, type RawSearchParams } from "@/lib/list-params";
import { formatDate, formatRelative, initials } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { DataTable, type Column } from "@/components/data/data-table";
import { Pagination } from "@/components/data/pagination";
import { TableToolbar } from "@/components/data/table-toolbar";
import { UserCreateDrawer, UserStatusMenu } from "@/components/users/user-admin";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("users") };
}

const STAFF: Role[] = ["SUPER_ADMIN", "STATE_ADMIN", "LMO", "INSPECTOR", "GATC_ADMIN", "GATC_OFFICER", "AUDITOR"];
const VIEWS: Record<string, Prisma.UserWhereInput | null> = {
  all: null,
  staff: { role: { in: STAFF } },
  business: { role: "BUSINESS_USER" },
  pending: { status: "PENDING" },
  suspended: { status: { in: ["SUSPENDED", "INACTIVE"] } },
};
const SORTS = {
  name: (dir: Prisma.SortOrder) => ({ name: dir }),
  createdAt: (dir: Prisma.SortOrder) => ({ createdAt: dir }),
  lastLoginAt: (dir: Prisma.SortOrder) => ({ lastLoginAt: { sort: dir, nulls: "last" as const } }),
} satisfies Record<string, (d: Prisma.SortOrder) => Prisma.UserOrderByWithRelationInput>;

export default async function UsersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { user, denied } = await guard("users");
  if (denied) return denied;
  const [t, tr, locale, sp] = await Promise.all([getTranslations("users"), getTranslations("roles"), getLocale(), searchParams]);
  const params = parseListParams(sp, { defaultSort: "createdAt", sortable: Object.keys(SORTS) });
  const view = params.get("view") && params.get("view")! in VIEWS ? params.get("view")! : "all";
  const roleFilter = params.get("role");
  const scope = userScope(user);
  const where: Prisma.UserWhereInput = {
    AND: [
      scope,
      VIEWS[view] ?? {},
      roleFilter ? { role: roleFilter as Role } : {},
      params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: "insensitive" } },
              { email: { contains: params.q, mode: "insensitive" } },
              { organization: { name: { contains: params.q, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };
  const keys = Object.keys(VIEWS);
  const [total, counts, states] = await Promise.all([
    prisma.user.count({ where }),
    Promise.all(keys.map((k) => prisma.user.count({ where: { AND: [scope, VIEWS[k] ?? {}] } }))),
    prisma.state.findMany({
      where: user.role === "SUPER_ADMIN" ? {} : { id: user.stateId ?? "__none__" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameHi: true },
    }),
  ]);
  const meta = pageMeta(total, params.page, params.pageSize);
  const rows = await prisma.user.findMany({
    where,
    orderBy: [SORTS[params.sort as keyof typeof SORTS](params.dir), { id: "asc" }],
    skip: meta.skip,
    take: params.pageSize,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      state: { select: { name: true, nameHi: true, code: true } },
      organization: { select: { name: true } },
    },
  });
  type Row = (typeof rows)[number];
  const canEdit = (r: Row) => r.id !== user.id && (user.role === "SUPER_ADMIN" || r.role !== "SUPER_ADMIN");

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: t("col.user"),
      sortable: true,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-100 text-caption font-semibold text-brand-800">{initials(r.name)}</span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-fg">
              {r.name}
              {r.id === user.id ? <span className="ml-1.5 text-caption font-normal text-fg-subtle">({t("you")})</span> : null}
            </span>
            <span className="block truncate text-caption text-fg-subtle">{r.email}</span>
          </span>
        </span>
      ),
    },
    { key: "role", header: t("col.role"), cell: (r) => <Badge tone={r.role === "BUSINESS_USER" ? "neutral" : "brand"}>{tr(r.role)}</Badge> },
    {
      key: "affiliation",
      header: t("col.affiliation"),
      minBreakpoint: "lg",
      cell: (r) => (
        <span className="block max-w-[14rem] truncate text-fg-muted">
          {r.organization?.name ?? (r.state ? (locale === "hi" && r.state.nameHi ? r.state.nameHi : r.state.name) : "—")}
        </span>
      ),
    },
    { key: "status", header: t("col.status"), cell: (r) => <StatusBadge status={r.status} withTooltip={false} /> },
    {
      key: "lastLoginAt",
      header: t("col.lastLogin"),
      sortable: true,
      minBreakpoint: "md",
      cell: (r) => (r.lastLoginAt ? <span className="whitespace-nowrap text-fg-muted" title={formatDate(r.lastLoginAt, locale)}>{formatRelative(r.lastLoginAt, locale)}</span> : <span className="text-fg-faint">{t("never")}</span>),
    },
    { key: "actions", header: <span className="sr-only">{t("col.actions")}</span>, align: "right", cell: (r) => (canEdit(r) ? <UserStatusMenu id={r.id} name={r.name} status={r.status} /> : null) },
  ];

  const creatable = user.role === "SUPER_ADMIN" ? ["STATE_ADMIN", "LMO", "INSPECTOR", "GATC_ADMIN", "GATC_OFFICER", "AUDITOR"] : ["LMO", "INSPECTOR", "GATC_ADMIN", "GATC_OFFICER", "AUDITOR"];

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t(user.role === "SUPER_ADMIN" ? "desc" : "descState")}
        actions={
          <UserCreateDrawer
            roles={creatable}
            states={states.map((s) => ({ id: s.id, label: locale === "hi" && s.nameHi ? s.nameHi : s.name }))}
            defaultStateId={user.role === "STATE_ADMIN" ? user.stateId : null}
          />
        }
      />
      <TableToolbar
        tableId="users-table"
        searchPlaceholder={t("search")}
        tabs={keys.map((k, i) => ({ value: k, label: t(`tabs.${k}`), count: counts[i] }))}
        filters={[{ key: "role", label: t("filters.role"), options: [...STAFF, "BUSINESS_USER" as Role].map((r) => ({ value: r, label: tr(r) })) }]}
        columns={columns.filter((c) => !["name", "actions"].includes(c.key)).map((c) => ({ key: c.key, label: String(c.header) }))}
      />
      <DataTable
        id="users-table"
        caption={t("title")}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        path="/users"
        params={params.raw}
        sort={params.sort}
        dir={params.dir}
        empty={<EmptyState icon={Users} title={t("emptyTitle")} description={t("emptyDesc")} />}
      />
      {total > 0 ? <Pagination path="/users" params={params.raw} meta={meta} locale={locale} /> : null}
    </>
  );
}
