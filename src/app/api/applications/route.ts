import { NextRequest, NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { applicationScope, instrumentScope } from "@/server/scope";
import { missingRequiredDocuments, transitionApplication } from "@/services/application-workflow";
import { writeAudit } from "@/server/audit";
import { pageMeta } from "@/lib/list-params";

const appSerial = customAlphabet("0123456789", 6);

const createSchema = z.object({
  instrumentId: z.string().uuid(),
  verificationType: z.enum(["INITIAL_VERIFICATION", "RE_VERIFICATION", "OTHER_APPLICABLE"]),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  preferredSlot: z.string().max(40).optional(),
  remarks: z.string().max(2000).optional(),
  declarationAccepted: z.boolean().optional(),
  submit: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 20));
  const status = sp.get("status");
  const where = {
    AND: [applicationScope(user), status ? { status: status as never } : {}],
  };
  const total = await prisma.application.count({ where });
  const meta = pageMeta(total, page, pageSize);
  const data = await prisma.application.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: meta.skip,
    take: pageSize,
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      verificationType: true,
      updatedAt: true,
      instrument: { select: { serialNumber: true, instrumentType: { select: { name: true } } } },
      organization: { select: { name: true } },
    },
  });
  return NextResponse.json({ data, meta });
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser(["BUSINESS_USER", "SUPER_ADMIN", "STATE_ADMIN"]);
  if (response) return response;
  const body = createSchema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);
  if (body.data.submit && !body.data.declarationAccepted) return jsonError(400, "DECLARATION_REQUIRED");

  const instrument = await prisma.instrument.findFirst({
    where: { AND: [{ id: body.data.instrumentId }, instrumentScope(user)] },
    select: { id: true, organizationId: true },
  });
  if (!instrument) return jsonError(404, "INSTRUMENT_NOT_FOUND");

  const open = await prisma.application.findFirst({
    where: {
      instrumentId: instrument.id,
      status: { notIn: ["ACTIVE", "REJECTED", "CANCELLED", "EXPIRED", "REVOKED", "FAIL"] },
    },
    select: { applicationNumber: true },
  });
  if (open) return jsonError(409, "OPEN_APPLICATION_EXISTS", { applicationNumber: open.applicationNumber });

  const app = await prisma.application.create({
    data: {
      applicationNumber: `LMA-${new Date().getFullYear()}-${appSerial()}`,
      organizationId: instrument.organizationId,
      instrumentId: instrument.id,
      createdById: user.id,
      verificationType: body.data.verificationType,
      preferredDate: body.data.preferredDate ? new Date(body.data.preferredDate) : undefined,
      preferredSlot: body.data.preferredSlot,
      remarks: body.data.remarks,
      declarationAccepted: !!body.data.declarationAccepted,
      status: "DRAFT",
      isDemo: false,
      statusHistory: { create: { previousStatus: null, newStatus: "DRAFT", changedById: user.id } },
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "APPLICATION_CREATED",
    entity: "Application",
    entityId: app.id,
    after: { applicationNumber: app.applicationNumber },
  });

  if (body.data.submit && (await missingRequiredDocuments(app.id)).length === 0) {
    const submitted = await transitionApplication({ applicationId: app.id, to: "SUBMITTED", actorId: user.id });
    return NextResponse.json({ data: submitted }, { status: 201 });
  }
  return NextResponse.json({ data: app }, { status: 201 });
}
