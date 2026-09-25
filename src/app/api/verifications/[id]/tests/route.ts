import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { loadOpenInspection, loadVerifiableApplication } from "@/server/verification-access";
import { legalRuleEngine } from "@/services/legal-rule-engine";
import { writeAudit } from "@/server/audit";

const schema = z.object({
  inspectionId: z.string().uuid(),
  testName: z.string().trim().min(2).max(120),
  unit: z.string().trim().max(20).optional(),
  referenceValue: z.number().finite(),
  observedValue: z.number().finite(),
});

/**
 * Records a measurement. The permissible error is taken only from an ACTIVE rule; if none is
 * configured the test stays PENDING and the officer must apply the statutory table manually.
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

  const rules = await legalRuleEngine.getApplicableRules({
    instrumentTypeCode: res.app.instrument.instrumentType.code,
    stateCode: res.app.instrument.state?.code,
  });
  const mpeRule = rules.find((r) => r.parameter === "permissible_error" && r.valueStatus === "SET" && r.value);
  const mpe = mpeRule ? Number(mpeRule.value) : null;
  const v = legalRuleEngine.validateMeasurement({
    observedValue: body.data.observedValue,
    referenceValue: body.data.referenceValue,
    permissibleError: Number.isFinite(mpe) ? mpe : null,
  });
  const result = v.result === "CONFIGURATION_REQUIRED" ? "PENDING" : v.result;

  const test = await prisma.inspectionTest.create({
    data: {
      inspectionId: inspection.id,
      testName: body.data.testName,
      expectedValue: String(body.data.referenceValue),
      observedValue: String(body.data.observedValue),
      unit: body.data.unit,
      permissibleError: mpe == null ? "CONFIGURATION_REQUIRED" : String(mpe),
      calculatedError: String(Number(v.error.toFixed(6))),
      result,
      ruleVersionRef: mpeRule?.ruleVersion?.id,
    },
  });
  await prisma.inspectionMeasurement.create({
    data: {
      inspectionId: inspection.id,
      label: body.data.testName,
      observedValue: body.data.observedValue,
      referenceValue: body.data.referenceValue,
      error: v.error,
      permissibleError: mpe ?? undefined,
      unit: body.data.unit,
      result,
      calculationNote: v.message,
    },
  });
  await writeAudit({ actorId: user.id, action: "TEST_RECORDED", entity: "InspectionTest", entityId: test.id, after: { result } });
  return NextResponse.json({ data: test, note: v.message }, { status: 201 });
}
