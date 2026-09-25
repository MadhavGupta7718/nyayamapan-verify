import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Building2, CalendarRange, Mail, MapPin, Phone } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { guard } from "@/server/access";
import { cn, daysUntil, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { TableToolbar } from "@/components/data/table-toolbar";
import { SiteMap } from "@/components/maps/site-map";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("gatc") };
}

export default async function GatcPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user, denied } = await guard("gatc");
  if (denied) return denied;
  const [t, locale, sp] = await Promise.all([getTranslations("gatc"), getLocale(), searchParams]);
  const q = sp.q?.trim().slice(0, 60);
  const view = sp.view === "map" ? "map" : "list";
  const where: Prisma.GATCProfileWhereInput = {
    AND: [
      ["GATC_ADMIN", "GATC_OFFICER", "STATE_ADMIN"].includes(user.role) ? { stateId: user.stateId ?? "__none__" } : {},
      q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { approvalNumber: { contains: q, mode: "insensitive" } }] } : {},
    ],
  };
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const gatcs = await prisma.gATCProfile.findMany({
    where,
    orderBy: { name: "asc" },
    take: 100,
    select: {
      id: true,
      name: true,
      approvalNumber: true,
      approvalStatus: true,
      approvalStart: true,
      approvalEnd: true,
      address: true,
      contactEmail: true,
      contactPhone: true,
      latitude: true,
      longitude: true,
      state: { select: { name: true, nameHi: true } },
      district: { select: { name: true, nameHi: true } },
      authorizations: { select: { id: true, instrumentType: { select: { name: true, nameHi: true } } } },
      _count: { select: { assignments: true } },
    },
  });
  const monthly = gatcs.length
    ? await prisma.verificationAssignment.groupBy({
        by: ["gatcId"],
        where: { gatcId: { in: gatcs.map((g) => g.id) }, assignedAt: { gte: monthStart } },
        _count: { _all: true },
      })
    : [];
  const monthOf = new Map(monthly.map((m) => [m.gatcId, m._count._all]));
  const tn = (x: { name: string; nameHi: string | null } | null) => (x ? (locale === "hi" && x.nameHi ? x.nameHi : x.name) : null);

  return (
    <>
      <PageHeader title={t("title")} description={t("desc")} />
      <TableToolbar
        searchPlaceholder={t("search")}
        tabs={[
          { value: "list", label: t("tabs.list"), count: gatcs.length },
          { value: "map", label: t("tabs.map") },
        ]}
      />
      {view === "map" ? (
        <Card className="p-3">
          <SiteMap
            height={540}
            emptyLabel={t("mapEmpty")}
            points={gatcs
              .filter((g) => g.latitude != null && g.longitude != null)
              .map((g) => ({ id: g.id, lat: g.latitude!, lng: g.longitude!, title: g.name, subtitle: g.approvalNumber, tone: g.approvalStatus === "APPROVED" ? "success" : "warning" }))}
          />
        </Card>
      ) : gatcs.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {gatcs.map((g) => {
            const left = daysUntil(g.approvalEnd);
            const lapsed = left != null && left < 0;
            return (
              <Card key={g.id} className="flex flex-col">
                <div className="flex items-start gap-3 border-b border-line px-5 py-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <Building2 className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-h4 text-fg">{g.name}</h2>
                    <p className="font-mono text-caption text-fg-subtle">{g.approvalNumber}</p>
                  </div>
                  <StatusBadge status={lapsed ? "EXPIRED" : g.approvalStatus === "APPROVED" ? "ACTIVE" : g.approvalStatus} />
                </div>
                <div className="grid flex-1 gap-4 px-5 py-4 sm:grid-cols-2">
                  <div className="space-y-2 text-body-sm">
                    <p className="flex items-start gap-2 text-fg-muted">
                      <CalendarRange className="mt-0.5 size-4 shrink-0 text-fg-faint" />
                      <span>
                        {formatDate(g.approvalStart, locale)} → {formatDate(g.approvalEnd, locale)}
                        {left != null && left >= 0 && left <= 90 ? <span className="block text-caption text-warning-700">{t("approvalEnds", { days: left })}</span> : null}
                      </span>
                    </p>
                    <p className="flex items-start gap-2 text-fg-muted">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-fg-faint" />
                      <span>{[g.address, tn(g.district), tn(g.state)].filter(Boolean).join(", ") || "—"}</span>
                    </p>
                    {g.contactEmail ? (
                      <p className="flex items-center gap-2 text-fg-muted">
                        <Mail className="size-4 shrink-0 text-fg-faint" />
                        <a href={`mailto:${g.contactEmail}`} className="truncate hover:text-brand-700">
                          {g.contactEmail}
                        </a>
                      </p>
                    ) : null}
                    {g.contactPhone ? (
                      <p className="flex items-center gap-2 text-fg-muted">
                        <Phone className="size-4 shrink-0 text-fg-faint" /> {g.contactPhone}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-caption text-fg-subtle">{t("authorizedFor")}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {g.authorizations.length ? (
                        g.authorizations.map((a) => (
                          <Badge key={a.id} tone="brand">
                            {tn(a.instrumentType)}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-caption text-warning-700">{t("noAuthorizations")}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-line rounded-b-xl border-t border-line bg-surface-subtle text-center">
                  <div className="px-4 py-2.5">
                    <p className="text-h4 tabular text-fg">{monthOf.get(g.id) ?? 0}</p>
                    <p className="text-caption text-fg-subtle">{t("thisMonth")}</p>
                  </div>
                  <div className="px-4 py-2.5">
                    <p className={cn("text-h4 tabular text-fg")}>{g._count.assignments}</p>
                    <p className="text-caption text-fg-subtle">{t("allTime")}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState icon={Building2} title={q ? t("emptyFilteredTitle") : t("emptyTitle")} description={q ? t("emptyFilteredDesc") : t("emptyDesc")} />
        </Card>
      )}
    </>
  );
}
