import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { applicationScope, scheduleScope } from "@/server/scope";
import { detectScheduleConflicts } from "@/services/scheduling";
import { transitionApplication, WorkflowError } from "@/services/application-workflow";
import { writeAudit } from "@/server/audit";
import { notifyUser } from "@/services/notifications";

const schema = z
  .object({
    applicationId: z.string().uuid(),
    authorityType: z.enum(["LMO", "GATC"]).default("LMO"),
    officerId: z.string().uuid(),
    gatcId: z.string().uuid().optional(),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeSlot: z.string().max(40).optional(),
    overrideReason: z.string().trim().min(10).max(500).optional(),
  })
  .refine((v) => v.authorityType === "LMO" || !!v.gatcId, { message: "gatcId required for GATC", path: ["gatcId"] });

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

export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN", "STATE_ADMIN", "GATC_ADMIN"]);
  if (response) return response;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  const app = await prisma.application.findFirst({
    where: { AND: [{ id: body.data.applicationId }, user.role === "GATC_ADMIN" ? {} : applicationScope(user)] },
    include: { instrument: { select: { stateId: true, instrumentTypeId: true } } },
  });
  if (!app) return jsonError(404, "NOT_FOUND");
  if (app.status !== "APPROVED") return jsonError(409, "NOT_READY_FOR_SCHEDULING", { status: app.status });
  if (user.role === "GATC_ADMIN" && app.instrument.stateId !== user.stateId) return jsonError(403, "OUTSIDE_JURISDICTION");

  const officer = await prisma.user.findFirst({
    where: {
      id: body.data.officerId,
      status: "ACTIVE",
      deletedAt: null,
      role: body.data.authorityType === "GATC" ? { in: ["GATC_OFFICER", "GATC_ADMIN"] } : { in: ["LMO", "INSPECTOR"] },
    },
    select: { id: true, stateId: true, name: true },
  });
  if (!officer) return jsonError(400, "INVALID_OFFICER");

  if (body.data.gatcId) {
    const authorised = await prisma.gATCInstrumentAuthorization.findFirst({
      where: { gatcId: body.data.gatcId, instrumentTypeId: app.instrument.instrumentTypeId },
      select: { id: true },
    });
    if (!authorised) return jsonError(400, "GATC_NOT_AUTHORISED_FOR_TYPE");
  }

  const scheduledDate = new Date(`${body.data.scheduledDate}T00:00:00`);
  const conflicts = await detectScheduleConflicts({
    officerId: officer.id,
    gatcId: body.data.gatcId,
    scheduledDate,
    timeSlot: body.data.timeSlot,
    applicationId: app.id,
    stateId: app.instrument.stateId ?? undefined,
    officerStateId: officer.stateId,
  });
  if (conflicts.length && !body.data.overrideReason) {
    return jsonError(409, "CONFLICTS", { conflicts });
  }

  const { assignment, schedule } = await prisma.$transaction(async (tx) => {
    const assignment = await tx.verificationAssignment.create({
      data: {
        applicationId: app.id,
        officerId: officer.id,
        gatcId: body.data.gatcId,
        authorityType: body.data.authorityType,
        notes: body.data.overrideReason ? `Scheduled with override: ${body.data.overrideReason}` : undefined,
      },
    });
    const schedule = await tx.verificationSchedule.create({
      data: {
        applicationId: app.id,
        assignmentId: assignment.id,
        scheduledDate,
        timeSlot: body.data.timeSlot,
        conflictFlags: conflicts.length ? conflicts : undefined,
      },
    });
    return { assignment, schedule };
  });

  try {
    await transitionApplication({ applicationId: app.id, to: "SCHEDULED", actorId: user.id, notify: false });
    await transitionApplication({
      applicationId: app.id,
      to: "ASSIGNED",
      actorId: user.id,
      reason: body.data.overrideReason,
      remarks: officer.name,
    });
  } catch (e) {
    if (e instanceof WorkflowError) return jsonError(409, e.code);
    throw e;
  }

  await writeAudit({
    actorId: user.id,
    action: conflicts.length ? "OFFICER_ASSIGNED_WITH_OVERRIDE" : "OFFICER_ASSIGNED",
    entity: "Application",
    entityId: app.id,
    after: { assignmentId: assignment.id, scheduleId: schedule.id, conflicts },
    reason: body.data.overrideReason,
  });
  await notifyUser({
    userId: officer.id,
    type: "ASSIGNMENT",
    title: `New verification assignment ${app.applicationNumber}`,
    body: `Scheduled for ${body.data.scheduledDate}${body.data.timeSlot ? ` (${body.data.timeSlot})` : ""}.`,
    meta: { applicationId: app.id, applicationNumber: app.applicationNumber, scheduledDate: body.data.scheduledDate },
  });

  return NextResponse.json({ data: { assignmentId: assignment.id, scheduleId: schedule.id, conflicts } }, { status: 201 });
}
