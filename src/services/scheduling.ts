import { prisma } from "@/db/client";

export type ScheduleConflict = {
  code: "OFFICER_TIME_CONFLICT" | "OFFICER_DAY_CAPACITY" | "GATC_UNAVAILABLE" | "OUTSIDE_JURISDICTION" | "DUPLICATE_SCHEDULE" | "PAST_DATE";
  message: string;
};

const DAILY_CAPACITY = 6;

export async function detectScheduleConflicts(input: {
  officerId?: string;
  gatcId?: string;
  scheduledDate: Date;
  timeSlot?: string;
  applicationId?: string;
  stateId?: string;
  officerStateId?: string | null;
}) {
  const conflicts: ScheduleConflict[] = [];
  const dayStart = new Date(input.scheduledDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(input.scheduledDate);
  dayEnd.setHours(23, 59, 59, 999);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dayStart < today) conflicts.push({ code: "PAST_DATE", message: "Scheduled date is in the past" });

  const [sameSlot, dayCount, gatc, dup] = await Promise.all([
    input.officerId && input.timeSlot
      ? prisma.verificationSchedule.count({
          where: {
            scheduledDate: { gte: dayStart, lte: dayEnd },
            timeSlot: input.timeSlot,
            status: "SCHEDULED",
            assignment: { officerId: input.officerId },
            NOT: input.applicationId ? { applicationId: input.applicationId } : undefined,
          },
        })
      : Promise.resolve(0),
    input.officerId
      ? prisma.verificationSchedule.count({
          where: { scheduledDate: { gte: dayStart, lte: dayEnd }, status: "SCHEDULED", assignment: { officerId: input.officerId } },
        })
      : Promise.resolve(0),
    input.gatcId ? prisma.gATCProfile.findUnique({ where: { id: input.gatcId }, select: { approvalStatus: true, approvalEnd: true } }) : Promise.resolve(null),
    input.applicationId
      ? prisma.verificationSchedule.findFirst({ where: { applicationId: input.applicationId, status: "SCHEDULED" }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  if (sameSlot) conflicts.push({ code: "OFFICER_TIME_CONFLICT", message: "Officer already has a verification in this slot" });
  if (dayCount >= DAILY_CAPACITY) conflicts.push({ code: "OFFICER_DAY_CAPACITY", message: `Officer already has ${dayCount} verifications that day` });
  if (input.gatcId && (!gatc || gatc.approvalStatus !== "APPROVED" || (gatc.approvalEnd && gatc.approvalEnd < dayStart))) {
    conflicts.push({ code: "GATC_UNAVAILABLE", message: "GATC approval is not valid on that date" });
  }
  if (input.stateId && input.officerStateId && input.stateId !== input.officerStateId) {
    conflicts.push({ code: "OUTSIDE_JURISDICTION", message: "Officer is outside the instrument's state" });
  }
  if (dup) conflicts.push({ code: "DUPLICATE_SCHEDULE", message: "Application already has an active schedule" });

  return conflicts;
}
