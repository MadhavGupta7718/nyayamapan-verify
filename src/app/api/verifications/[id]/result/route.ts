import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { loadOpenInspection, loadVerifiableApplication } from "@/server/verification-access";
import { transitionApplication, WorkflowError } from "@/services/application-workflow";
import { writeAudit } from "@/server/audit";
import { geofenceResponse } from "@/server/geofence";
import { missingPhotos, requiredPhotoCategories } from "@/lib/evidence";

const schema = z.object({
  inspectionId: z.string().uuid(),
  overallResult: z.enum(["PASS", "FAIL"]),
  observations: z.string().trim().max(4000).optional(),
});

/**
 * The officer's legal determination. Requires the officer to be within 1 km of the site, the serial
 * number to be confirmed, every checklist item to be answered and every required photo to be on
 * record; a PASS is refused while any checklist item or test is FAIL.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { id } = await ctx.params;
  const res = await loadVerifiableApplication(user, id);
  if ("error" in res) return jsonError(res.error!, res.error === 404 ? "NOT_FOUND" : "FORBIDDEN");
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);
  const inspection = await loadOpenInspection(id, body.data.inspectionId);
  if (!inspection || inspection.completedAt) return jsonError(409, "INSPECTION_CLOSED");
  if (res.app.status !== "FIELD_VERIFICATION") return jsonError(409, "NOT_IN_FIELD_VERIFICATION", { status: res.app.status });
  const outside = await geofenceResponse(inspection.id, res.app.instrument);
  if (outside) return outside;

  const [checklist, failedTests, photos] = await Promise.all([
    prisma.inspectionChecklist.findMany({ where: { inspectionId: inspection.id }, select: { result: true } }),
    prisma.inspectionTest.count({ where: { inspectionId: inspection.id, result: "FAIL" } }),
    prisma.inspectionPhoto.findMany({ where: { inspectionId: inspection.id }, select: { category: true } }),
  ]);
  if (!inspection.serialConfirmed) return jsonError(400, "SERIAL_NOT_CONFIRMED");
  if (checklist.some((c) => c.result === "PENDING")) return jsonError(400, "CHECKLIST_INCOMPLETE");
  if (body.data.overallResult === "PASS" && (checklist.some((c) => c.result === "FAIL") || failedTests > 0)) {
    return jsonError(400, "PASS_WITH_FAILED_ITEMS");
  }
  const missing = missingPhotos(requiredPhotoCategories(res.app.instrument.instrumentType.requiredPhotos), photos.map((p) => p.category));
  if (missing.length) return jsonError(400, "PHOTOS_REQUIRED", { missing });

  await prisma.inspection.update({
    where: { id: inspection.id },
    data: { overallResult: body.data.overallResult, observations: body.data.observations, completedAt: new Date() },
  });
  await prisma.verificationSchedule.updateMany({
    where: { applicationId: id, status: { in: ["SCHEDULED", "RESCHEDULED"] } },
    data: { status: "COMPLETED" },
  });

  try {
    await transitionApplication({ applicationId: id, to: "INSPECTION_COMPLETED", actorId: user.id, notify: false });
    await transitionApplication({ applicationId: id, to: body.data.overallResult, actorId: user.id, remarks: body.data.observations });
  } catch (e) {
    if (e instanceof WorkflowError) return jsonError(409, e.code);
    throw e;
  }

  await writeAudit({
    actorId: user.id,
    action: "RESULT_RECORDED",
    entity: "Application",
    entityId: id,
    after: { result: body.data.overallResult, inspectionId: inspection.id },
  });

  return NextResponse.json({ data: { result: body.data.overallResult } });
}
