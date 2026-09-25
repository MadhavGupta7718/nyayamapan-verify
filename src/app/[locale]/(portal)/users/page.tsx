import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/db/client";
import { guard } from "@/server/access";
import { userScope } from "@/server/scope";
import { Link } from "@/i18n/routing";
import { buildHref, pageMeta, parseListParams, type RawSearchParams } from "@/lib/list-params";
import { cn, formatDate, formatRelative, initials } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { DataTable, type Column } from "@/components/data/data-table";
import { Pagination } from "@/components/data/pagination";
import { TableToolbar } from "@/components/data/table-toolbar";
import { UserCreateDrawer, UserRowMenu, type GatcOption, type StateOption } from "@/components/users/user-admin";
import { canManageUser, creatableRoles } from "@/lib/user-hierarchy";

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

type AreaCount = { id: string; name: string; nameHi: string | null; count: number };

/** Users per state (national view) or per district (one state): officers by jurisdiction, business users by organisation district. */
async function usersByArea(
  scope: Prisma.UserWhereInput,
  stateId: string | null,
  districts: { id: string; name: string; nameHi: string | null }[]
): Promise<{ mode: "state" | "district"; rows: AreaCount[] }> {
  if (!stateId) {
    const [groups, states] = await Promise.all([
      prisma.user.groupBy({ by: ["stateId"], where: { AND: [scope, { stateId: { not: null } }] }, _count: { _all: true } }),
      prisma.state.findMany({ select: { id: true, name: true, nameHi: true } }),
    ]);
    const byId = new Map(states.map((s) => [s.id, s]));
    const rows = groups
      .flatMap((g) => {
        const s = g.stateId ? byId.get(g.stateId) : undefined;
        return s ? [{ ...s, count: g._count._all }] : [];
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return { mode: "state", rows };
  }
  const [officers, orgs] = await Promise.all([
    prisma.user.findMany({ where: { AND: [scope, { stateId }, { jurisdiction: { some: {} } }] }, select: { jurisdiction: { select: { id: true } } } }),
    prisma.organization.findMany({
      where: { stateId, districtId: { not: null } },
      select: { districtId: true, _count: { select: { users: { where: scope } } } },
    }),
  ]);
  const counts = new Map<string, number>();
  for (const o of officers) for (const d of o.jurisdiction) counts.set(d.id, (counts.get(d.id) ?? 0) + 1);
  for (const o of orgs) if (o.districtId && o._count.users) counts.set(o.districtId, (counts.get(o.districtId) ?? 0) + o._count.users);
  const rows = districts
    .map((d) => ({ ...d, count: counts.get(d.id) ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { mode: "district", rows };
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { user, denied } = await guard("users");
  if (denied) return denied;
  const [t, tr, locale, sp] = await Promise.all([getTranslations("users"), getTranslations("roles"), getLocale(), searchParams]);
  const params = parseListParams(sp, { defaultSort: "createdAt", sortable: Object.keys(SORTS) });
  const view = params.get("view") && params.get("view")! in VIEWS ? params.get("view")! : "all";
  const roleFilter = params.get("role");
  const scope = userScope(user);
  const stateFilter = user.role === "SUPER_ADMIN" ? params.get("state") : null;
  const focusStateId = stateFilter ?? (user.role === "SUPER_ADMIN" ? null : user.stateId ?? null);
  const districts = focusStateId
    ? await prisma.district.findMany({ where: { stateId: focusStateId }, orderBy: { name: "asc" }, select: { id: true, name: true, nameHi: true } })
    : [];
  const districtFilter = districts.some((d) => d.id === params.get("district")) ? params.get("district") : null;
  const where: Prisma.UserWhereInput = {
    AND: [
      scope,
      VIEWS[view] ?? {},
      roleFilter ? { role: roleFilter as Role } : {},
      stateFilter ? { stateId: stateFilter } : {},
      districtFilter ? { OR: [{ jurisdiction: { some: { id: districtFilter } } }, { organization: { districtId: districtFilter } }] } : {},
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
  const ownState = user.role === "SUPER_ADMIN" ? {} : { id: user.stateId ?? "__none__" };
  const [total, counts, states, summary, gatcs] = await Promise.all([
    prisma.user.count({ where }),
    Promise.all(keys.map((k) => prisma.user.count({ where: { AND: [scope, VIEWS[k] ?? {}] } }))),
    prisma.state.findMany({
      where: ownState,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        nameHi: true,
        isActive: true,
        districts: { where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, nameHi: true } },
      },
    }),
    usersByArea(scope, focusStateId, districts),
    prisma.gATCProfile.findMany({
      where: { approvalStatus: "APPROVED", ...(user.role === "SUPER_ADMIN" ? {} : { stateId: user.stateId ?? "__none__" }) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, approvalNumber: true, stateId: true },
    }),
  ]);
  const areaLabel = (x: { name: string; nameHi: string | null }) => (locale === "hi" && x.nameHi ? x.nameHi : x.name);
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
      mobile: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      stateId: true,
      gatcId: true,
      state: { select: { name: true, nameHi: true, code: true } },
      organization: { select: { name: true } },
      gatc: { select: { name: true } },
      jurisdiction: { orderBy: { name: "asc" }, select: { id: true, name: true, nameHi: true } },
    },
  });
  type Row = (typeof rows)[number];
  const stateOptions: StateOption[] = states
    .filter((s) => s.isActive)
    .map((s) => ({ id: s.id, label: areaLabel(s), districts: s.districts.map((d) => ({ id: d.id, label: areaLabel(d) })) }));
  const gatcOptions: GatcOption[] = gatcs.map((g) => ({ id: g.id, label: `${g.name} · ${g.approvalNumber}`, stateId: g.stateId }));
  const affiliation = (r: Row) => {
    if (r.organization) return r.organization.name;
    if (r.gatc) return r.gatc.name;
    const place = r.state ? areaLabel(r.state) : null;
    if (r.jurisdiction.length) return `${r.jurisdiction.map(areaLabel).join(", ")}${place ? ` · ${place}` : ""}`;
    return place ?? "—";
  };

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
        <span className="block max-w-[16rem] truncate text-fg-muted" title={affiliation(r)}>
          {affiliation(r)}
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
    {
      key: "actions",
      header: <span className="sr-only">{t("col.actions")}</span>,
      align: "right",
      cell: (r) =>
        canManageUser(user, r) ? (
          <UserRowMenu
            user={{ id: r.id, name: r.name, mobile: r.mobile, role: r.role, status: r.status, stateId: r.stateId, districtIds: r.jurisdiction.map((d) => d.id), gatcId: r.gatcId }}
            states={stateOptions}
            gatcs={gatcOptions}
            canChangeState={user.role === "SUPER_ADMIN"}
          />
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t(user.role === "SUPER_ADMIN" ? "desc" : user.role === "GATC_ADMIN" ? "descGatc" : "descState")}
        actions={
          <UserCreateDrawer
            roles={creatableRoles(user.role)}
            states={stateOptions}
            gatcs={gatcOptions}
            defaultStateId={user.role === "SUPER_ADMIN" ? null : user.stateId}
          />
        }
      />
      {summary.rows.length ? (
        <section aria-labelledby="users-by-area" className="mb-5 rounded-xl border border-line bg-surface px-5 py-4 shadow-xs">
          <h2 id="users-by-area" className="text-h4 text-fg">
            {t(summary.mode === "state" ? "byState" : "byDistrict")}
          </h2>
          <ul className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto scrollbar-thin">
            {summary.rows.map((r) => {
              const active = summary.mode === "state" ? stateFilter === r.id : districtFilter === r.id;
              const href = buildHref(
                "/users",
                params.raw,
                summary.mode === "state" ? { state: active ? null : r.id, district: null, page: null } : { district: active ? null : r.id, page: null }
              );
              return (
                <li key={r.id}>
                  <Link
                    href={href}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-body-sm ring-1 ring-inset transition-colors",
                      active ? "bg-brand-800 text-white ring-brand-800" : "bg-surface-subtle text-fg ring-line hover:ring-ink-400"
                    )}
                  >
                    {areaLabel(r)}
                    <span className={cn("font-semibold tabular-nums", active ? "text-white" : "text-brand-800")}>{r.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <TableToolbar
        tableId="users-table"
        searchPlaceholder={t("search")}
        tabs={keys.map((k, i) => ({ value: k, label: t(`tabs.${k}`), count: counts[i] }))}
        filters={[
          { key: "role", label: t("filters.role"), options: [...STAFF, "BUSINESS_USER" as Role].map((r) => ({ value: r, label: tr(r) })) },
          ...(user.role === "SUPER_ADMIN" ? [{ key: "state", label: t("filters.state"), options: states.map((s) => ({ value: s.id, label: areaLabel(s) })) }] : []),
          ...(districts.length ? [{ key: "district", label: t("filters.district"), options: districts.map((d) => ({ value: d.id, label: areaLabel(d) })) }] : []),
        ]}
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
