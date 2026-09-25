import { prisma } from "@/db/client";
import type { SessionUser } from "@/server/rbac";

export const VERIFIER_ROLES = ["LMO", "INSPECTOR", "GATC_OFFICER"] as const;
/** Assignment statuses that no longer give the officer access (reassigned away, or the visit was dismissed). */
export const INACTIVE_ASSIGNMENT = ["CANCELLED", "REASSIGNED"];

/**
 * Only the officer an application is currently assigned to may carry out its verification.
 * Administrators (Super, State and GATC admins) can view the record but never act on it.
 */
export async function loadVerifiableApplication(user: SessionUser, applicationId: string) {
  if (!(VERIFIER_ROLES as readonly string[]).includes(user.role)) return { error: 403 as const };
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      assignments: { where: { status: { notIn: INACTIVE_ASSIGNMENT } }, select: { officerId: true, authorityType: true } },
      instrument: { include: { instrumentType: true, state: true } },
    },
  });
  if (!app) return { error: 404 as const };
  if (!app.assignments.some((a) => a.officerId === user.id)) return { error: 403 as const };
  return { app };
}

/** Confirms the inspection belongs to the application and hasn't been dismissed. */
export async function loadOpenInspection(applicationId: string, inspectionId: string) {
  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection || inspection.applicationId !== applicationId || inspection.dismissedAt) return null;
  return inspection;
}
