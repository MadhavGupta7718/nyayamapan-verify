import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Award, FilePlus2, FileText, MapPin, Scale } from "lucide-react";
import { prisma } from "@/db/client";
import { Link } from "@/i18n/routing";
import { guard } from "@/server/access";
import { getSessionUser } from "@/server/session";
import { applicationScope, certificateScope, instrumentScope } from "@/server/scope";
import { cn, daysUntil, formatDate, formatRelative } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, DetailList } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, InlineAlert } from "@/components/ui/states";
import { buttonVariants } from "@/components/ui/button";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const [{ id }, user] = await Promise.all([params, getSessionUser()]);
  if (!user) return { title: (await getTranslations("instruments"))("title") };
  const i = await prisma.instrument.findFirst({ where: { AND: [{ id }, instrumentScope(user)] }, select: { instrumentCode: true } }).catch(() => null);
  if (!i) notFound();
  return { title: i.instrumentCode };
}

const OPEN = ["DRAFT", "SUBMITTED", "DOCUMENT_REVIEW", "APPROVED", "RETURNED", "SCHEDULED", "ASSIGNED", "FIELD_VERIFICATION", "INSPECTION_COMPLETED", "PASS", "STAMPING", "CERTIFICATE_GENERATED", "CERTIFICATE_ISSUED"];

export default async function InstrumentDetailPage({ params }: Params) {
  const { user, denied } = await guard("instruments");
  if (denied) return denied;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, locale] = await Promise.all([getTranslations("instruments"), getLocale()]);

  const inst = await prisma.instrument.findFirst({
    where: { AND: [{ id }, instrumentScope(user)] },
    select: {
      id: true,
      instrumentCode: true,
      serialNumber: true,
      manufacturer: true,
      modelName: true,
      capacity: true,
      accuracy: true,
      unit: true,
      yearOfManufacture: true,
      locationLabel: true,
      address: true,
      latitude: true,
      longitude: true,
      verificationStatus: true,
      lastVerificationAt: true,
      nextDueDate: true,
      createdAt: true,
      organization: { select: { name: true } },
      state: { select: { name: true, nameHi: true } },
      district: { select: { name: true, nameHi: true } },
      instrumentType: { select: { name: true, nameHi: true, category: true } },
    },
  });
  if (!inst) notFound();

  const [apps, certs] = await Promise.all([
    prisma.application.findMany({
      where: { AND: [{ instrumentId: id }, applicationScope(user)] },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, applicationNumber: true, status: true, verificationType: true, createdAt: true },
    }),
    prisma.certificate.findMany({
      where: { AND: [{ instrumentId: id }, certificateScope(user)] },
      orderBy: { verificationDate: "desc" },
      take: 20,
      select: { id: true, certificateNumber: true, status: true, verificationDate: true, validUntil: true },
    }),
  ]);

  const tn = (x: { name: string; nameHi: string | null } | null) => (x ? (locale === "hi" && x.nameHi ? x.nameHi : x.name) : null);
  const open = apps.find((a) => OPEN.includes(a.status));
  const canApply = ["BUSINESS_USER", "SUPER_ADMIN", "STATE_ADMIN"].includes(user.role) && !open;
  const due = daysUntil(inst.nextDueDate);

  return (
    <>
      <nav className="mb-2 text-body-sm">
        <Link href="/instruments" className="text-fg-subtle hover:text-fg">
          ← {t("backToList")}
        </Link>
      </nav>
      <PageHeader
        eyebrow={tn(inst.instrumentType)}
        title={<span className="font-mono tracking-tight">{inst.instrumentCode}</span>}
        description={`${inst.manufacturer} ${inst.modelName} · ${t("serialShort")} ${inst.serialNumber}`}
        meta={<StatusBadge status={inst.verificationStatus} size="md" />}
        actions={
          <>
            {open ? (
              <Link href={`/applications/${open.id}`} className={buttonVariants({ variant: "secondary" })}>
                <FileText /> {t("openApplication", { number: open.applicationNumber })}
              </Link>
            ) : null}
            {canApply ? (
              <Link href={`/applications/new?instrument=${inst.id}&type=${certs.length ? "RE_VERIFICATION" : "INITIAL_VERIFICATION"}`} className={buttonVariants()}>
                <FilePlus2 /> {t("apply")}
              </Link>
            ) : null}
          </>
        }
      />

      {inst.nextDueDate && due != null && due <= 60 ? (
        <InlineAlert tone={due < 0 ? "danger" : "warning"} className="mb-6" title={due < 0 ? t("overdueTitle") : t("dueTitle", { days: due })}>
          {t("dueBody", { date: formatDate(inst.nextDueDate, locale) })}
        </InlineAlert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader icon={<Scale />} title={t("sections.details")} />
            <CardBody>
              <DetailList
                columns={3}
                items={[
                  { label: t("fields.type"), value: tn(inst.instrumentType) },
                  { label: t("fields.serial"), value: inst.serialNumber, mono: true },
                  { label: t("fields.manufacturer"), value: inst.manufacturer },
                  { label: t("fields.model"), value: inst.modelName },
                  { label: t("fields.capacity"), value: inst.capacity },
                  { label: t("fields.accuracy"), value: inst.accuracy },
                  { label: t("fields.year"), value: inst.yearOfManufacture },
                  { label: t("fields.owner"), value: inst.organization.name },
                  { label: t("fields.registered"), value: formatDate(inst.createdAt, locale) },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Award />} title={t("sections.certificates")} />
            {certs.length ? (
              <ul className="divide-y divide-line">
                {certs.map((c) => (
                  <li key={c.id}>
                    <Link href={`/certificates/${c.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-subtle">
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[0.8125rem] text-fg">{c.certificateNumber}</span>
                        <span className="block text-caption text-fg-subtle">
                          {formatDate(c.verificationDate, locale)} → {c.validUntil ? formatDate(c.validUntil, locale) : t("validityNotConfigured")}
                        </span>
                      </span>
                      <StatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={Award} title={t("noCertificates")} />
            )}
          </Card>

          <Card>
            <CardHeader icon={<FileText />} title={t("sections.applications")} />
            {apps.length ? (
              <ul className="divide-y divide-line">
                {apps.map((a) => (
                  <li key={a.id}>
                    <Link href={`/applications/${a.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-subtle">
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[0.8125rem] text-fg">{a.applicationNumber}</span>
                        <span className="block text-caption text-fg-subtle">{formatRelative(a.createdAt, locale)}</span>
                      </span>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={FileText} title={t("noApplications")} />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader icon={<Award />} title={t("sections.verification")} />
            <CardBody>
              <DetailList
                columns={1}
                items={[
                  { label: t("fields.status"), value: <StatusBadge status={inst.verificationStatus} /> },
                  { label: t("fields.lastVerified"), value: formatDate(inst.lastVerificationAt, locale) },
                  {
                    label: t("fields.nextDue"),
                    value: inst.nextDueDate ? (
                      <span className={cn(due != null && due < 0 && "text-danger-700", due != null && due >= 0 && due <= 60 && "text-warning-700")}>{formatDate(inst.nextDueDate, locale)}</span>
                    ) : (
                      "—"
                    ),
                  },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={<MapPin />} title={t("sections.location")} />
            <CardBody>
              <DetailList
                columns={1}
                items={[
                  { label: t("fields.site"), value: inst.locationLabel },
                  { label: t("fields.address"), value: inst.address },
                  { label: t("fields.district"), value: [tn(inst.district), tn(inst.state)].filter(Boolean).join(", ") },
                  { label: t("fields.coordinates"), value: inst.latitude != null ? `${inst.latitude.toFixed(5)}, ${inst.longitude?.toFixed(5)}` : null, mono: true },
                ]}
              />
              {inst.latitude != null ? (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${inst.latitude}&mlon=${inst.longitude}#map=17/${inst.latitude}/${inst.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-brand-700 hover:text-brand-900"
                >
                  <MapPin className="size-4" /> {t("openMap")}
                </a>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
