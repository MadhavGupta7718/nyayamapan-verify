import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BellOff } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { guard } from "@/server/access";
import { pageMeta, parseListParams, type RawSearchParams } from "@/lib/list-params";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { TableToolbar } from "@/components/data/table-toolbar";
import { Pagination } from "@/components/data/pagination";
import { MarkAllRead, NotificationList } from "@/components/notifications/notification-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("notifications") };
}

function hrefFor(meta: unknown): string | null {
  const m = (meta ?? {}) as Record<string, unknown>;
  const id = (k: string) => (typeof m[k] === "string" && /^[0-9a-f-]{36}$/i.test(m[k] as string) ? (m[k] as string) : null);
  if (id("certificateId")) return `/certificates/${id("certificateId")}`;
  if (id("applicationId")) return `/applications/${id("applicationId")}`;
  if (id("instrumentId")) return `/instruments/${id("instrumentId")}`;
  return null;
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { user, denied } = await guard("notifications");
  if (denied) return denied;
  const [t, locale, sp] = await Promise.all([getTranslations("notifications"), getLocale(), searchParams]);
  const params = parseListParams(sp, { defaultSort: "createdAt", sortable: ["createdAt"] });
  const view = params.get("view") === "unread" ? "unread" : "all";
  const base: Prisma.NotificationWhereInput = { userId: user.id };
  const where: Prisma.NotificationWhereInput = {
    ...base,
    ...(view === "unread" ? { readAt: null } : {}),
    ...(params.q ? { OR: [{ title: { contains: params.q, mode: "insensitive" } }, { body: { contains: params.q, mode: "insensitive" } }] } : {}),
  };
  const [total, all, unread] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: base }),
    prisma.notification.count({ where: { ...base, readAt: null } }),
  ]);
  const meta = pageMeta(total, params.page, params.pageSize);
  const rows = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: meta.skip,
    take: params.pageSize,
    select: { id: true, type: true, title: true, body: true, readAt: true, createdAt: true, meta: true },
  });

  return (
    <>
      <PageHeader title={t("title")} description={t("desc")} actions={<MarkAllRead disabled={!unread} />} />
      <TableToolbar
        searchPlaceholder={t("search")}
        tabs={[
          { value: "all", label: t("tabs.all"), count: all },
          { value: "unread", label: t("tabs.unread"), count: unread },
        ]}
      />
      <Card>
        {rows.length ? (
          <NotificationList
            items={rows.map((n) => ({
              id: n.id,
              type: n.type,
              title: n.title,
              body: n.body,
              href: hrefFor(n.meta),
              unread: !n.readAt,
              time: formatRelative(n.createdAt, locale),
              timeTitle: formatDateTime(n.createdAt, locale),
            }))}
          />
        ) : (
          <EmptyState
            icon={BellOff}
            title={view === "unread" ? t("emptyUnreadTitle") : params.q ? t("emptyFilteredTitle") : t("emptyTitle")}
            description={view === "unread" ? t("emptyUnreadDesc") : t("emptyDesc")}
          />
        )}
      </Card>
      {total > 0 ? <Pagination path="/notifications" params={params.raw} meta={meta} locale={locale} /> : null}
    </>
  );
}
