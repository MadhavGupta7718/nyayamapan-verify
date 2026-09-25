import { getLocale, getTranslations } from "next-intl/server";
import {
  AlarmClock,
  ArrowRight,
  Award,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileSearch,
  Gauge,
  History,
  MapPin,
  Navigation,
  Scale,
  ShieldAlert,
  TriangleAlert,
  Truck,
  Undo2,
} from "lucide-react";
import { Prisma, type ApplicationStatus } from "@prisma/client";
import { prisma } from "@/db/client";
import { Link } from "@/i18n/routing";
import type { SessionUser } from "@/server/rbac";
import { applicationScope, auditScope, certificateScope, instrumentScope, scheduleScope } from "@/server/scope";
import { APPLICATION_STAGE_GROUPS, WORKFLOW_MILESTONES, milestoneIndex } from "@/lib/status";
import { canAccessModule } from "@/lib/permissions";
import { cn, daysUntil, formatDate, formatNumber, formatRelative } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { buttonVariants } from "@/components/ui/button";
import { BarList, ColumnChart, Donut, Funnel } from "@/components/charts/charts";

const DAY = 86_400_000;
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const inStatuses = (list: readonly string[]) => ({ in: list as ApplicationStatus[] });

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-body-sm font-medium text-brand-700 hover:text-brand-900">
      {label} <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

// ---------------------------------------------------------------- admin command center

export async function AdminKpis({ user }: { user: SessionUser }) {
  const [t, locale] = await Promise.all([getTranslations("dashboard.kpi"), getLocale()]);
  const scope = applicationScope(user);
  const certs = certificateScope(user);
  const now = new Date();
  const [review, ready, field, active, expiring, expired] = await Promise.all([
    prisma.application.count({ where: { AND: [scope, { status: inStatuses(APPLICATION_STAGE_GROUPS.needsReview) }] } }),
    prisma.application.count({ where: { AND: [scope, { status: "APPROVED" }] } }),
    prisma.application.count({ where: { AND: [scope, { status: inStatuses(APPLICATION_STAGE_GROUPS.inField) }] } }),
    prisma.certificate.count({ where: { AND: [certs, { status: "ACTIVE" }, { OR: [{ validUntil: null }, { validUntil: { gte: now } }] }] } }),
    prisma.certificate.count({ where: { AND: [certs, { status: "ACTIVE", validUntil: { gte: now, lte: new Date(now.getTime() + 30 * DAY) } }] } }),
    prisma.certificate.count({ where: { AND: [certs, { OR: [{ status: "EXPIRED" }, { status: "ACTIVE", validUntil: { lt: now } }] }] } }),
  ]);
  const n = (v: number) => formatNumber(v, locale);
  return (
    <StatGrid className="lg:grid-cols-3 xl:grid-cols-6">
      <StatCard label={t("awaitingReview")} value={n(review)} hint={t("awaitingReviewHint")} icon={<FileSearch />} tone="info" href="/applications?view=needsReview" emphasis={review > 0} />
      <StatCard label={t("readyToSchedule")} value={n(ready)} hint={t("readyToScheduleHint")} icon={<CalendarClock />} tone="brand" href="/scheduling" emphasis={ready > 0} />
      <StatCard label={t("inField")} value={n(field)} hint={t("inFieldHint")} icon={<Truck />} tone="info" href="/applications?view=inField" />
      <StatCard label={t("activeCertificates")} value={n(active)} hint={t("activeCertificatesHint")} icon={<Award />} tone="success" href="/certificates?status=ACTIVE" />
      <StatCard label={t("expiring30")} value={n(expiring)} hint={t("expiring30Hint")} icon={<AlarmClock />} tone="warning" href="/certificates?view=expiring" emphasis={expiring > 0} />
      <StatCard label={t("expired")} value={n(expired)} hint={t("expiredHint")} icon={<ShieldAlert />} tone="danger" href="/certificates?view=expired" emphasis={expired > 0} />
    </StatGrid>
  );
}

export async function PipelineFunnel({ user, className }: { user: SessionUser; className?: string }) {
  const [t, ts] = await Promise.all([getTranslations("dashboard"), getTranslations("status")]);
  const since = new Date(Date.now() - 365 * DAY);
  const groups = await prisma.application.groupBy({
    by: ["status"],
    where: { AND: [applicationScope(user), { createdAt: { gte: since } }] },
    _count: { _all: true },
  });
  const reached = WORKFLOW_MILESTONES.map((m, i) => ({
    key: m,
    label: ts(`${m}.label`),
    value: groups.filter((g) => milestoneIndex(g.status) >= i).reduce((a, g) => a + g._count._all, 0),
  }));
  const submitted = reached[0].value || 1;
  const completion = Math.round((reached[reached.length - 1].value / submitted) * 100);
  const stuck = groups.filter((g) => ["RETURNED", "FAIL"].includes(g.status)).reduce((a, g) => a + g._count._all, 0);
  return (
    <Card className={className}>
      <CardHeader
        icon={<Gauge />}
        title={t("pipeline.title")}
        description={t("pipeline.desc")}
        action={<ViewAll href="/applications" label={t("viewAll")} />}
      />
      <CardBody className="grid gap-6 md:grid-cols-[1fr_12rem]">
        <Funnel stages={reached} />
        <dl className="grid grid-cols-2 gap-3 self-start md:grid-cols-1">
          <div className="rounded-lg bg-surface-subtle p-3">
            <dt className="text-caption text-fg-subtle">{t("pipeline.completion")}</dt>
            <dd className="mt-1 text-h2 text-fg tabular">{completion}%</dd>
          </div>
          <div className="rounded-lg bg-surface-subtle p-3">
            <dt className="text-caption text-fg-subtle">{t("pipeline.needsApplicant")}</dt>
            <dd className="mt-1 text-h2 text-fg tabular">{stuck}</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}

export async function AdminAlerts({ user }: { user: SessionUser }) {
  const [t, locale] = await Promise.all([getTranslations("dashboard.alerts"), getLocale()]);
  const now = new Date();
  const scope = applicationScope(user);
  const [expiring7, staleReview, conflicts, returned, rulesPending] = await Promise.all([
    prisma.certificate.count({ where: { AND: [certificateScope(user), { status: "ACTIVE", validUntil: { gte: now, lte: new Date(now.getTime() + 7 * DAY) } }] } }),
    prisma.application.count({ where: { AND: [scope, { status: inStatuses(APPLICATION_STAGE_GROUPS.needsReview), updatedAt: { lt: new Date(now.getTime() - 7 * DAY) } }] } }),
    prisma.verificationSchedule.count({ where: { AND: [scheduleScope(user), { status: "SCHEDULED", scheduledDate: { gte: startOfToday() }, conflictFlags: { not: Prisma.DbNull } }] } }),
    prisma.application.count({ where: { AND: [scope, { status: "RETURNED" }] } }),
    canAccessModule(user.role, "rules")
      ? prisma.legalRule.count({ where: { status: { in: ["CONFIGURATION_REQUIRED", "UNDER_REVIEW", "DRAFT"] } } })
      : Promise.resolve(0),
  ]);
  const items = [
    { key: "expiring7", count: expiring7, tone: "danger" as const, href: "/certificates?view=expiring", icon: AlarmClock },
    { key: "staleReview", count: staleReview, tone: "warning" as const, href: "/applications?view=needsReview&sort=updatedAt&dir=asc", icon: FileSearch },
    { key: "conflicts", count: conflicts, tone: "warning" as const, href: "/scheduling", icon: CalendarDays },
    { key: "returned", count: returned, tone: "info" as const, href: "/applications?status=RETURNED", icon: Undo2 },
    { key: "rulesPending", count: rulesPending, tone: "info" as const, href: "/rules", icon: Scale },
  ].filter((i) => i.count > 0);
  const toneCls = { danger: "bg-danger-50 text-danger-700", warning: "bg-warning-50 text-warning-700", info: "bg-info-50 text-info-700" };
  return (
    <Card>
      <CardHeader icon={<TriangleAlert />} title={t("title")} description={t("desc")} />
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-subtle">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", toneCls[i.tone])}>
                  <i.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body-sm font-medium text-fg">{t(`${i.key}.title`, { count: formatNumber(i.count, locale) })}</span>
                  <span className="block text-caption text-fg-subtle">{t(`${i.key}.desc`)}</span>
                </span>
                <ArrowRight className="size-4 text-fg-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={ClipboardCheck} title={t("clearTitle")} description={t("clearDesc")} />
      )}
    </Card>
  );
}

export async function VolumeTrend({ user, className }: { user: SessionUser; className?: string }) {
  const [t, locale] = await Promise.all([getTranslations("dashboard.trend"), getLocale()]);
  const weeks = 10;
  const start = startOfToday();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7);
  const [apps, certs] = await Promise.all([
    prisma.application.findMany({ where: { AND: [applicationScope(user), { createdAt: { gte: start } }] }, select: { createdAt: true }, take: 10_000 }),
    prisma.certificate.count({ where: { AND: [certificateScope(user), { verificationDate: { gte: start } }] } }),
  ]);
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const from = new Date(start.getTime() + i * 7 * DAY);
    return { from, value: 0 };
  });
  for (const a of apps) {
    const idx = Math.floor((a.createdAt.getTime() - start.getTime()) / (7 * DAY));
    if (buckets[idx]) buckets[idx].value++;
  }
  const fmt = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" });
  return (
    <Card className={className}>
      <CardHeader
        icon={<CalendarDays />}
        title={t("title")}
        description={t("desc", { weeks })}
        action={
          <div className="flex items-baseline gap-2 sm:block sm:text-right">
            <p className="text-h3 text-fg tabular">{formatNumber(apps.length, locale)}</p>
            <p className="text-caption text-fg-subtle">{t("certified", { count: formatNumber(certs, locale) })}</p>
          </div>
        }
      />
      <CardBody>
        <ColumnChart
          valueLabel={t("title")}
          data={buckets.map((b, i) => ({ label: fmt.format(b.from), value: b.value, highlight: i === buckets.length - 1 }))}
        />
      </CardBody>
    </Card>
  );
}

export async function CertificateHealth({ user }: { user: SessionUser }) {
  const [t, ts, locale] = await Promise.all([getTranslations("dashboard.health"), getTranslations("status"), getLocale()]);
  const now = new Date();
  const soon = new Date(now.getTime() + 90 * DAY);
  const scope = certificateScope(user);
  const [valid, expiring, expired, suspended, revoked] = await Promise.all([
    prisma.certificate.count({ where: { AND: [scope, { status: "ACTIVE" }, { OR: [{ validUntil: null }, { validUntil: { gt: soon } }] }] } }),
    prisma.certificate.count({ where: { AND: [scope, { status: "ACTIVE", validUntil: { gte: now, lte: soon } }] } }),
    prisma.certificate.count({ where: { AND: [scope, { OR: [{ status: "EXPIRED" }, { status: "ACTIVE", validUntil: { lt: now } }] }] } }),
    prisma.certificate.count({ where: { AND: [scope, { status: "SUSPENDED" }] } }),
    prisma.certificate.count({ where: { AND: [scope, { status: "REVOKED" }] } }),
  ]);
  const total = valid + expiring + expired + suspended + revoked;
  return (
    <Card>
      <CardHeader icon={<Award />} title={t("title")} description={t("desc")} action={<ViewAll href="/certificates" label={t("open")} />} />
      <CardBody>
        {total ? (
          <Donut
            centerValue={formatNumber(total, locale)}
            centerLabel={t("total")}
            segments={[
              { key: "valid", label: ts("VALID.label"), value: valid, tone: "success" },
              { key: "expiring", label: t("expiring90"), value: expiring, tone: "warning" },
              { key: "expired", label: ts("EXPIRED.label"), value: expired, tone: "neutral" },
              { key: "suspended", label: ts("SUSPENDED.label"), value: suspended, tone: "info" },
              { key: "revoked", label: ts("REVOKED.label"), value: revoked, tone: "danger" },
            ]}
          />
        ) : (
          <EmptyState compact icon={Award} title={t("emptyTitle")} description={t("emptyDesc")} />
        )}
      </CardBody>
    </Card>
  );
}

export async function WorkloadPanel({ user }: { user: SessionUser }) {
  const [t, tr] = await Promise.all([getTranslations("dashboard.workload"), getTranslations("roles")]);
  const today = startOfToday();
  const horizon = new Date(today.getTime() + 14 * DAY);
  const grouped = await prisma.verificationAssignment.groupBy({
    by: ["officerId"],
    where: {
      officerId: { not: null },
      application: applicationScope(user),
      schedules: { some: { status: "SCHEDULED", scheduledDate: { gte: today, lt: horizon } } },
    },
    _count: { _all: true },
    orderBy: { _count: { officerId: "desc" } },
    take: 8,
  });
  const officers = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.officerId!) } },
    select: { id: true, name: true, role: true, state: { select: { code: true } } },
  });
  const byId = new Map(officers.map((o) => [o.id, o]));
  const capacity = 6 * 10;
  return (
    <Card>
      <CardHeader icon={<Navigation />} title={t("title")} description={t("desc")} action={<ViewAll href="/scheduling" label={t("open")} />} />
      <CardBody>
        {grouped.length ? (
          <BarList
            data={grouped.map((g) => {
              const o = byId.get(g.officerId!);
              const load = g._count._all / capacity;
              return {
                key: g.officerId!,
                label: o ? `${o.name}` : "—",
                value: g._count._all,
                tone: load > 0.8 ? "danger" : load > 0.5 ? "warning" : "brand",
                hint: o ? `${tr(o.role)}${o.state?.code ? ` · ${o.state.code}` : ""}` : undefined,
              };
            })}
          />
        ) : (
          <EmptyState compact icon={Navigation} title={t("emptyTitle")} description={t("emptyDesc")} />
        )}
      </CardBody>
    </Card>
  );
}

export async function GeographyPanel({ user }: { user: SessionUser }) {
  const [t, locale] = await Promise.all([getTranslations("dashboard.geography"), getLocale()]);
  const open = [...APPLICATION_STAGE_GROUPS.needsReview, ...APPLICATION_STAGE_GROUPS.readyToSchedule, ...APPLICATION_STAGE_GROUPS.inField, ...APPLICATION_STAGE_GROUPS.certification];
  const grouped = await prisma.instrument.groupBy({
    by: ["stateId"],
    where: { AND: [instrumentScope(user), { applications: { some: { AND: [applicationScope(user), { status: inStatuses(open) }] } } }] },
    _count: { _all: true },
    orderBy: { _count: { stateId: "desc" } },
    take: 8,
  });
  const states = await prisma.state.findMany({
    where: { id: { in: grouped.map((g) => g.stateId).filter((x): x is string => !!x) } },
    select: { id: true, name: true, nameHi: true, code: true },
  });
  const byId = new Map(states.map((s) => [s.id, s]));
  return (
    <Card>
      <CardHeader icon={<MapPin />} title={t("title")} description={t("desc")} action={<ViewAll href="/scheduling?view=map" label={t("open")} />} />
      <CardBody>
        {grouped.length ? (
          <BarList
            data={grouped.map((g) => {
              const s = g.stateId ? byId.get(g.stateId) : undefined;
              return { key: g.stateId ?? "none", label: s ? (locale === "hi" && s.nameHi ? s.nameHi : s.name) : t("unknown"), value: g._count._all, tone: "info" };
            })}
          />
        ) : (
          <EmptyState compact icon={MapPin} title={t("emptyTitle")} description={t("emptyDesc")} />
        )}
      </CardBody>
    </Card>
  );
}

export async function ActivityFeed({ user }: { user: SessionUser }) {
  const [t, tr, locale] = await Promise.all([getTranslations("dashboard.activity"), getTranslations("roles"), getLocale()]);
  if (canAccessModule(user.role, "audit")) {
    const logs = await prisma.auditLog.findMany({
      where: auditScope(user),
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, entity: true, createdAt: true, actor: { select: { name: true, role: true } } },
    });
    return (
      <Card>
        <CardHeader icon={<History />} title={t("title")} description={t("desc")} action={<ViewAll href="/audit" label={t("open")} />} />
        {logs.length ? (
          <ul className="divide-y divide-line">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-2.5 text-body-sm">
                <span className="size-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-fg">{l.actor?.name ?? t("system")}</span>{" "}
                  <span className="text-fg-muted">{t.has(`actions.${l.action}`) ? t(`actions.${l.action}`) : l.action.replaceAll("_", " ").toLowerCase()}</span>
                  {l.actor ? <span className="text-fg-faint"> · {tr(l.actor.role)}</span> : null}
                </span>
                <time className="shrink-0 text-caption text-fg-subtle" dateTime={l.createdAt.toISOString()}>
                  {formatRelative(l.createdAt, locale)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={History} title={t("emptyTitle")} />
        )}
      </Card>
    );
  }
  return null;
}

// ---------------------------------------------------------------- field officer

export async function FieldKpis({ user }: { user: SessionUser }) {
  const [t, locale] = await Promise.all([getTranslations("dashboard.kpi"), getLocale()]);
  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + DAY);
  const week = new Date(today.getTime() + 7 * DAY);
  const mine = { assignment: { officerId: user.id } };
  const [todayCount, weekCount, done30, inProgress] = await Promise.all([
    prisma.verificationSchedule.count({ where: { ...mine, status: "SCHEDULED", scheduledDate: { gte: today, lt: tomorrow } } }),
    prisma.verificationSchedule.count({ where: { ...mine, status: "SCHEDULED", scheduledDate: { gte: today, lt: week } } }),
    prisma.inspection.count({ where: { officerId: user.id, completedAt: { gte: new Date(Date.now() - 30 * DAY) } } }),
    prisma.application.count({ where: { AND: [applicationScope(user), { status: inStatuses(["FIELD_VERIFICATION", "PASS", "STAMPING"]) }] } }),
  ]);
  const n = (v: number) => formatNumber(v, locale);
  return (
    <StatGrid>
      <StatCard label={t("today")} value={n(todayCount)} hint={t("todayHint")} icon={<CalendarDays />} tone="brand" href="/verification" emphasis={todayCount > 0} />
      <StatCard label={t("next7")} value={n(weekCount)} hint={t("next7Hint")} icon={<CalendarClock />} tone="info" href="/scheduling" />
      <StatCard label={t("inProgress")} value={n(inProgress)} hint={t("inProgressHint")} icon={<ClipboardCheck />} tone="warning" href="/verification?view=inProgress" emphasis={inProgress > 0} />
      <StatCard label={t("completed30")} value={n(done30)} hint={t("completed30Hint")} icon={<Award />} tone="success" href="/verification?view=history" />
    </StatGrid>
  );
}

async function visitsFor(user: SessionUser, from: Date, to: Date, take: number) {
  return prisma.verificationSchedule.findMany({
    where: { AND: [user.role === "BUSINESS_USER" ? scheduleScope(user) : { assignment: { officerId: user.id } }, { status: "SCHEDULED", scheduledDate: { gte: from, lt: to } }] },
    orderBy: [{ scheduledDate: "asc" }, { timeSlot: "asc" }],
    take,
    select: {
      id: true,
      scheduledDate: true,
      timeSlot: true,
      application: {
        select: {
          id: true,
          applicationNumber: true,
          status: true,
          organization: { select: { name: true } },
          instrument: { select: { address: true, locationLabel: true, latitude: true, longitude: true, instrumentType: { select: { name: true, nameHi: true } } } },
        },
      },
      assignment: { select: { officer: { select: { name: true } } } },
    },
  });
}

export async function FieldToday({ user, className }: { user: SessionUser; className?: string }) {
  const [t, locale] = await Promise.all([getTranslations("dashboard.field"), getLocale()]);
  const today = startOfToday();
  const visits = await visitsFor(user, today, new Date(today.getTime() + DAY), 12);
  return (
    <Card className={className}>
      <CardHeader icon={<Navigation />} title={t("todayTitle")} description={t("todayDesc", { count: visits.length })} action={<ViewAll href="/verification" label={t("all")} />} />
      {visits.length ? (
        <ol className="divide-y divide-line">
          {visits.map((v, i) => {
            const inst = v.application.instrument;
            const mapHref = inst.latitude != null ? `https://www.openstreetmap.org/?mlat=${inst.latitude}&mlon=${inst.longitude}#map=17/${inst.latitude}/${inst.longitude}` : null;
            return (
              <li key={v.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-body-sm font-semibold text-brand-800 tabular">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-fg">{v.application.organization.name}</span>
                    <StatusBadge status={v.application.status} />
                  </p>
                  <p className="mt-0.5 text-body-sm text-fg-muted">
                    {locale === "hi" && inst.instrumentType.nameHi ? inst.instrumentType.nameHi : inst.instrumentType.name} · {v.timeSlot ?? "—"}
                  </p>
                  <p className="mt-0.5 truncate text-caption text-fg-subtle">{inst.address ?? inst.locationLabel}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {mapHref ? (
                    <a href={mapHref} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      <MapPin /> {t("navigate")}
                    </a>
                  ) : null}
                  <Link href={`/verification/${v.application.id}`} className={buttonVariants({ size: "sm" })}>
                    {t("start")}
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState compact icon={CalendarDays} title={t("noneTodayTitle")} description={t("noneTodayDesc")} />
      )}
    </Card>
  );
}

export async function FieldUpcoming({ user, className }: { user: SessionUser; className?: string }) {
  const [t, locale] = await Promise.all([getTranslations("dashboard.field"), getLocale()]);
  const tomorrow = new Date(startOfToday().getTime() + DAY);
  const visits = await visitsFor(user, tomorrow, new Date(tomorrow.getTime() + 13 * DAY), 8);
  return (
    <Card className={className}>
      <CardHeader icon={<CalendarClock />} title={t("upcomingTitle")} description={t("upcomingDesc")} />
      {visits.length ? (
        <ul className="divide-y divide-line">
          {visits.map((v) => (
            <li key={v.id}>
              <Link href={`/verification/${v.application.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-subtle">
                <span className="w-12 shrink-0 text-center">
                  <span className="block text-caption uppercase text-fg-subtle">
                    {new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { weekday: "short" }).format(v.scheduledDate)}
                  </span>
                  <span className="block text-h4 text-fg tabular">{v.scheduledDate.getDate()}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-medium text-fg">{v.application.organization.name}</span>
                  <span className="block truncate text-caption text-fg-subtle">
                    {v.application.applicationNumber} · {v.timeSlot ?? "—"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={CalendarClock} title={t("noneUpcoming")} />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- business user

export async function BusinessKpis({ user }: { user: SessionUser }) {
  const [t, locale] = await Promise.all([getTranslations("dashboard.kpi"), getLocale()]);
  const now = new Date();
  const [instruments, active, due, inProgress] = await Promise.all([
    prisma.instrument.count({ where: instrumentScope(user) }),
    prisma.certificate.count({ where: { AND: [certificateScope(user), { status: "ACTIVE" }, { OR: [{ validUntil: null }, { validUntil: { gte: now } }] }] } }),
    prisma.certificate.count({ where: { AND: [certificateScope(user), { status: "ACTIVE", validUntil: { lte: new Date(now.getTime() + 60 * DAY) } }] } }),
    prisma.application.count({
      where: {
        AND: [
          applicationScope(user),
          { status: inStatuses([...APPLICATION_STAGE_GROUPS.needsReview, ...APPLICATION_STAGE_GROUPS.readyToSchedule, ...APPLICATION_STAGE_GROUPS.inField, ...APPLICATION_STAGE_GROUPS.certification]) },
        ],
      },
    }),
  ]);
  const n = (v: number) => formatNumber(v, locale);
  return (
    <StatGrid>
      <StatCard label={t("myInstruments")} value={n(instruments)} hint={t("myInstrumentsHint")} icon={<Scale />} tone="brand" href="/instruments" />
      <StatCard label={t("validCertificates")} value={n(active)} hint={t("validCertificatesHint")} icon={<Award />} tone="success" href="/certificates" />
      <StatCard label={t("dueSoon")} value={n(due)} hint={t("dueSoonHint")} icon={<AlarmClock />} tone="warning" href="/certificates?view=expiring" emphasis={due > 0} />
      <StatCard label={t("inProgressApps")} value={n(inProgress)} hint={t("inProgressAppsHint")} icon={<ClipboardCheck />} tone="info" href="/applications?view=open" />
    </StatGrid>
  );
}

export async function BusinessActionRequired({ user, className }: { user: SessionUser; className?: string }) {
  const [t, locale] = await Promise.all([getTranslations("dashboard.action"), getLocale()]);
  const now = new Date();
  const [returned, expiring, drafts] = await Promise.all([
    prisma.application.findMany({
      where: { AND: [applicationScope(user), { status: inStatuses(["RETURNED", "FAIL"]) }] },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: { id: true, applicationNumber: true, status: true, updatedAt: true, instrument: { select: { instrumentType: { select: { name: true } }, serialNumber: true } } },
    }),
    prisma.certificate.findMany({
      where: { AND: [certificateScope(user), { status: { in: ["ACTIVE", "EXPIRED"] }, validUntil: { lte: new Date(now.getTime() + 60 * DAY) } }] },
      take: 5,
      orderBy: { validUntil: "asc" },
      select: { id: true, certificateNumber: true, validUntil: true, instrumentId: true, instrument: { select: { instrumentType: { select: { name: true } }, serialNumber: true } } },
    }),
    prisma.application.findMany({
      where: { AND: [applicationScope(user), { status: "DRAFT" }] },
      take: 3,
      orderBy: { updatedAt: "desc" },
      select: { id: true, applicationNumber: true, updatedAt: true, instrument: { select: { instrumentType: { select: { name: true } } } } },
    }),
  ]);
  const rows = [
    ...returned.map((a) => ({
      key: a.id,
      href: `/applications/${a.id}`,
      tone: a.status === "FAIL" ? "danger" : "warning",
      title: t(a.status === "FAIL" ? "failed" : "returned", { number: a.applicationNumber }),
      sub: `${a.instrument.instrumentType.name} · ${a.instrument.serialNumber}`,
      cta: t(a.status === "FAIL" ? "reapply" : "fix"),
    })),
    ...expiring.map((c) => {
      const d = daysUntil(c.validUntil) ?? 0;
      return {
        key: c.id,
        href: `/applications/new?instrument=${c.instrumentId}&type=RE_VERIFICATION`,
        tone: d < 0 ? "danger" : "warning",
        title: d < 0 ? t("expired", { number: c.certificateNumber }) : t("expiring", { number: c.certificateNumber, days: d }),
        sub: `${c.instrument.instrumentType.name} · ${t("validUntil", { date: formatDate(c.validUntil, locale) })}`,
        cta: t("reverify"),
      };
    }),
    ...drafts.map((a) => ({
      key: a.id,
      href: `/applications/${a.id}`,
      tone: "neutral",
      title: t("draft", { number: a.applicationNumber }),
      sub: `${a.instrument.instrumentType.name} · ${formatRelative(a.updatedAt, locale)}`,
      cta: t("continue"),
    })),
  ];
  const dot = { danger: "bg-danger-500", warning: "bg-warning-500", neutral: "bg-ink-300" } as Record<string, string>;
  return (
    <Card className={className}>
      <CardHeader icon={<TriangleAlert />} title={t("title")} description={t("desc")} />
      {rows.length ? (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-3 px-5 py-3">
              <span className={cn("size-2 shrink-0 rounded-full", dot[r.tone])} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-medium text-fg">{r.title}</span>
                <span className="block truncate text-caption text-fg-subtle">{r.sub}</span>
              </span>
              <Link href={r.href} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                {r.cta}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={ClipboardCheck} title={t("clearTitle")} description={t("clearDesc")} />
      )}
    </Card>
  );
}

export async function UpcomingVisits({ user, className }: { user: SessionUser; className?: string }) {
  const [t, locale] = await Promise.all([getTranslations("dashboard.visits"), getLocale()]);
  const visits = await visitsFor(user, startOfToday(), new Date(Date.now() + 30 * DAY), 5);
  return (
    <Card className={className}>
      <CardHeader icon={<CalendarClock />} title={t("title")} description={t("desc")} />
      {visits.length ? (
        <ul className="divide-y divide-line">
          {visits.map((v) => (
            <li key={v.id}>
              <Link href={`/applications/${v.application.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-subtle">
                <span className="w-14 shrink-0 rounded-md bg-brand-50 py-1 text-center text-brand-800">
                  <span className="block text-caption uppercase">
                    {new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { month: "short" }).format(v.scheduledDate)}
                  </span>
                  <span className="block text-h4 tabular">{v.scheduledDate.getDate()}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-medium text-fg">
                    {locale === "hi" && v.application.instrument.instrumentType.nameHi ? v.application.instrument.instrumentType.nameHi : v.application.instrument.instrumentType.name}
                  </span>
                  <span className="block truncate text-caption text-fg-subtle">
                    {v.timeSlot ?? "—"} · {v.assignment?.officer?.name ?? t("officerTbc")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={CalendarClock} title={t("emptyTitle")} description={t("emptyDesc")} />
      )}
    </Card>
  );
}

export async function BusinessRecent({ user }: { user: SessionUser }) {
  const [t, locale] = await Promise.all([getTranslations("dashboard.recent"), getLocale()]);
  const apps = await prisma.application.findMany({
    where: applicationScope(user),
    orderBy: { updatedAt: "desc" },
    take: 6,
    select: { id: true, applicationNumber: true, status: true, updatedAt: true, verificationType: true, instrument: { select: { serialNumber: true, instrumentType: { select: { name: true, nameHi: true } } } } },
  });
  return (
    <Card>
      <CardHeader icon={<History />} title={t("title")} description={t("desc")} action={<ViewAll href="/applications" label={t("all")} />} />
      {apps.length ? (
        <ul className="divide-y divide-line">
          {apps.map((a) => (
            <li key={a.id}>
              <Link href={`/applications/${a.id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-subtle sm:grid-cols-[12rem_1fr_auto_7rem]">
                <span className="font-mono text-[0.8125rem] text-fg">{a.applicationNumber}</span>
                <span className="hidden min-w-0 truncate text-body-sm text-fg-muted sm:block">
                  {locale === "hi" && a.instrument.instrumentType.nameHi ? a.instrument.instrumentType.nameHi : a.instrument.instrumentType.name} · {a.instrument.serialNumber}
                </span>
                <StatusBadge status={a.status} />
                <span className="hidden text-right text-caption text-fg-subtle sm:block">{formatRelative(a.updatedAt, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={ClipboardCheck}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={
            <Link href="/applications/new" className={buttonVariants()}>
              {t("start")}
            </Link>
          }
        />
      )}
    </Card>
  );
}
