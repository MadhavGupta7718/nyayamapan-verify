import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ShieldCheck, UserRound } from "lucide-react";
import { prisma } from "@/db/client";
import { guard } from "@/server/access";
import { formatDate, formatDateTime, initials } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, DetailList } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PasswordForm, PreferencesForm } from "@/components/profile/profile-forms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("profile") };
}

export default async function ProfilePage() {
  const { user, denied } = await guard("profile");
  if (denied) return denied;
  const [t, tr, locale] = await Promise.all([getTranslations("profile"), getTranslations("roles"), getLocale()]);
  const [me, recent] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        name: true,
        email: true,
        mobile: true,
        role: true,
        status: true,
        locale: true,
        preferences: true,
        lastLoginAt: true,
        createdAt: true,
        organization: { select: { name: true } },
        state: { select: { name: true, nameHi: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { actorId: user.id, action: { in: ["LOGIN", "LOGIN_FAILED", "PASSWORD_CHANGED", "PROFILE_UPDATED"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, action: true, createdAt: true, ip: true },
    }),
  ]);
  const prefs = (me.preferences ?? {}) as { emailAlerts?: boolean; expiryDigest?: boolean };

  return (
    <>
      <PageHeader title={t("title")} description={t("desc")} />
      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardBody className="flex flex-col items-center py-6 text-center">
              <span className="grid size-16 place-items-center rounded-full bg-brand-800 text-h3 font-semibold text-white">{initials(me.name)}</span>
              <p className="mt-3 text-h4 text-fg">{me.name}</p>
              <p className="text-body-sm text-fg-subtle">{me.email}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-caption font-medium text-brand-800">{tr(me.role)}</span>
                <StatusBadge status={me.status} />
              </div>
            </CardBody>
            <div className="border-t border-line px-5 py-4">
              <DetailList
                columns={1}
                items={[
                  { label: t("organization"), value: me.organization?.name ?? (me.state ? (locale === "hi" && me.state.nameHi ? me.state.nameHi : me.state.name) : null) },
                  { label: t("memberSince"), value: formatDate(me.createdAt, locale) },
                  { label: t("lastLogin"), value: formatDateTime(me.lastLoginAt, locale) },
                ]}
              />
            </div>
          </Card>
          <Card>
            <CardHeader icon={<ShieldCheck />} title={t("activity")} />
            {recent.length ? (
              <ul className="divide-y divide-line">
                {recent.map((r) => (
                  <li key={r.id} className="px-5 py-2.5">
                    <p className="text-body-sm text-fg">{t.has(`events.${r.action}`) ? t(`events.${r.action}`) : r.action}</p>
                    <p className="text-caption text-fg-subtle">
                      {formatDateTime(r.createdAt, locale)}
                      {r.ip ? ` · ${r.ip}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="flex items-center gap-2 text-body-sm text-fg-subtle">
                  <UserRound className="size-4" /> {t("noActivity")}
                </p>
              </CardBody>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <PreferencesForm
            initial={{
              name: me.name,
              mobile: me.mobile ?? "",
              locale: me.locale === "hi" ? "hi" : "en",
              emailAlerts: prefs.emailAlerts ?? true,
              expiryDigest: prefs.expiryDigest ?? true,
            }}
          />
          <PasswordForm />
        </div>
      </div>
    </>
  );
}
