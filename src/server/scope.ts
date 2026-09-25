import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/server/rbac";

/**
 * Row-level data scopes. Every list, search, report and detail query must be combined
 * with the scope for the signed-in user so records outside their jurisdiction never leave the DB.
 */
const NOTHING = { id: "00000000-0000-0000-0000-000000000000" };

export function applicationScope(user: SessionUser): Prisma.ApplicationWhereInput {
  switch (user.role) {
    case "SUPER_ADMIN":
    case "AUDITOR":
      return {};
    case "STATE_ADMIN":
      return user.stateId ? { instrument: { stateId: user.stateId } } : NOTHING;
    case "BUSINESS_USER":
      return user.organizationId ? { organizationId: user.organizationId } : NOTHING;
    case "LMO":
    case "INSPECTOR":
    case "GATC_OFFICER":
      return { assignments: { some: { officerId: user.id, status: { notIn: ["CANCELLED", "REASSIGNED"] } } } };
    case "GATC_ADMIN":
      return user.stateId
        ? {
            OR: [
              { preferredGatc: { stateId: user.stateId }, status: { notIn: ["DRAFT", "CANCELLED"] } },
              { assignments: { some: { authorityType: "GATC", gatc: { stateId: user.stateId } } } },
            ],
          }
        : NOTHING;
    default:
      return NOTHING;
  }
}

export function instrumentScope(user: SessionUser): Prisma.InstrumentWhereInput {
  switch (user.role) {
    case "SUPER_ADMIN":
    case "AUDITOR":
      return { deletedAt: null };
    case "STATE_ADMIN":
      return user.stateId ? { stateId: user.stateId, deletedAt: null } : NOTHING;
    case "BUSINESS_USER":
      return user.organizationId ? { organizationId: user.organizationId, deletedAt: null } : NOTHING;
    case "LMO":
    case "INSPECTOR":
    case "GATC_OFFICER":
    case "GATC_ADMIN":
      return { deletedAt: null, applications: { some: applicationScope(user) } };
    default:
      return NOTHING;
  }
}

export function certificateScope(user: SessionUser): Prisma.CertificateWhereInput {
  if (user.role === "SUPER_ADMIN" || user.role === "AUDITOR") return {};
  return { application: applicationScope(user) };
}

export function scheduleScope(user: SessionUser): Prisma.VerificationScheduleWhereInput {
  if (user.role === "SUPER_ADMIN" || user.role === "AUDITOR") return {};
  return { application: applicationScope(user) };
}

export function userScope(user: SessionUser): Prisma.UserWhereInput {
  if (user.role === "SUPER_ADMIN") return { deletedAt: null };
  if (user.role === "STATE_ADMIN" && user.stateId) {
    return { deletedAt: null, stateId: user.stateId, role: { notIn: ["SUPER_ADMIN"] } };
  }
  if (user.role === "GATC_ADMIN" && user.stateId) {
    return { deletedAt: null, OR: [{ id: user.id }, { stateId: user.stateId, role: "GATC_OFFICER" }] };
  }
  return { id: user.id };
}

export function auditScope(user: SessionUser): Prisma.AuditLogWhereInput {
  if (user.role === "SUPER_ADMIN" || user.role === "AUDITOR") return {};
  if (user.role === "STATE_ADMIN" && user.stateId) return { actor: { stateId: user.stateId } };
  return NOTHING;
}
