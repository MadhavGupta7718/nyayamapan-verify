import { prisma } from "@/db/client";
import { writeAudit } from "@/server/audit";
import { INACTIVE_ASSIGNMENT } from "@/server/verification-access";
import { notifyUser } from "@/services/notifications";
import { detectScheduleConflicts, type ScheduleConflict } from "@/services/scheduling";
import { transitionApplication } from "@/services/application-workflow";
import { DEFAULT_SLOT, OPEN_TASK_STATUSES, pickLeastLoaded, visitDate } from "@/lib/assignment-rules";

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Open (not yet completed) verification tasks per officer. */
export async function openTaskCounts(officerIds: string[]) {
  if (!officerIds.length) return new Map<string, number>();
  const rows = await prisma.verificationAssignment.groupBy({
    by: ["officerId"],
    where: { officerId: { in: officerIds }, status: { notIn: INACTIVE_ASSIGNMENT }, application: { status: { in: [...OPEN_TASK_STATUSES] } } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.officerId!, r._count._all]));
}

async function notifyRole(role: "STATE_ADMIN" | "GATC_ADMIN", stateId: string | null | undefined, title: string, body: string, meta: object) {
  if (!stateId) return;
  const admins = await prisma.user.findMany({ where: { role, stateId, status: "ACTIVE", deletedAt: null }, select: { id: true } });
  await Promise.all(admins.map((a) => notifyUser({ userId: a.id, type: "ASSIGNMENT", title, body, meta })));
}

export const notifyStateAdmins = (stateId: string | null | undefined, title: string, body: string, meta: object) => notifyRole("STATE_ADMIN", stateId, title, body, meta);

/**
 * Creates the assignment and visit for an approved application, moves it to ASSIGNED and tells the officer.
 * Callers are responsible for checking who may assign whom.
 */
export async function createAssignment(input: {
  applicationId: string;
  applicationNumber: string;
  officerId: string;
  officerName: string;
  authorityType: "LMO" | "GATC";
  gatcId?: string | null;
  scheduledDate: Date;
  timeSlot: string;
  actorId?: string;
  reason?: string;
  conflicts?: ScheduleConflict[];
  auto?: boolean;
}) {
  const conflicts = input.conflicts ?? [];
  const { assignment, schedule } = await prisma.$transaction(async (tx) => {
    const assignment = await tx.verificationAssignment.create({
      data: {
        applicationId: input.applicationId,
        officerId: input.officerId,
        gatcId: input.gatcId ?? undefined,
        authorityType: input.authorityType,
        notes: input.auto ? "Assigned automatically by district workload" : input.reason ? `Scheduled with override: ${input.reason}` : undefined,
      },
    });
    const schedule = await tx.verificationSchedule.create({
      data: {
        applicationId: input.applicationId,
        assignmentId: assignment.id,
        scheduledDate: input.scheduledDate,
        timeSlot: input.timeSlot,
        conflictFlags: conflicts.length ? conflicts : undefined,
      },
    });
    return { assignment, schedule };
  });

  await transitionApplication({ applicationId: input.applicationId, to: "SCHEDULED", actorId: input.actorId, notify: false });
  await transitionApplication({ applicationId: input.applicationId, to: "ASSIGNED", actorId: input.actorId, reason: input.reason, remarks: input.officerName });

  await writeAudit({
    actorId: input.actorId,
    action: input.auto ? "OFFICER_AUTO_ASSIGNED" : conflicts.length ? "OFFICER_ASSIGNED_WITH_OVERRIDE" : "OFFICER_ASSIGNED",
    entity: "Application",
    entityId: input.applicationId,
    after: { assignmentId: assignment.id, scheduleId: schedule.id, officerId: input.officerId, conflicts },
    reason: input.reason,
  });
  const day = isoDay(input.scheduledDate);
  await notifyUser({
    userId: input.officerId,
    type: "ASSIGNMENT",
    title: `New verification assignment ${input.applicationNumber}`,
    body: `Scheduled for ${day} (${input.timeSlot}).`,
    meta: { applicationId: input.applicationId, applicationNumber: input.applicationNumber, scheduledDate: day },
  });
  return { assignment, schedule, conflicts };
}

export type AutoAssignOutcome =
  | { assigned: true; officerId: string; officerName: string; scheduledDate: string }
  | { assigned: false; reason: "GATC_ROUTE" | "NO_DISTRICT" | "NO_OFFICER" | "NOT_APPROVED" };

/**
 * Runs when a State Admin approves an application. LMO-route applications go to the active LMO covering
 * the instrument's district with the fewest open tasks, on the applicant's preferred date if it is a
 * future working day. GATC-route applications are handed to the GATC Admins of that state. When no one
 * can be chosen the application stays APPROVED and the State Admins are told to assign it manually.
 */
export async function autoAssign(applicationId: string, actorId?: string): Promise<AutoAssignOutcome> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      preferredDate: true,
      preferredSlot: true,
      preferredGatc: { select: { id: true, name: true, stateId: true } },
      instrument: { select: { stateId: true, districtId: true, district: { select: { name: true } } } },
    },
  });
  if (!app || app.status !== "APPROVED") return { assigned: false, reason: "NOT_APPROVED" };
  const meta = { applicationId: app.id, applicationNumber: app.applicationNumber };

  if (app.preferredGatc) {
    await notifyRole(
      "GATC_ADMIN",
      app.preferredGatc.stateId,
      `Assign a GATC officer for ${app.applicationNumber}`,
      `The applicant chose ${app.preferredGatc.name}. Assign one of its officers from Scheduling.`,
      meta
    );
    return { assigned: false, reason: "GATC_ROUTE" };
  }

  const { stateId, districtId } = app.instrument;
  if (!districtId) {
    await notifyStateAdmins(stateId, `Assign an officer for ${app.applicationNumber}`, "The instrument has no district on record, so it couldn't be assigned automatically.", meta);
    return { assigned: false, reason: "NO_DISTRICT" };
  }

  const lmos = await prisma.user.findMany({
    where: { role: "LMO", status: "ACTIVE", deletedAt: null, stateId: stateId ?? undefined, jurisdiction: { some: { id: districtId } } },
    select: { id: true, name: true, stateId: true },
  });
  const counts = await openTaskCounts(lmos.map((l) => l.id));
  const officer = pickLeastLoaded(lmos.map((l) => ({ ...l, openTasks: counts.get(l.id) ?? 0 })));
  if (!officer) {
    await notifyStateAdmins(
      stateId,
      `Assign an officer for ${app.applicationNumber}`,
      `No active Legal Metrology Officer covers ${app.instrument.district?.name ?? "this district"}. Assign one from Scheduling.`,
      meta
    );
    return { assigned: false, reason: "NO_OFFICER" };
  }

  const scheduledDate = visitDate(app.preferredDate);
  const timeSlot = app.preferredSlot || DEFAULT_SLOT;
  const conflicts = await detectScheduleConflicts({ officerId: officer.id, scheduledDate, timeSlot, applicationId: app.id, stateId: stateId ?? undefined, officerStateId: officer.stateId });
  await createAssignment({
    applicationId: app.id,
    applicationNumber: app.applicationNumber,
    officerId: officer.id,
    officerName: officer.name,
    authorityType: "LMO",
    scheduledDate,
    timeSlot,
    actorId,
    conflicts,
    auto: true,
  });
  return { assigned: true, officerId: officer.id, officerName: officer.name, scheduledDate: isoDay(scheduledDate) };
}
