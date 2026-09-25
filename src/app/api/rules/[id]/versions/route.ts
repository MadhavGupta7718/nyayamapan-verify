import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { writeAudit } from "@/server/audit";

const schema = z.object({
  value: z.string().trim().max(200).nullable(),
  valueStatus: z.enum(["SET", "CONFIGURATION_REQUIRED"]),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  changeReason: z.string().trim().min(10).max(1000),
});

/**
 * Adds a new rule version. The previous version is closed (effectiveUntil) but never edited or
 * deleted, so certificates issued under it keep their exact legal basis. The rule returns to review.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN"]);
  if (response) return response;
  const { id } = await ctx.params;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);
  if (body.data.valueStatus === "SET" && !body.data.value) return jsonError(400, "VALUE_REQUIRED");

  const rule = await prisma.legalRule.findUnique({
    where: { id },
    select: { id: true, versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { id: true, versionNumber: true, effectiveFrom: true } } },
  });
  if (!rule) return jsonError(404, "NOT_FOUND");
  const effectiveFrom = new Date(`${body.data.effectiveFrom}T00:00:00Z`);
  const prev = rule.versions[0];
  if (prev && effectiveFrom <= prev.effectiveFrom) return jsonError(400, "EFFECTIVE_DATE_MUST_FOLLOW_PREVIOUS");

  const version = await prisma.$transaction(async (tx) => {
    if (prev) {
      await tx.legalRuleVersion.update({
        where: { id: prev.id },
        data: { effectiveUntil: new Date(effectiveFrom.getTime() - 1) },
      });
    }
    const v = await tx.legalRuleVersion.create({
      data: {
        legalRuleId: id,
        versionNumber: (prev?.versionNumber ?? 0) + 1,
        value: body.data.value,
        valueStatus: body.data.valueStatus,
        effectiveFrom,
        changeReason: body.data.changeReason,
      },
    });
    await tx.legalRule.update({ where: { id }, data: { status: "UNDER_REVIEW", value: body.data.value, valueStatus: body.data.valueStatus } });
    return v;
  });

  await writeAudit({
    actorId: user.id,
    action: "RULE_VERSION_CREATED",
    entity: "LegalRule",
    entityId: id,
    after: { versionNumber: version.versionNumber, value: version.value, effectiveFrom: body.data.effectiveFrom },
    reason: body.data.changeReason,
  });
  return NextResponse.json({ data: { id: version.id, versionNumber: version.versionNumber } }, { status: 201 });
}
