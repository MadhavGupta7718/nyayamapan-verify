import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { RuleStatus } from "@prisma/client";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { writeAudit } from "@/server/audit";

const schema = z.object({
  action: z.enum(["submit", "approve", "activate", "retire"]),
  reason: z.string().trim().min(10).max(1000),
});

/** Rules move DRAFT → UNDER_REVIEW → APPROVED → ACTIVE → RETIRED. No step can be skipped. */
const LIFECYCLE: Record<"submit" | "approve" | "activate" | "retire", { from: RuleStatus[]; to: RuleStatus; audit: string }> = {
  submit: { from: ["DRAFT", "CONFIGURATION_REQUIRED"], to: "UNDER_REVIEW", audit: "RULE_SUBMITTED" },
  approve: { from: ["UNDER_REVIEW"], to: "APPROVED", audit: "RULE_APPROVED" },
  activate: { from: ["APPROVED"], to: "ACTIVE", audit: "RULE_ACTIVATED" },
  retire: { from: ["ACTIVE", "APPROVED"], to: "RETIRED", audit: "RULE_RETIRED" },
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN"]);
  if (response) return response;
  const { id } = await ctx.params;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  const rule = await prisma.legalRule.findUnique({
    where: { id },
    select: { id: true, status: true, valueStatus: true, versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { id: true, valueStatus: true } } },
  });
  if (!rule) return jsonError(404, "NOT_FOUND");
  const step = LIFECYCLE[body.data.action];
  if (!step.from.includes(rule.status)) return jsonError(409, "INVALID_RULE_TRANSITION", { status: rule.status });
  if (body.data.action === "activate" && (rule.versions[0]?.valueStatus ?? rule.valueStatus) !== "SET") {
    return jsonError(409, "VALUE_NOT_CONFIGURED");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.legalRule.update({ where: { id }, data: { status: step.to } });
    if (body.data.action === "approve" && rule.versions[0]) {
      await tx.legalRuleVersion.update({ where: { id: rule.versions[0].id }, data: { approvedById: user.id } });
    }
    return r;
  });

  await writeAudit({
    actorId: user.id,
    action: step.audit,
    entity: "LegalRule",
    entityId: id,
    before: { status: rule.status },
    after: { status: updated.status },
    reason: body.data.reason,
  });
  return NextResponse.json({ data: { id, status: updated.status } });
}
