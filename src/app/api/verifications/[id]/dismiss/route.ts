import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { jsonError, requireApiUser } from "@/server/api";
import { INACTIVE_ASSIGNMENT, loadOpenInspection, loadVerifiableApplication } from "@/server/verification-access";
import { writeAudit } from "@/server/audit";
import { MAX_UPLOAD_BYTES, checksumBuffer, sniffMime, storeFile } from "@/services/storage";
import { getMalwareScanner } from "@/services/malware-scanner";
import { notifyStateAdmins } from "@/services/assignment";
import { transitionApplication, WorkflowError } from "@/services/application-workflow";
import { DISMISS_REASON_MIN, LOCATION_NOT_FOUND_CATEGORY } from "@/lib/evidence";

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * "Location not found": the officer couldn't find the instrument at the registered site. A proof photo
 * and a reason are required. The visit is cancelled, the application goes back to the applicant as
 * RETURNED so they can correct the location, and the State Admins are told.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { id } = await ctx.params;
  const res = await loadVerifiableApplication(user, id);
  if ("error" in res) return jsonError(res.error!, res.error === 404 ? "NOT_FOUND" : "FORBIDDEN");
  if (res.app.status !== "FIELD_VERIFICATION") return jsonError(409, "NOT_DISMISSABLE", { status: res.app.status });

  const form = await req.formData();
  const file = form.get("file");
  const reason = String(form.get("reason") ?? "").trim();
  const lat = form.get("latitude") ? Number(form.get("latitude")) : undefined;
  const lng = form.get("longitude") ? Number(form.get("longitude")) : undefined;
  if (!(file instanceof File)) return jsonError(400, "FILE_REQUIRED");
  if (reason.length < DISMISS_REASON_MIN || reason.length > 1000) return jsonError(400, "REASON_REQUIRED");

  const inspection = await loadOpenInspection(id, String(form.get("inspectionId") ?? ""));
  if (!inspection || inspection.completedAt) return jsonError(409, "NOT_DISMISSABLE");
  if (file.size > MAX_UPLOAD_BYTES) return jsonError(413, "FILE_TOO_LARGE");

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime || !IMAGE_MIME.has(mime)) return jsonError(415, "UNSUPPORTED_FILE_TYPE");
  const scan = await getMalwareScanner().scan(file.name, mime, file.size);
  if (!scan.clean) return jsonError(422, "FILE_REJECTED_BY_SCANNER");
  const checksum = await checksumBuffer(buf);
  const stored = await storeFile({ key: `inspections/${inspection.id}/${LOCATION_NOT_FOUND_CATEGORY}-${Date.now()}.${mime.split("/")[1]}`, data: buf, contentType: mime });
  const position = Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat!, longitude: lng! } : null;

  await prisma.$transaction([
    prisma.inspectionPhoto.create({
      data: {
        inspectionId: inspection.id,
        category: LOCATION_NOT_FOUND_CATEGORY,
        storageKey: stored.key,
        storageUrl: stored.provider === "vercel-blob" ? stored.url : null,
        checksum,
        latitude: position?.latitude,
        longitude: position?.longitude,
        capturedById: user.id,
      },
    }),
    ...(position ? [prisma.gpsRecord.create({ data: { inspectionId: inspection.id, userId: user.id, ...position, purpose: "DISMISSAL" } })] : []),
    prisma.inspection.update({ where: { id: inspection.id }, data: { dismissedAt: new Date(), dismissReason: reason } }),
    prisma.verificationAssignment.updateMany({ where: { applicationId: id, status: { notIn: INACTIVE_ASSIGNMENT } }, data: { status: "CANCELLED", notes: `Location not found: ${reason}` } }),
    prisma.verificationSchedule.updateMany({ where: { applicationId: id, status: { in: ["SCHEDULED", "RESCHEDULED"] } }, data: { status: "CANCELLED" } }),
  ]);

  try {
    await transitionApplication({ applicationId: id, to: "RETURNED", actorId: user.id, reason: `Location not found: ${reason}` });
  } catch (e) {
    if (e instanceof WorkflowError) return jsonError(409, e.code);
    throw e;
  }

  await writeAudit({
    actorId: user.id,
    action: "VERIFICATION_DISMISSED",
    entity: "Inspection",
    entityId: inspection.id,
    after: { applicationId: id, photoKey: stored.key, position },
    reason,
  });
  const meta = { applicationId: id, applicationNumber: res.app.applicationNumber };
  await notifyStateAdmins(
    res.app.instrument.stateId,
    `Instrument site not found for ${res.app.applicationNumber}`,
    `The officer couldn't find the instrument at the registered location: ${reason}`,
    meta
  );
  return NextResponse.json({ data: { status: "RETURNED" } });
}
