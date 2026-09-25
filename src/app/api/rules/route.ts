import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { readJson, requireApiUser, validationError } from "@/server/api";
import { writeAudit } from "@/server/audit";
import { MODULE_ROLES } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const { user, response } = await requireApiUser();
  if (response) return response;

  const url = new URL(req.url);
  if (url.searchParams.get("applicable") === "1") {
    const { legalRuleEngine } = await import("@/services/legal-rule-engine");
    const data = await legalRuleEngine.getApplicableRules({
      instrumentTypeCode: url.searchParams.get("instrumentType") ?? undefined,
      stateCode: url.searchParams.get("state") ?? undefined,
      verificationDate: new Date(),
    });
    return NextResponse.json({ data });
  }

  if (!MODULE_ROLES.rules.includes(user.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rules = await prisma.legalRule.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      ruleKey: true,
      ruleName: true,
      parameter: true,
      value: true,
      unit: true,
      valueStatus: true,
      status: true,
      updatedAt: true,
      instrumentType: { select: { name: true } },
      versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { versionNumber: true, effectiveFrom: true } },
    },
  });
  return NextResponse.json({ data: rules });
}

const createSchema = z
  .object({
    ruleKey: z.string().trim().regex(/^[A-Z0-9_.]{3,80}$/),
    actName: z.string().trim().min(3).max(200),
    ruleName: z.string().trim().min(3).max(200),
    ruleNumber: z.string().trim().max(60).optional(),
    sectionNumber: z.string().trim().max(60).optional(),
    parameter: z.string().trim().min(2).max(80),
    value: z.string().trim().max(200).optional(),
    valueStatus: z.enum(["SET", "CONFIGURATION_REQUIRED"]).default("CONFIGURATION_REQUIRED"),
    unit: z.string().trim().max(40).optional(),
    requirement: z.string().trim().min(3).max(2000),
    sourceNotification: z.string().trim().max(300).optional(),
    sourceDocument: z.string().trim().url().max(500).optional().or(z.literal("")),
    amendmentReference: z.string().trim().max(300).optional(),
    instrumentTypeId: z.string().uuid().optional().or(z.literal("")),
    stateCode: z.string().trim().max(10).optional(),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((d) => d.valueStatus !== "SET" || !!d.value, { path: ["value"], message: "VALUE_REQUIRED" })
  .refine((d) => d.valueStatus !== "SET" || !!d.sourceNotification || !!d.sourceDocument, {
    path: ["sourceNotification"],
    message: "SOURCE_REQUIRED",
  });

/** New rules always start as DRAFT; a value marked SET must cite its legal source. */
export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN"]);
  if (response) return response;
  const body = createSchema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);
  const d = body.data;

  const rule = await prisma.legalRule.create({
    data: {
      ruleKey: d.ruleKey,
      actName: d.actName,
      ruleName: d.ruleName,
      ruleNumber: d.ruleNumber,
      sectionNumber: d.sectionNumber,
      parameter: d.parameter,
      value: d.valueStatus === "SET" ? d.value : null,
      valueStatus: d.valueStatus,
      unit: d.unit,
      requirement: d.requirement,
      sourceNotification: d.sourceNotification,
      sourceDocument: d.sourceDocument || null,
      amendmentReference: d.amendmentReference,
      instrumentTypeId: d.instrumentTypeId || null,
      stateCode: d.stateCode,
      status: "DRAFT",
      versions: {
        create: {
          versionNumber: 1,
          value: d.valueStatus === "SET" ? d.value : null,
          valueStatus: d.valueStatus,
          effectiveFrom: new Date(`${d.effectiveFrom}T00:00:00Z`),
          changeReason: "Initial version",
        },
      },
    },
    select: { id: true, status: true },
  });

  await writeAudit({ actorId: user.id, action: "RULE_CREATED", entity: "LegalRule", entityId: rule.id, after: { status: "DRAFT", ruleKey: d.ruleKey } });
  return NextResponse.json({ data: rule }, { status: 201 });
}
