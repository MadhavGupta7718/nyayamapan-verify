import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Award, BarChart3, CalendarRange, Download, FileStack, QrCode, TimerReset, Users } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { guard } from "@/server/access";
import { applicationScope, certificateScope, scheduleScope } from "@/server/scope";
import { formatNumber } from "@/lib/utils";
import { statusDef } from "@/lib/status";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { BarList, Donut } from "@/components/charts/charts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("reports") };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user, denied } = await guard("reports");
  if (denied) return denied;
  const [t, ts, locale, sp] = await Promise.all([getTranslations("reports"), getTranslations("status"), getLocale(), searchParams]);

  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const from = sp.from && ISO.test(sp.from) ? sp.from : defaultFrom.toISOString().slice(0, 10);
  const to = sp.to && ISO.test(sp.to) ? sp.to : today.toISOString().slice(0, 10);
  const range = { gte: new Date(from), lte: new Date(`${to}T23:59:59`) };

  const appWhere: Prisma.ApplicationWhereInput = { AND: [applicationScope(user), { createdAt: range }] };
  const certWhere: Prisma.CertificateWhereInput = { AND: [certificateScope(user), { verificationDate: range }] };

  const [byStatus, certs, passCount, failCount, publicChecks, schedules, byType] = await Promise.all([
    prisma.application.groupBy({ by: ["status"], where: appWhere, _count: { _all: true } }),
    prisma.certificate.count({ where: certWhere }),
    prisma.inspection.count({ where: { overallResult: "PASS", completedAt: range, application: applicationScope(user) } }),
    prisma.inspection.count({ where: { overallResult: "FAIL", completedAt: range, application: applicationScope(user) } }),
    prisma.publicVerification.count({ where: { verifiedAt: range, qrToken: { certificate: certificateScope(user) } } }),
    prisma.verificationSchedule.groupBy({ by: ["status"], where: { AND: [scheduleScope(user), { scheduledDate: range }] }, _count: { _all: true } }),
    prisma.application.findMany({
      where: appWhere,
      take: 5000,
      select: { instrument: { select: { instrumentType: { select: { name: true, nameHi: true } }, state: { select: { name: true, nameHi: true } } } } },
    }),
  ]);

  const totalApps = byStatus.reduce((a, s) => a + s._count._all, 0);
  const decided = passCount + failCount;
  const tally = (pick: (r: (typeof byType)[number]) => { name: string; nameHi: string | null } | null) => {
    const m = new Map<string, number>();
    for (const r of byType) {
      const x = pick(r);
      const k = x ? (locale === "hi" && x.nameHi ? x.nameHi : x.name) : "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  };
  const types = tally((r) => r.instrument.instrumentType);
  const states = tally((r) => r.instrument.state);
  const completedVisits = schedules.find((s) => s.status === "COMPLETED")?._count._all ?? 0;
  const totalVisits = schedules.reduce((a, s) => a + s._count._all, 0);

  const exports = [
    { type: "applications", icon: FileStack },
    { type: "certificates", icon: Award },
    { type: "expiring", icon: TimerReset },
    { type: "expired", icon: TimerReset },
    { type: "workload", icon: Users },
    { type: "public-verifications", icon: QrCode },
  ] as const;
  const qs = new URLSearchParams({ from, to }).toString();

  return (
    <>
      <PageHeader title={t("title")} description={t("desc")} />

      <Card className="mb-6">
        <form className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end" method="get">
          <label className="flex-1 sm:max-w-[12rem]">
            <span className="mb-1 block text-label text-fg-muted">{t("from")}</span>
            <Input type="date" name="from" defaultValue={from} max={to} />
          </label>
          <label className="flex-1 sm:max-w-[12rem]">
            <span className="mb-1 block text-label text-fg-muted">{t("to")}</span>
            <Input type="date" name="to" defaultValue={to} min={from} />
          </label>
          <Button type="submit" variant="secondary">
            <CalendarRange /> {t("apply")}
          </Button>
          <p className="text-caption text-fg-subtle sm:ml-auto">{t("scopeNote")}</p>
        </form>
      </Card>

      <StatGrid className="mb-6">
        <StatCard label={t("kpi.applications")} value={formatNumber(totalApps, locale)} icon={<FileStack />} tone="brand" />
        <StatCard label={t("kpi.certificates")} value={formatNumber(certs, locale)} icon={<Award />} tone="success" />
        <StatCard
          label={t("kpi.passRate")}
          value={decided ? `${Math.round((passCount / decided) * 100)}%` : "—"}
          hint={t("kpi.passRateHint", { pass: passCount, fail: failCount })}
          icon={<BarChart3 />}
          tone="info"
        />
        <StatCard label={t("kpi.publicChecks")} value={formatNumber(publicChecks, locale)} icon={<QrCode />} tone="neutral" />
      </StatGrid>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title={t("charts.status")} />
          <CardBody>
            {totalApps ? (
              <Donut
                centerValue={totalApps}
                centerLabel={t("charts.total")}
                segments={byStatus
                  .sort((a, b) => b._count._all - a._count._all)
                  .slice(0, 7)
                  .map((s) => ({ key: s.status, label: ts(`${s.status}.label`), value: s._count._all, tone: statusDef(s.status).tone }))}
              />
            ) : (
              <EmptyState compact icon={BarChart3} title={t("noData")} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("charts.byType")} />
          <CardBody>{types.length ? <BarList data={types.map(([label, value]) => ({ label, value, key: label }))} /> : <EmptyState compact icon={BarChart3} title={t("noData")} />}</CardBody>
        </Card>
        <Card>
          <CardHeader title={user.role === "SUPER_ADMIN" || user.role === "AUDITOR" ? t("charts.byState") : t("charts.visits")} />
          <CardBody>
            {user.role === "SUPER_ADMIN" || user.role === "AUDITOR" ? (
              states.length ? (
                <BarList data={states.map(([label, value]) => ({ label, value, key: label, tone: "info" as const }))} />
              ) : (
                <EmptyState compact icon={BarChart3} title={t("noData")} />
              )
            ) : totalVisits ? (
              <BarList
                data={schedules.map((s) => ({ key: s.status, label: ts.has(`${s.status}.label`) ? ts(`${s.status}.label`) : s.status, value: s._count._all, tone: statusDef(s.status).tone }))}
              />
            ) : (
              <EmptyState compact icon={BarChart3} title={t("noData")} />
            )}
            {totalVisits ? <p className="mt-4 text-caption text-fg-subtle">{t("visitsCompleted", { done: completedVisits, total: totalVisits })}</p> : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader icon={<Download />} title={t("exports.title")} description={t("exports.desc")} />
        <ul className="grid gap-px overflow-hidden rounded-b-xl bg-line sm:grid-cols-2 lg:grid-cols-3">
          {exports.map(({ type, icon: Icon }) => (
            <li key={type} className="flex items-start gap-3 bg-surface p-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">{t(`exports.${type}.title`)}</p>
                <p className="mt-0.5 text-caption text-fg-subtle">{t(`exports.${type}.desc`)}</p>
                <a href={`/api/reports?type=${type}&${qs}`} download className="mt-2 inline-flex items-center gap-1.5 text-body-sm font-medium text-brand-700 hover:text-brand-900">
                  <Download className="size-3.5" /> {t("exports.csv")}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
