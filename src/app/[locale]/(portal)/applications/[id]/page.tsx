import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Award, CalendarClock, ClipboardList, FileText, History, MapPin, Scale, Undo2 } from "lucide-react";
import { prisma } from "@/db/client";
import { Link } from "@/i18n/routing";
import { guard } from "@/server/access";
import { getSessionUser } from "@/server/session";
import { applicationScope } from "@/server/scope";
import { availableActions } from "@/services/application-workflow";
import { WORKFLOW_MILESTONES, milestoneIndex } from "@/lib/status";
import { SCHEDULER_ROLES, isFieldRole } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, DetailList } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Stepper } from "@/components/ui/stepper";
import { Timeline } from "@/components/ui/timeline";
import { InlineAlert } from "@/components/ui/states";
import { buttonVariants } from "@/components/ui/button";
import { ApplicationActions } from "@/components/applications/application-actions";
import { DocumentPanel } from "@/components/applications/document-panel";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const [{ id }, user] = await Promise.all([params, getSessionUser()]);
  if (!user) return { title: (await getTranslations("applications"))("title") };
  const app = await prisma.application.findFirst({ where: { AND: [{ id }, applicationScope(user)] }, select: { applicationNumber: true } }).catch(() => null);
  if (!app) notFound();
  return { title: app.applicationNumber };
}

const EDITABLE = ["DRAFT", "RETURNED", "SUBMITTED", "DOCUMENT_REVIEW"];

export default async function ApplicationDetailPage({ params }: Params) {
  const { user, denied } = await guard("applications");
  if (denied) return denied;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, ts, tr, tf, locale] = await Promise.all([
    getTranslations("applications"),
    getTranslations("status"),
    getTranslations("roles"),
    getTranslations("field"),
    getLocale(),
  ]);

  const app = await prisma.application.findFirst({
    where: { AND: [{ id }, applicationScope(user)] },
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      verificationType: true,
      preferredDate: true,
      preferredSlot: true,
      remarks: true,
      declarationAccepted: true,
      createdAt: true,
      createdById: true,
      organizationId: true,
      organization: { select: { name: true, gstin: true, address: true } },
      createdBy: { select: { name: true } },
      instrument: {
        select: {
          id: true,
          instrumentCode: true,
          manufacturer: true,
          modelName: true,
          serialNumber: true,
          capacity: true,
          accuracy: true,
          locationLabel: true,
          address: true,
          latitude: true,
          longitude: true,
          state: { select: { name: true, nameHi: true } },
          district: { select: { name: true, nameHi: true } },
          instrumentType: { select: { name: true, nameHi: true, requiredDocuments: true } },
        },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, documentType: true, fileName: true, sizeBytes: true, version: true, status: true, storageKey: true, createdAt: true },
      },
      statusHistory: {
        orderBy: { changedAt: "asc" },
        select: { id: true, newStatus: true, changedAt: true, reason: true, remarks: true, changedBy: { select: { name: true, role: true } } },
      },
      schedules: {
        orderBy: { scheduledDate: "desc" },
        take: 1,
        select: { scheduledDate: true, timeSlot: true, status: true, assignment: { select: { authorityType: true, officer: { select: { name: true } }, gatc: { select: { name: true } } } } },
      },
      inspections: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          overallResult: true,
          completedAt: true,
          observations: true,
          serialConfirmed: true,
          officer: { select: { name: true } },
          checklists: { orderBy: { itemKey: "asc" }, select: { id: true, itemKey: true, itemLabel: true, result: true } },
          tests: { select: { id: true, testName: true, observedValue: true, expectedValue: true, unit: true, result: true, permissibleError: true } },
          stamping: { select: { stampIdentifier: true, stampDate: true } },
        },
      },
      certificates: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, certificateNumber: true, status: true, validUntil: true } },
    },
  });
  if (!app) notFound();

  const isOwner = app.createdById === user.id || (!!user.organizationId && user.organizationId === app.organizationId);
  const actions = availableActions(app.status, user.role, isOwner);
  const reached = milestoneIndex(app.status);
  const failedAt = app.status === "REJECTED" ? 1 : app.status === "FAIL" ? 5 : undefined;
  const lastReason = [...app.statusHistory].reverse().find((h) => h.reason)?.reason;
  const schedule = app.schedules[0];
  const inspection = app.inspections[0];
  const evidenceException =
    inspection && user.role !== "BUSINESS_USER"
      ? await prisma.auditLog.findFirst({
          where: { action: "EVIDENCE_EXCEPTION", entity: "Inspection", entityId: inspection.id },
          orderBy: { createdAt: "desc" },
          select: { reason: true, after: true },
        })
      : null;
  const exceptionMissing = ((evidenceException?.after as { missing?: unknown } | null)?.missing ?? []) as string[];
  const cert = app.certificates[0];
  const typeName = locale === "hi" && app.instrument.instrumentType.nameHi ? app.instrument.instrumentType.nameHi : app.instrument.instrumentType.name;
  const required = Array.isArray(app.instrument.instrumentType.requiredDocuments) ? (app.instrument.instrumentType.requiredDocuments as string[]) : [];
  const canUpload = EDITABLE.includes(app.status) && (isOwner || user.role === "SUPER_ADMIN" || user.role === "STATE_ADMIN");

  const timelineItems = app.statusHistory.map((h, i) => ({
    id: h.id,
    status: h.newStatus,
    title: ts(`${h.newStatus}.label`),
    meta: `${formatDateTime(h.changedAt, locale)}${h.changedBy ? ` · ${h.changedBy.name} (${tr(h.changedBy.role)})` : ""}`,
    body: h.reason ?? h.remarks ?? undefined,
    current: i === app.statusHistory.length - 1,
  }));

  return (
    <>
      <nav className="mb-2 text-body-sm">
        <Link href="/applications" className="text-fg-subtle hover:text-fg">
          ← {t("backToList")}
        </Link>
      </nav>
      <PageHeader
        eyebrow={t(`types.${app.verificationType}`)}
        title={<span className="font-mono tracking-tight">{app.applicationNumber}</span>}
        description={`${app.organization.name} · ${typeName} · ${app.instrument.serialNumber}`}
        meta={
          <>
            <StatusBadge status={app.status} size="md" />
            <span className="text-caption text-fg-subtle">{t("submittedOn", { date: formatDate(app.createdAt, locale) })}</span>
          </>
        }
        actions={
          <>
            {app.status === "APPROVED" && SCHEDULER_ROLES.includes(user.role) ? (
              <Link href={`/scheduling?application=${app.id}`} className={buttonVariants()}>
                <CalendarClock /> {t("schedule")}
              </Link>
            ) : null}
            {isFieldRole(user.role) && ["ASSIGNED", "FIELD_VERIFICATION", "PASS", "STAMPING"].includes(app.status) ? (
              <Link href={`/verification/${app.id}`} className={buttonVariants()}>
                <ClipboardList /> {t("openVerification")}
              </Link>
            ) : null}
            {cert ? (
              <Link href={`/certificates/${cert.id}`} className={buttonVariants({ variant: "secondary" })}>
                <Award /> {t("viewCertificate")}
              </Link>
            ) : null}
            <ApplicationActions applicationId={app.id} actions={actions} needsDeclaration={!app.declarationAccepted} />
          </>
        }
      />

      <Card className="relative mb-6 overflow-x-auto px-4 py-5 sm:px-6">
        <Stepper
          className="sm:min-w-[560px]"
          current={Math.max(0, app.status === "ACTIVE" ? WORKFLOW_MILESTONES.length : reached)}
          failedAt={failedAt}
          steps={WORKFLOW_MILESTONES.map((m) => ({ key: m, label: ts(`${m}.label`) }))}
        />
      </Card>

      {app.status === "RETURNED" && lastReason ? (
        <InlineAlert tone="warning" icon={<Undo2 />} title={t("returnedTitle")} className="mb-6">
          {lastReason}
          {isOwner ? <p className="mt-1">{t("returnedHelp")}</p> : null}
        </InlineAlert>
      ) : null}
      {(app.status === "REJECTED" || app.status === "FAIL" || app.status === "REVOKED") && lastReason ? (
        <InlineAlert tone="danger" title={ts(`${app.status}.label`)} className="mb-6">
          {lastReason}
        </InlineAlert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              icon={<Scale />}
              title={t("sections.instrument")}
              action={
                <Link href={`/instruments/${app.instrument.id}`} className="text-body-sm font-medium text-brand-700 hover:text-brand-900">
                  {t("openInstrument")}
                </Link>
              }
            />
            <CardBody>
              <DetailList
                columns={3}
                items={[
                  { label: t("fields.instrumentType"), value: typeName },
                  { label: t("fields.instrumentCode"), value: app.instrument.instrumentCode, mono: true },
                  { label: t("fields.serial"), value: app.instrument.serialNumber, mono: true },
                  { label: t("fields.manufacturer"), value: app.instrument.manufacturer },
                  { label: t("fields.model"), value: app.instrument.modelName },
                  { label: t("fields.capacity"), value: app.instrument.capacity },
                  { label: t("fields.location"), value: [app.instrument.locationLabel, app.instrument.address].filter(Boolean).join(", "), full: true },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<FileText />} title={t("sections.documents")} description={canUpload ? t("documentsEditable") : t("documentsLocked")} />
            <DocumentPanel
              applicationId={app.id}
              required={required}
              editable={canUpload}
              documents={app.documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
            />
          </Card>

          {inspection ? (
            <Card>
              <CardHeader
                icon={<ClipboardList />}
                title={t("sections.inspection")}
                description={inspection.completedAt ? t("inspectedBy", { name: inspection.officer?.name ?? "—", date: formatDate(inspection.completedAt, locale) }) : t("inspectionInProgress")}
                action={<StatusBadge status={inspection.overallResult} />}
              />
              <CardBody className="space-y-4">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {inspection.checklists.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 rounded-md bg-surface-subtle px-3 py-2 text-body-sm">
                      <span className="min-w-0 truncate text-fg">
                        {locale !== "en" && tf.has(`checklistItems.${c.itemKey}`) ? tf(`checklistItems.${c.itemKey}`) : c.itemLabel}
                      </span>
                      <StatusBadge status={c.result} withTooltip={false} />
                    </li>
                  ))}
                </ul>
                {inspection.tests.length ? (
                  <div className="relative overflow-x-auto rounded-lg border border-line">
                    <table className="w-full text-body-sm">
                      <thead className="bg-surface-subtle text-left text-caption uppercase tracking-wide text-fg-subtle">
                        <tr>
                          <th className="px-3 py-2 font-semibold">{t("tests.name")}</th>
                          <th className="px-3 py-2 text-right font-semibold">{t("tests.reference")}</th>
                          <th className="px-3 py-2 text-right font-semibold">{t("tests.observed")}</th>
                          <th className="px-3 py-2 font-semibold">{t("tests.mpe")}</th>
                          <th className="px-3 py-2 font-semibold">{t("tests.result")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inspection.tests.map((x) => (
                          <tr key={x.id} className="border-t border-line">
                            <td className="px-3 py-2">{x.testName}</td>
                            <td className="px-3 py-2 text-right font-mono tabular">{x.expectedValue ?? "—"} {x.unit}</td>
                            <td className="px-3 py-2 text-right font-mono tabular">{x.observedValue ?? "—"} {x.unit}</td>
                            <td className="px-3 py-2 text-caption text-fg-subtle">{x.permissibleError === "CONFIGURATION_REQUIRED" ? t("tests.mpeNotConfigured") : x.permissibleError}</td>
                            <td className="px-3 py-2">
                              {x.result === "PENDING" && x.permissibleError === "CONFIGURATION_REQUIRED" ? (
                                <StatusBadge status="CONFIGURATION_REQUIRED" />
                              ) : (
                                <StatusBadge status={x.result} withTooltip={false} />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {inspection.observations ? <p className="text-body-sm text-fg-muted">{inspection.observations}</p> : null}
                {evidenceException ? (
                  <InlineAlert tone="warning" title={t("evidenceException")}>
                    <ul className="list-disc pl-5">
                      {exceptionMissing.map((m) => {
                        const c = m.replace(/^photo:/, "");
                        return (
                          <li key={m}>
                            {m === "arrival"
                              ? tf("result.evidence.arrival")
                              : tf("result.evidence.photo", { category: tf.has(`photoTypes.${c}`) ? tf(`photoTypes.${c}`) : c.replaceAll("_", " ") })}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-2">{evidenceException.reason}</p>
                  </InlineAlert>
                ) : null}
                {inspection.stamping ? (
                  <p className="text-body-sm text-fg-muted">
                    {t("stamped", { id: inspection.stamping.stampIdentifier ?? "—", date: formatDate(inspection.stamping.stampDate, locale) })}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader icon={<CalendarClock />} title={t("sections.visit")} />
            <CardBody>
              {schedule ? (
                <DetailList
                  columns={1}
                  items={[
                    { label: t("fields.visitDate"), value: `${formatDate(schedule.scheduledDate, locale)} · ${schedule.timeSlot ?? "—"}` },
                    {
                      label: t("fields.authority"),
                      value: schedule.assignment?.authorityType === "GATC" ? `${schedule.assignment.gatc?.name ?? "GATC"}` : t("authorityLmo"),
                    },
                    { label: t("fields.officer"), value: schedule.assignment?.officer?.name },
                    { label: t("fields.visitStatus"), value: <StatusBadge status={schedule.status} /> },
                  ]}
                />
              ) : (
                <DetailList
                  columns={1}
                  items={[
                    { label: t("fields.preferredDate"), value: app.preferredDate ? `${formatDate(app.preferredDate, locale)} · ${app.preferredSlot ?? ""}` : "—" },
                    { label: t("fields.visitStatus"), value: <span className="text-fg-subtle">{t("notScheduled")}</span> },
                  ]}
                />
              )}
              {app.instrument.latitude != null ? (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${app.instrument.latitude}&mlon=${app.instrument.longitude}#map=17/${app.instrument.latitude}/${app.instrument.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-brand-700 hover:text-brand-900"
                >
                  <MapPin className="size-4" /> {t("openMap")}
                </a>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Scale />} title={t("sections.applicant")} />
            <CardBody>
              <DetailList
                columns={1}
                items={[
                  { label: t("fields.organization"), value: app.organization.name },
                  { label: t("fields.gstin"), value: app.organization.gstin, mono: true },
                  { label: t("fields.submittedBy"), value: app.createdBy.name },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<History />} title={t("sections.timeline")} />
            <CardBody>
              <Timeline items={timelineItems} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
