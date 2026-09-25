import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { jsonError, requireApiUser } from "@/server/api";
import { loadVerifiableApplication } from "@/server/verification-access";
import { transitionApplication, WorkflowError } from "@/services/application-workflow";
import { legalRuleEngine } from "@/services/legal-rule-engine";
import { writeAudit } from "@/server/audit";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { id } = await ctx.params;
  const res = await loadVerifiableApplication(user, id);
  if ("error" in res) return jsonError(res.error!, res.error === 404 ? "NOT_FOUND" : "FORBIDDEN");
  const app = res.app;

  const existing = await prisma.inspection.findFirst({
    where: { applicationId: app.id, completedAt: null, dismissedAt: null },
    orderBy: { createdAt: "desc" },
    include: { checklists: true },
  });
  if (existing && app.status === "FIELD_VERIFICATION") {
    return NextResponse.json({ data: existing, resumed: true });
  }
  if (app.status !== "ASSIGNED") return jsonError(409, "NOT_READY_FOR_VERIFICATION", { status: app.status });

  const checklist = await legalRuleEngine.getVerificationChecklist({
    instrumentTypeCode: app.instrument.instrumentType.code,
    stateCode: app.instrument.state?.code,
  });

  try {
    await transitionApplication({ applicationId: app.id, to: "FIELD_VERIFICATION", actorId: user.id });
  } catch (e) {
    if (e instanceof WorkflowError) return jsonError(409, e.code);
    throw e;
  }

  const inspection = await prisma.inspection.create({
    data: {
      applicationId: app.id,
      officerId: user.id,
      startedAt: new Date(),
      checklists: {
        create: checklist.items.map((i) => ({ itemKey: i.key, itemLabel: i.label, ruleRef: i.ruleRef })),
      },
    },
    include: { checklists: true },
  });

  await writeAudit({ actorId: user.id, action: "VERIFICATION_STARTED", entity: "Inspection", entityId: inspection.id });
  return NextResponse.json({ data: inspection, checklistNote: checklist.note }, { status: 201 });
}
