import { prisma } from "@/db/client";
import type { SessionUser } from "@/server/rbac";

export const VERIFIER_ROLES = ["LMO", "INSPECTOR", "GATC_OFFICER", "GATC_ADMIN", "SUPER_ADMIN"] as const;

/**
 * An officer may act on an application only if they are the assigned officer
 * (or, for GATC admins, the assignment belongs to a GATC in their state). Super admins may act on any.
 */
export async function loadVerifiableApplication(user: SessionUser, applicationId: string) {
  if (!(VERIFIER_ROLES as readonly string[]).includes(user.role)) return { error: 403 as const };
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      assignments: { select: { officerId: true, authorityType: true, gatc: { select: { stateId: true } } } },
      instrument: { include: { instrumentType: true, state: true } },
    },
  });
  if (!app) return { error: 404 as const };
  const allowed =
    user.role === "SUPER_ADMIN" ||
    app.assignments.some((a) => a.officerId === user.id) ||
    (user.role === "GATC_ADMIN" && app.assignments.some((a) => a.authorityType === "GATC" && a.gatc?.stateId === user.stateId));
  if (!allowed) return { error: 403 as const };
  return { app };
}

/** Confirms the inspection belongs to the application and is still open. */
export async function loadOpenInspection(applicationId: string, inspectionId: string) {
  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection || inspection.applicationId !== applicationId) return null;
  return inspection;
}
