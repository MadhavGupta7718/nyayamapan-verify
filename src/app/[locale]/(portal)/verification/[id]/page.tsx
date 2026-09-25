import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/db/client";
import { Link } from "@/i18n/routing";
import { guard, Forbidden } from "@/server/access";
import { loadVerifiableApplication } from "@/server/verification-access";
import { requiredPhotoCategories } from "@/lib/evidence";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { FieldVerification, type FieldData } from "@/components/verification/field-verification";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("verification") };
}

export default async function FieldVerificationPage({ params }: Params) {
  const { user, denied } = await guard("verification");
  if (denied) return denied;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await loadVerifiableApplication(user, id);
  if ("error" in res) {
    if (res.error === 404) notFound();
    return Forbidden();
  }
  const [t, locale] = await Promise.all([getTranslations("field"), getLocale()]);

  const app = await prisma.application.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      organization: { select: { name: true } },
      instrument: {
        select: {
          serialNumber: true,
          manufacturer: true,
          modelName: true,
          capacity: true,
          locationLabel: true,
          address: true,
          latitude: true,
          longitude: true,
          instrumentType: { select: { name: true, nameHi: true, requiredPhotos: true } },
        },
      },
      schedules: { orderBy: { createdAt: "desc" }, take: 1, select: { scheduledDate: true, timeSlot: true } },
      inspections: {
        where: { dismissedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          completedAt: true,
          serialConfirmed: true,
          overallResult: true,
          observations: true,
          checklists: { orderBy: { itemKey: "asc" }, select: { id: true, itemKey: true, itemLabel: true, result: true, remarks: true, ruleRef: true } },
          tests: { select: { id: true, testName: true, expectedValue: true, observedValue: true, unit: true, result: true, permissibleError: true, calculatedError: true } },
          photos: { orderBy: { capturedAt: "asc" }, select: { id: true, category: true, capturedAt: true, storageKey: true } },
          gpsRecords: { orderBy: { capturedAt: "desc" }, select: { purpose: true, accuracy: true, capturedAt: true, latitude: true, longitude: true } },
          stamping: { select: { stampIdentifier: true, stampDate: true } },
        },
      },
      certificates: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, certificateNumber: true } },
    },
  });
  const insp = app.inspections[0];
  const inst = app.instrument;
  const data: FieldData = {
    id: app.id,
    number: app.applicationNumber,
    status: app.status,
    organization: app.organization.name,
    instrument: {
      type: locale === "hi" && inst.instrumentType.nameHi ? inst.instrumentType.nameHi : inst.instrumentType.name,
      serial: inst.serialNumber,
      maker: `${inst.manufacturer} ${inst.modelName}`,
      capacity: inst.capacity,
      site: [inst.locationLabel, inst.address].filter(Boolean).join(", "),
      lat: inst.latitude,
      lng: inst.longitude,
    },
    visit: app.schedules[0] ? { date: app.schedules[0].scheduledDate.toISOString(), slot: app.schedules[0].timeSlot } : null,
    requiredPhotos: requiredPhotoCategories(inst.instrumentType.requiredPhotos),
    inspection: insp
      ? {
          id: insp.id,
          open: !insp.completedAt,
          serialConfirmed: insp.serialConfirmed,
          result: insp.overallResult,
          observations: insp.observations,
          checklist: insp.checklists.map((c) => ({
            id: c.id,
            label: locale !== "en" && t.has(`checklistItems.${c.itemKey}`) ? t(`checklistItems.${c.itemKey}`) : c.itemLabel,
            result: c.result,
            remarks: c.remarks ?? "",
            ruleRef: c.ruleRef,
          })),
          tests: insp.tests.map((x) => ({ ...x })),
          photos: insp.photos.map((p) => ({ id: p.id, category: p.category, capturedAt: p.capturedAt.toISOString(), storageKey: p.storageKey })),
          arrival: insp.gpsRecords.find((g) => g.purpose === "ARRIVAL")
            ? (() => {
                const g = insp.gpsRecords.find((x) => x.purpose === "ARRIVAL")!;
                return { accuracy: g.accuracy, capturedAt: g.capturedAt.toISOString(), lat: g.latitude, lng: g.longitude };
              })()
            : null,
          stamp: insp.stamping ? { id: insp.stamping.stampIdentifier, date: insp.stamping.stampDate.toISOString() } : null,
        }
      : null,
    certificate: app.certificates[0] ? { id: app.certificates[0].id, number: app.certificates[0].certificateNumber } : null,
  };

  return (
    <>
      <nav className="mb-2 text-body-sm">
        <Link href="/verification" className="text-fg-subtle hover:text-fg">
          ← {t("backToAssignments")}
        </Link>
      </nav>
      <PageHeader
        eyebrow={<span className="font-mono">{app.applicationNumber}</span>}
        title={app.organization.name}
        description={`${data.instrument.type} · ${data.instrument.serial}`}
        meta={<StatusBadge status={app.status} size="md" />}
      />
      {/* Local step state is seeded from props once; a new inspection must remount it. */}
      <FieldVerification key={data.inspection?.id ?? "none"} data={data} locale={locale} />
    </>
  );
}
