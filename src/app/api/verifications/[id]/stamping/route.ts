import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { loadVerifiableApplication } from "@/server/verification-access";
import { transitionApplication, WorkflowError } from "@/services/application-workflow";
import { writeAudit } from "@/server/audit";

const schema = z.object({
  stampIdentifier: z.string().trim().min(2).max(80),
  stampType: z.string().trim().max(60).optional(),
  remarks: z.string().trim().max(1000).optional(),
});

/** Stamping is recorded as its own domain event after a PASS result. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { id } = await ctx.params;
  const res = await loadVerifiableApplication(user, id);
  if ("error" in res) return jsonError(res.error!, res.error === 404 ? "NOT_FOUND" : "FORBIDDEN");
  if (res.app.status !== "PASS") return jsonError(409, "STAMPING_REQUIRES_PASS", { status: res.app.status });
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  const inspection = await prisma.inspection.findFirst({
    where: { applicationId: id, overallResult: "PASS" },
    orderBy: { completedAt: "desc" },
    select: { id: true, stamping: { select: { id: true } } },
  });
  if (!inspection) return jsonError(409, "NO_PASSED_INSPECTION");
  if (inspection.stamping) return jsonError(409, "ALREADY_STAMPED");

  const officer = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, role: true } });
  const stamp = await prisma.stampingRecord.create({
    data: {
      inspectionId: inspection.id,
      stampIdentifier: body.data.stampIdentifier,
      stampType: body.data.stampType,
      remarks: body.data.remarks,
      officerId: user.id,
      authority: officer ? `${officer.name} (${officer.role})` : undefined,
    },
  });

  try {
    await transitionApplication({ applicationId: id, to: "STAMPING", actorId: user.id, remarks: body.data.stampIdentifier });
  } catch (e) {
    if (e instanceof WorkflowError) return jsonError(409, e.code);
    throw e;
  }
  await writeAudit({ actorId: user.id, action: "STAMPING_RECORDED", entity: "Inspection", entityId: inspection.id, after: { stampId: stamp.id } });
  return NextResponse.json({ data: { id: stamp.id } }, { status: 201 });
}
