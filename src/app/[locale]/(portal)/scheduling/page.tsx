import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarCheck2, CalendarClock, Inbox, TriangleAlert } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { Link } from "@/i18n/routing";
import { guard } from "@/server/access";
import { applicationScope, scheduleScope } from "@/server/scope";
import { buildHref } from "@/lib/list-params";
import { cn, daysUntil, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { TableToolbar } from "@/components/data/table-toolbar";
import { ScheduleDrawer } from "@/components/scheduling/schedule-drawer";
import { SiteMap, type MapPoint } from "@/components/maps/site-map";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("scheduling") };
}

const DAY = 86_400_000;
const ASSIGNERS = ["SUPER_ADMIN", "STATE_ADMIN", "GATC_ADMIN"];

export default async function SchedulingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user, denied } = await guard("scheduling");
  if (denied) return denied;
  const [t, locale, sp] = await Promise.all([getTranslations("scheduling"), getLocale(), searchParams]);
  const canAssign = ASSIGNERS.includes(user.role);
  const view = sp.view === "calendar" || sp.view === "map" ? sp.view : canAssign ? "queue" : "calendar";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today.getTime() + 14 * DAY);
  const q = sp.q?.trim().slice(0, 60);

  const queueWhere: Prisma.ApplicationWhereInput = {
    AND: [
      user.role === "GATC_ADMIN" ? { instrument: { stateId: user.stateId ?? "__none__" } } : applicationScope(user),
      { status: "APPROVED" },
      q ? { OR: [{ applicationNumber: { contains: q, mode: "insensitive" } }, { organization: { name: { contains: q, mode: "insensitive" } } }] } : {},
    ],
  };
  const scheduleWhere: Prisma.VerificationScheduleWhereInput = {
    AND: [
      ["LMO", "INSPECTOR", "GATC_OFFICER"].includes(user.role) ? { assignment: { officerId: user.id } } : scheduleScope(user),
      { status: "SCHEDULED", scheduledDate: { gte: today, lt: horizon } },
    ],
  };

  const [queue, queueCount, schedules, conflictCount] = await Promise.all([
    canAssign
      ? prisma.application.findMany({
          where: queueWhere,
          orderBy: { updatedAt: "asc" },
          take: 100,
          select: {
            id: true,
            applicationNumber: true,
            preferredDate: true,
            preferredSlot: true,
            updatedAt: true,
            organization: { select: { name: true } },
            instrument: {
              select: {
                stateId: true,
                instrumentTypeId: true,
                latitude: true,
                longitude: true,
                address: true,
                instrumentType: { select: { name: true, nameHi: true } },
                district: { select: { name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    canAssign ? prisma.application.count({ where: queueWhere }) : Promise.resolve(0),
    prisma.verificationSchedule.findMany({
      where: scheduleWhere,
      orderBy: [{ scheduledDate: "asc" }, { timeSlot: "asc" }],
      take: 300,
      select: {
        id: true,
        scheduledDate: true,
        timeSlot: true,
        conflictFlags: true,
        application: {
          select: {
            id: true,
            applicationNumber: true,
            status: true,
            organization: { select: { name: true } },
            instrument: { select: { latitude: true, longitude: true, instrumentType: { select: { name: true, nameHi: true } } } },
          },
        },
        assignment: { select: { authorityType: true, officer: { select: { name: true } } } },
      },
    }),
    prisma.verificationSchedule.count({ where: { AND: [scheduleWhere, { conflictFlags: { not: Prisma.DbNull } }] } }),
  ]);

  const tn = (x: { name: string; nameHi: string | null }) => (locale === "hi" && x.nameHi ? x.nameHi : x.name);
  const days = Array.from({ length: 14 }, (_, i) => new Date(today.getTime() + i * DAY));
  const byDay = new Map<string, typeof schedules>();
  for (const s of schedules) {
    const k = s.scheduledDate.toDateString();
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  const dayFmt = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short" });
  const weekday = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { weekday: "short" });

  const points: MapPoint[] = [
    ...schedules
      .filter((s) => s.application.instrument.latitude != null)
      .map((s) => ({
        id: s.id,
        lat: s.application.instrument.latitude!,
        lng: s.application.instrument.longitude!,
        title: s.application.organization.name,
        subtitle: `${formatDate(s.scheduledDate, locale)} · ${s.timeSlot ?? ""} · ${s.assignment?.officer?.name ?? ""}`,
        tone: "brand" as const,
        href: `/${locale}/applications/${s.application.id}`,
      })),
    ...queue
      .filter((a) => a.instrument.latitude != null)
      .map((a) => ({
        id: a.id,
        lat: a.instrument.latitude!,
        lng: a.instrument.longitude!,
        title: a.organization.name,
        subtitle: `${a.applicationNumber} · ${t("awaitingSchedule")}`,
        tone: "warning" as const,
        href: `/${locale}/scheduling?application=${a.id}`,
      })),
  ];

  const tabs = [
    ...(canAssign ? [{ value: "queue", label: t("tabs.queue"), count: queueCount }] : []),
    { value: "calendar", label: t("tabs.calendar"), count: schedules.length },
    { value: "map", label: t("tabs.map") },
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t(canAssign ? "desc" : "descOfficer")}
        meta={
          conflictCount ? (
            <Badge tone="warning">
              <TriangleAlert className="size-3.5" /> {t("conflictBadge", { count: conflictCount })}
            </Badge>
          ) : null
        }
      />
      <TableToolbar searchPlaceholder={canAssign ? t("search") : undefined} tabs={tabs} />

      {view === "queue" ? (
        queue.length ? (
          <Card>
            <ul className="divide-y divide-line">
              {queue.map((a) => {
                const waiting = -(daysUntil(a.updatedAt) ?? 0);
                return (
                  <li key={a.id} className={cn("flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center", sp.application === a.id && "bg-brand-50/60")}>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <Link href={`/applications/${a.id}`} className="font-mono text-[0.8125rem] text-fg hover:text-brand-800">
                          {a.applicationNumber}
                        </Link>
                        {waiting > 5 ? <Badge tone="warning">{t("waitingDays", { days: waiting })}</Badge> : null}
                      </p>
                      <p className="mt-0.5 truncate font-medium text-fg">{a.organization.name}</p>
                      <p className="truncate text-caption text-fg-subtle">
                        {tn(a.instrument.instrumentType)} · {[a.instrument.address, a.instrument.district?.name].filter(Boolean).join(", ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-body-sm text-fg-muted sm:w-44 sm:text-right">
                      <p className="text-caption text-fg-subtle">{t("preferred")}</p>
                      <p>{a.preferredDate ? `${formatDate(a.preferredDate, locale)} · ${a.preferredSlot ?? ""}` : "—"}</p>
                    </div>
                    <Link href={buildHref("/scheduling", sp, { application: a.id })} scroll={false} className={buttonVariants({ size: "sm" })}>
                      <CalendarClock /> {t("assign")}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : (
          <Card>
            <EmptyState icon={Inbox} title={t("queueEmptyTitle")} description={t("queueEmptyDesc")} />
          </Card>
        )
      ) : null}

      {view === "calendar" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          {days.map((d) => {
            const list = byDay.get(d.toDateString()) ?? [];
            const isToday = d.getTime() === today.getTime();
            const weekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <Card key={d.toISOString()} className={cn("flex min-h-[9rem] flex-col", isToday && "ring-1 ring-brand-400", weekend && "bg-surface-subtle")}>
                <div className="flex items-center justify-between border-b border-line px-3 py-2">
                  <span className={cn("text-body-sm font-semibold", isToday ? "text-brand-800" : "text-fg")}>
                    <span className="xl:hidden">{dayFmt.format(d)}</span>
                    <span className="hidden xl:inline">
                      {weekday.format(d)} {d.getDate()}
                    </span>
                  </span>
                  {list.length ? <span className="rounded-full bg-brand-100 px-1.5 text-caption font-medium text-brand-800 tabular">{list.length}</span> : null}
                </div>
                <ul className="flex-1 space-y-1.5 p-2">
                  {list.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={["LMO", "INSPECTOR", "GATC_OFFICER"].includes(user.role) ? `/verification/${s.application.id}` : `/applications/${s.application.id}`}
                        className={cn(
                          "block rounded-md border-l-2 bg-surface px-2 py-1.5 text-caption shadow-xs ring-1 ring-inset ring-line transition-colors hover:bg-brand-50",
                          s.conflictFlags ? "border-l-warning-500" : "border-l-brand-500"
                        )}
                      >
                        <span className="block font-medium text-fg tabular">{s.timeSlot ?? "—"}</span>
                        <span className="block truncate text-fg-muted">{s.application.organization.name}</span>
                        <span className="block truncate text-fg-subtle">{s.assignment?.officer?.name}</span>
                      </Link>
                    </li>
                  ))}
                  {!list.length ? <li className="px-1 py-2 text-caption text-fg-faint">{t("noVisits")}</li> : null}
                </ul>
              </Card>
            );
          })}
        </div>
      ) : null}

      {view === "map" ? (
        <Card>
          <CardHeader
            icon={<CalendarCheck2 />}
            title={t("mapTitle")}
            description={t("mapDesc")}
            action={
              <div className="flex gap-3 text-caption text-fg-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-brand-600" /> {t("legendScheduled")}
                </span>
                {canAssign ? (
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-warning-500" /> {t("legendQueue")}
                  </span>
                ) : null}
              </div>
            }
          />
          <div className="p-3">
            <SiteMap points={points} height={520} emptyLabel={t("mapEmpty")} />
          </div>
        </Card>
      ) : null}

      {canAssign ? (
        <ScheduleDrawer
          items={queue.map((a) => ({
            id: a.id,
            number: a.applicationNumber,
            organization: a.organization.name,
            instrumentType: tn(a.instrument.instrumentType),
            instrumentTypeId: a.instrument.instrumentTypeId,
            stateId: a.instrument.stateId,
            preferredDate: a.preferredDate?.toISOString().slice(0, 10) ?? null,
            preferredSlot: a.preferredSlot,
          }))}
        />
      ) : null}
    </>
  );
}
