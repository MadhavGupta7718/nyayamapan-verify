import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { applicationScope, scheduleScope } from "@/server/scope";
import { detectScheduleConflicts } from "@/services/scheduling";
import { createAssignment } from "@/services/assignment";
import { WorkflowError } from "@/services/application-workflow";
import { SCHEDULER_ROLES } from "@/lib/permissions";
import { DEFAULT_SLOT } from "@/lib/assignment-rules";

const schema = z.object({
  applicationId: z.string().uuid(),
  officerId: z.string().uuid(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().max(40).optional(),
  overrideReason: z.string().trim().min(10).max(500).optional(),
});

export async function GET(req: NextRequest) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(new Date().setHours(0, 0, 0, 0));
  const to = sp.get("to") ? new Date(sp.get("to")!) : new Date(from.getTime() + 14 * 86400000);
  const data = await prisma.verificationSchedule.findMany({
    where: { AND: [scheduleScope(user), { scheduledDate: { gte: from, lte: to } }] },
    orderBy: { scheduledDate: "asc" },
    take: 200,
    select: {
      id: true,
      scheduledDate: true,
      timeSlot: true,
      status: true,
      application: { select: { id: true, applicationNumber: true, status: true } },
    },
  });
  return NextResponse.json({ data });
}

/**
 * Manual assignment for approved applications that weren't assigned automatically. A State Admin assigns
 * an LMO or Inspector of their state; a GATC Admin assigns an officer of the GATC the applicant chose.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser(SCHEDULER_ROLES);
  if (response) return response;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  const app = await prisma.application.findFirst({
    where: { AND: [{ id: body.data.applicationId }, applicationScope(user)] },
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      preferredGatcId: true,
      preferredGatc: { select: { stateId: true } },
      instrument: { select: { stateId: true, instrumentTypeId: true } },
    },
  });
  if (!app) return jsonError(404, "NOT_FOUND");
  if (app.status !== "APPROVED") return jsonError(409, "NOT_READY_FOR_SCHEDULING", { status: app.status });

  const gatcRoute = user.role === "GATC_ADMIN";
  if (gatcRoute && (!app.preferredGatcId || app.preferredGatc?.stateId !== user.stateId)) return jsonError(403, "OUTSIDE_JURISDICTION");
  if (!gatcRoute && app.instrument.stateId !== user.stateId) return jsonError(403, "OUTSIDE_JURISDICTION");
  if (!gatcRoute && app.preferredGatcId) return jsonError(409, "GATC_ROUTE");

  const officer = await prisma.user.findFirst({
    where: {
      id: body.data.officerId,
      status: "ACTIVE",
      deletedAt: null,
      ...(gatcRoute ? { role: "GATC_OFFICER", gatcId: app.preferredGatcId } : { role: { in: ["LMO", "INSPECTOR"] }, stateId: user.stateId }),
    },
    select: { id: true, stateId: true, name: true },
  });
  if (!officer) return jsonError(400, "INVALID_OFFICER");

  if (gatcRoute) {
    const authorised = await prisma.gATCInstrumentAuthorization.findFirst({
      where: { gatcId: app.preferredGatcId!, instrumentTypeId: app.instrument.instrumentTypeId },
      select: { id: true },
    });
    if (!authorised) return jsonError(400, "GATC_NOT_AUTHORISED_FOR_TYPE");
  }

  const scheduledDate = new Date(`${body.data.scheduledDate}T00:00:00`);
  const conflicts = await detectScheduleConflicts({
    officerId: officer.id,
    gatcId: gatcRoute ? app.preferredGatcId! : undefined,
    scheduledDate,
    timeSlot: body.data.timeSlot,
    applicationId: app.id,
    stateId: app.instrument.stateId ?? undefined,
    officerStateId: officer.stateId,
  });
  if (conflicts.length && !body.data.overrideReason) return jsonError(409, "CONFLICTS", { conflicts });

  try {
    const { assignment, schedule } = await createAssignment({
      applicationId: app.id,
      applicationNumber: app.applicationNumber,
      officerId: officer.id,
      officerName: officer.name,
      authorityType: gatcRoute ? "GATC" : "LMO",
      gatcId: gatcRoute ? app.preferredGatcId : null,
      scheduledDate,
      timeSlot: body.data.timeSlot || DEFAULT_SLOT,
      actorId: user.id,
      reason: body.data.overrideReason,
      conflicts,
    });
    return NextResponse.json({ data: { assignmentId: assignment.id, scheduleId: schedule.id, conflicts } }, { status: 201 });
  } catch (e) {
    if (e instanceof WorkflowError) return jsonError(409, e.code);
    throw e;
  }
}
