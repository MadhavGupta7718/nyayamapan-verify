import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { applicationScope } from "@/server/scope";
import { writeAudit } from "@/server/audit";
import { INACTIVE_ASSIGNMENT } from "@/server/verification-access";
import { notifyUser } from "@/services/notifications";
import { detectScheduleConflicts } from "@/services/scheduling";
import { SCHEDULER_ROLES } from "@/lib/permissions";
import { DEFAULT_SLOT, REASSIGNABLE } from "@/lib/assignment-rules";

const schema = z.object({
  officerId: z.string().uuid(),
  reason: z.string().trim().min(10).max(500),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeSlot: z.string().max(40).optional(),
});

/**
 * Moves an assigned, not-yet-started verification to another officer. State Admins reassign LMO-route
 * tasks within their state; GATC Admins reassign among officers of the centre the applicant chose.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser(SCHEDULER_ROLES);
  if (response) return response;
  const { id } = await ctx.params;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  const app = await prisma.application.findFirst({
    where: { AND: [{ id }, applicationScope(user)] },
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      instrument: { select: { stateId: true } },
      assignments: {
        where: { status: { notIn: INACTIVE_ASSIGNMENT } },
        orderBy: { assignedAt: "desc" },
        take: 1,
        select: {
          id: true,
          officerId: true,
          gatcId: true,
          authorityType: true,
          officer: { select: { name: true } },
          schedules: { where: { status: "SCHEDULED" }, take: 1, select: { id: true, scheduledDate: true, timeSlot: true } },
        },
      },
    },
  });
  if (!app) return jsonError(404, "NOT_FOUND");
  if (!REASSIGNABLE.includes(app.status)) return jsonError(409, "NOT_REASSIGNABLE", { status: app.status });
  const current = app.assignments[0];
  if (!current) return jsonError(409, "NOT_REASSIGNABLE");
  if (current.officerId === body.data.officerId) return jsonError(400, "SAME_OFFICER");

  const gatcRoute = current.authorityType === "GATC";
  if (gatcRoute !== (user.role === "GATC_ADMIN")) return jsonError(403, "OUTSIDE_JURISDICTION");
  if (gatcRoute) {
    const gatc = current.gatcId ? await prisma.gATCProfile.findUnique({ where: { id: current.gatcId }, select: { stateId: true } }) : null;
    if (!gatc || gatc.stateId !== user.stateId) return jsonError(403, "OUTSIDE_JURISDICTION");
  } else if (app.instrument.stateId !== user.stateId) return jsonError(403, "OUTSIDE_JURISDICTION");

  const officer = await prisma.user.findFirst({
    where: {
      id: body.data.officerId,
      status: "ACTIVE",
      deletedAt: null,
      ...(gatcRoute ? { role: "GATC_OFFICER", gatcId: current.gatcId } : { role: { in: ["LMO", "INSPECTOR"] }, stateId: user.stateId }),
    },
    select: { id: true, name: true, stateId: true },
  });
  if (!officer) return jsonError(400, "INVALID_OFFICER");

  const visit = current.schedules[0];
  const scheduledDate = body.data.scheduledDate ? new Date(`${body.data.scheduledDate}T00:00:00`) : (visit?.scheduledDate ?? new Date(Date.now() + 86_400_000));
  const timeSlot = body.data.timeSlot || visit?.timeSlot || DEFAULT_SLOT;
  const conflicts = (
    await detectScheduleConflicts({ officerId: officer.id, scheduledDate, timeSlot, stateId: app.instrument.stateId ?? undefined, officerStateId: officer.stateId })
  ).filter((c) => c.code !== "DUPLICATE_SCHEDULE");

  const next = await prisma.$transaction(async (tx) => {
    await tx.verificationAssignment.update({ where: { id: current.id }, data: { status: "REASSIGNED", notes: `Reassigned: ${body.data.reason}` } });
    if (visit) await tx.verificationSchedule.update({ where: { id: visit.id }, data: { status: "CANCELLED" } });
    const assignment = await tx.verificationAssignment.create({
      data: { applicationId: app.id, officerId: officer.id, gatcId: current.gatcId, authorityType: current.authorityType, notes: `Reassigned from ${current.officer?.name ?? "previous officer"}` },
    });
    const schedule = await tx.verificationSchedule.create({
      data: { applicationId: app.id, assignmentId: assignment.id, scheduledDate, timeSlot, conflictFlags: conflicts.length ? conflicts : undefined },
    });
    return { assignment, schedule };
  });

  await writeAudit({
    actorId: user.id,
    action: "OFFICER_REASSIGNED",
    entity: "Application",
    entityId: app.id,
    before: { assignmentId: current.id, officerId: current.officerId, scheduleId: visit?.id ?? null },
    after: { assignmentId: next.assignment.id, officerId: officer.id, scheduleId: next.schedule.id, conflicts },
    reason: body.data.reason,
  });
  const day = scheduledDate.toISOString().slice(0, 10);
  const meta = { applicationId: app.id, applicationNumber: app.applicationNumber, scheduledDate: day };
  await notifyUser({ userId: officer.id, type: "ASSIGNMENT", title: `New verification assignment ${app.applicationNumber}`, body: `Scheduled for ${day} (${timeSlot}).`, meta });
  if (current.officerId) {
    await notifyUser({ userId: current.officerId, type: "ASSIGNMENT", title: `${app.applicationNumber} reassigned`, body: `This verification has moved to ${officer.name}.`, meta });
  }
  return NextResponse.json({ data: { assignmentId: next.assignment.id, scheduleId: next.schedule.id, conflicts } });
}
