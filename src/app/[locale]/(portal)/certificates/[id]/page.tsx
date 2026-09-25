import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { Ban, BookOpenCheck, History, QrCode, ShieldAlert, ShieldCheck } from "lucide-react";
import { prisma } from "@/db/client";
import { Link } from "@/i18n/routing";
import { guard } from "@/server/access";
import { getSessionUser } from "@/server/session";
import { certificateScope } from "@/server/scope";
import { platformConfig, publicVerifyUrl } from "@/server/config";
import { checkIntegrity, loadCertificate } from "@/services/certificates";
import { publicStatusOf } from "@/lib/certificate-status";
import { cn, daysUntil, formatDate, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, DetailList } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { InlineAlert } from "@/components/ui/states";
import { CertificateActions } from "@/components/certificates/certificate-actions";

type Params = { params: Promise<{ id: string }> };

function describeValidityMethod(method: string | null, t: (key: string, values?: Record<string, number>) => string) {
  if (!method) return null;
  if (method === "CONFIGURATION_REQUIRED") return t("validityNotConfigured");
  const months = /^add_months:(\d+)$/.exec(method)?.[1];
  return months ? t("basis.addMonths", { months: Number(months) }) : method;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const [{ id }, user] = await Promise.all([params, getSessionUser()]);
  if (!user) return { title: (await getTranslations("certificates"))("title") };
  const c = await prisma.certificate.findFirst({ where: { AND: [{ id }, certificateScope(user)] }, select: { certificateNumber: true } }).catch(() => null);
  if (!c) notFound();
  return { title: c.certificateNumber };
}

export default async function CertificateDetailPage({ params }: Params) {
  const { user, denied } = await guard("certificates");
  if (denied) return denied;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const allowed = await prisma.certificate.findFirst({ where: { AND: [{ id }, certificateScope(user)] }, select: { id: true } });
  if (!allowed) notFound();

  const [t, locale, cert, history, verifications] = await Promise.all([
    getTranslations("certificates"),
    getLocale(),
    loadCertificate(id),
    prisma.certificateRevocation.findMany({ where: { certificateId: id }, orderBy: { revokedAt: "desc" }, take: 20, select: { id: true, reason: true, revokedAt: true } }),
    prisma.publicVerification.count({ where: { qrToken: { certificateId: id } } }),
  ]);
  if (!cert) notFound();

  const integrity = await checkIntegrity(cert);
  const status = publicStatusOf(cert);
  const verifyUrl = cert.qrToken ? publicVerifyUrl(cert.qrToken.token) : null;
  const qrSvg = verifyUrl ? await QRCode.toString(verifyUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0b1f3a", light: "#ffffff00" } }) : null;
  const typeName = locale === "hi" && cert.instrument.instrumentType.nameHi ? cert.instrument.instrumentType.nameHi : cert.instrument.instrumentType.name;
  const days = daysUntil(cert.validUntil);
  const canManage = user.role === "SUPER_ADMIN" || user.role === "STATE_ADMIN";
  const authority = cert.issuingAuthority ?? platformConfig.issuingAuthority;
  const rule = cert.ruleVersion?.legalRule;

  const banner =
    status === "REVOKED" || status === "SUSPENDED" ? (
      <InlineAlert tone={status === "REVOKED" ? "danger" : "warning"} icon={<Ban />} className="mb-6" title={t(`banner.${status}`)}>
        {cert.revocations[0] ? `${formatDate(cert.revocations[0].revokedAt, locale)} — ${cert.revocations[0].reason.replace(/^\[\w+\]\s*/, "")}` : null}
      </InlineAlert>
    ) : status === "EXPIRED" ? (
      <InlineAlert tone="warning" className="mb-6" title={t("banner.EXPIRED")}>
        {t("banner.expiredBody")}
      </InlineAlert>
    ) : !cert.validUntil ? (
      <InlineAlert tone="warning" className="mb-6" title={t("banner.noValidity")}>
        {t("banner.noValidityBody")}
      </InlineAlert>
    ) : days != null && days <= 90 ? (
      <InlineAlert tone="warning" className="mb-6" title={t("banner.expiring", { days })}>
        {t("banner.expiringBody")}
      </InlineAlert>
    ) : null;

  return (
    <>
      <nav className="mb-2 text-body-sm">
        <Link href="/certificates" className="text-fg-subtle hover:text-fg">
          ← {t("backToList")}
        </Link>
      </nav>
      <PageHeader
        eyebrow={typeName}
        title={<span className="font-mono tracking-tight">{cert.certificateNumber}</span>}
        description={`${cert.instrument.manufacturer} ${cert.instrument.modelName} · ${cert.instrument.serialNumber}`}
        meta={<StatusBadge status={status} size="md" />}
        actions={<CertificateActions id={cert.id} number={cert.certificateNumber} verifyUrl={verifyUrl} status={cert.status} canManage={canManage} />}
      />
      {banner}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <article
          aria-label={t("preview")}
          className={cn(
            "relative overflow-hidden rounded-xl border border-line bg-white shadow-sm",
            (status === "REVOKED" || status === "SUSPENDED") && "opacity-90"
          )}
        >
          <div className="h-1.5 bg-gradient-to-r from-brand-800 via-brand-600 to-accent" />
          {status !== "VALID" ? (
            <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="-rotate-12 rounded-lg border-4 border-danger-500/40 px-6 py-2 text-[3rem] font-black uppercase tracking-widest text-danger-500/25">
                {t(`watermark.${status}`)}
              </span>
            </div>
          ) : null}
          <div className="px-6 py-8 sm:px-10">
            <header className="flex flex-col gap-6 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-overline uppercase tracking-[0.14em] text-fg-subtle">{authority}</p>
                <h2 className="mt-2 text-h2 text-fg">{t("docTitle")}</h2>
                <p className="mt-1 text-body-sm text-fg-muted">{t("docSubtitle")}</p>
              </div>
              {qrSvg ? (
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                  <div className="size-28 rounded-lg border border-line bg-white p-2 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                  <span className="text-caption text-fg-subtle">{t("scanToVerify")}</span>
                </div>
              ) : null}
            </header>

            <dl className="grid gap-x-8 gap-y-5 py-6 sm:grid-cols-2">
              {[
                [t("doc.certificateNumber"), <span key="n" className="font-mono">{cert.certificateNumber}</span>],
                [t("doc.applicationNumber"), <span key="a" className="font-mono">{cert.application.applicationNumber}</span>],
                [t("doc.holder"), cert.application.organization.name],
                [t("doc.site"), [cert.instrument.locationLabel, cert.instrument.address].filter(Boolean).join(", ") || "—"],
                [t("doc.instrumentType"), typeName],
                [t("doc.makeModel"), `${cert.instrument.manufacturer} ${cert.instrument.modelName}`],
                [t("doc.serial"), <span key="s" className="font-mono">{cert.instrument.serialNumber}</span>],
                [t("doc.capacity"), [cert.instrument.capacity, cert.instrument.accuracy].filter(Boolean).join(" · ") || "—"],
              ].map(([label, value], i) => (
                <div key={i} className="min-w-0">
                  <dt className="text-caption text-fg-subtle">{label}</dt>
                  <dd className="mt-0.5 break-words text-body text-fg">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-4 rounded-lg bg-surface-subtle p-4 sm:grid-cols-3">
              <div>
                <p className="text-caption text-fg-subtle">{t("doc.result")}</p>
                <p className="mt-1">
                  <StatusBadge status={cert.result} size="md" withTooltip={false} />
                </p>
              </div>
              <div>
                <p className="text-caption text-fg-subtle">{t("doc.verifiedOn")}</p>
                <p className="mt-1 text-body font-semibold text-fg">{formatDate(cert.verificationDate, locale)}</p>
              </div>
              <div>
                <p className="text-caption text-fg-subtle">{t("doc.validUntil")}</p>
                <p className={cn("mt-1 text-body font-semibold", cert.validUntil ? "text-fg" : "text-warning-700")}>
                  {cert.validUntil ? formatDate(cert.validUntil, locale) : t("validityNotConfigured")}
                </p>
              </div>
            </div>

            <footer className="mt-6 flex flex-col gap-2 border-t border-line pt-5 text-caption text-fg-subtle sm:flex-row sm:justify-between">
              <span>
                {t("doc.officer")}: <span className="text-fg-muted">{cert.officerName ?? "—"}</span>
              </span>
              {verifyUrl ? <span className="break-all font-mono">{verifyUrl.replace(/^https?:\/\//, "")}</span> : null}
            </footer>
          </div>
        </article>

        <aside className="space-y-4">
          <Card>
            <CardHeader icon={integrity.intact ? <ShieldCheck /> : <ShieldAlert />} title={t("integrity.title")} />
            <CardBody className="space-y-3">
              <p className={cn("flex items-center gap-2 text-body-sm font-medium", integrity.intact ? "text-success-700" : "text-danger-700")}>
                {integrity.intact ? <ShieldCheck className="size-4" /> : <ShieldAlert className="size-4" />}
                {t(integrity.intact ? "integrity.intact" : integrity.sealed ? "integrity.tampered" : "integrity.unsealed")}
              </p>
              <p className="text-caption text-fg-subtle">{t("integrity.explain")}</p>
              {cert.contentHash ? (
                <p className="break-all rounded-md bg-surface-subtle px-2 py-1.5 font-mono text-[0.6875rem] text-fg-muted" title={cert.contentHash}>
                  {cert.contentHash.slice(0, 32)}…
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<QrCode />} title={t("public.title")} />
            <CardBody>
              <DetailList
                columns={1}
                items={[
                  {
                    label: t("public.link"),
                    value: cert.qrToken ? (
                      <a href={`/c/${cert.qrToken.token}`} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                        {t("public.open")}
                      </a>
                    ) : null,
                  },
                  { label: t("public.checks"), value: <span className="tabular">{verifications}</span> },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<BookOpenCheck />} title={t("basis.title")} />
            <CardBody>
              <DetailList
                columns={1}
                items={[
                  { label: t("basis.rule"), value: rule ? `${rule.ruleNumber} — ${rule.ruleName}` : null },
                  { label: t("basis.version"), value: cert.ruleVersion ? `v${cert.ruleVersion.versionNumber} · ${formatDate(cert.ruleVersion.effectiveFrom, locale)}` : null },
                  { label: t("basis.source"), value: rule?.sourceNotification ?? rule?.amendmentReference ?? null },
                  { label: t("basis.method"), value: describeValidityMethod(cert.validityCalcMethod, t) },
                ]}
              />
            </CardBody>
          </Card>

          {history.length ? (
            <Card>
              <CardHeader icon={<History />} title={t("history.title")} />
              <ul className="divide-y divide-line">
                {history.map((h) => {
                  const m = /^\[(\w+)\]\s*([\s\S]*)$/.exec(h.reason);
                  return (
                    <li key={h.id} className="px-5 py-3">
                      <p className="text-body-sm font-medium text-fg">{m ? t(`history.${m[1]}`) : t("history.REVOKE")}</p>
                      <p className="mt-0.5 text-body-sm text-fg-muted">{m ? m[2] : h.reason}</p>
                      <p className="mt-1 text-caption text-fg-subtle">{formatDateTime(h.revokedAt, locale)}</p>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
