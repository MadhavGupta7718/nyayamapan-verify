import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { loadOpenInspection, loadVerifiableApplication } from "@/server/verification-access";
import { geofenceResponse } from "@/server/geofence";

const schema = z.object({
  inspectionId: z.string().uuid(),
  serialConfirmed: z.boolean().optional(),
  items: z
    .array(z.object({ id: z.string().uuid(), result: z.enum(["PASS", "FAIL", "NA", "PENDING"]), remarks: z.string().max(500).optional() }))
    .max(100),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { id } = await ctx.params;
  const res = await loadVerifiableApplication(user, id);
  if ("error" in res) return jsonError(res.error!, res.error === 404 ? "NOT_FOUND" : "FORBIDDEN");
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);
  const inspection = await loadOpenInspection(id, body.data.inspectionId);
  if (!inspection || inspection.completedAt) return jsonError(409, "INSPECTION_CLOSED");
  const outside = await geofenceResponse(inspection.id, res.app.instrument);
  if (outside) return outside;

  const ids = body.data.items.map((i) => i.id);
  const owned = await prisma.inspectionChecklist.count({ where: { id: { in: ids }, inspectionId: inspection.id } });
  if (owned !== ids.length) return jsonError(400, "INVALID_CHECKLIST_ITEM");

  await prisma.$transaction([
    ...body.data.items.map((i) =>
      prisma.inspectionChecklist.update({ where: { id: i.id }, data: { result: i.result, remarks: i.remarks } })
    ),
    ...(body.data.serialConfirmed != null
      ? [prisma.inspection.update({ where: { id: inspection.id }, data: { serialConfirmed: body.data.serialConfirmed } })]
      : []),
  ]);
  return NextResponse.json({ ok: true });
}
