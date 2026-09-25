import type { Role } from "@prisma/client";

/**
 * Who provisions whom. The Super Admin sets up each state's administrators, auditors and inspectors;
 * a State Admin (Controller) adds Legal Metrology Officers for their state; a GATC Admin adds officers
 * for the GATCs in their state.
 */
export const CREATABLE_ROLES: Partial<Record<Role, Role[]>> = {
  SUPER_ADMIN: ["STATE_ADMIN", "GATC_ADMIN", "AUDITOR", "INSPECTOR"],
  STATE_ADMIN: ["LMO"],
  GATC_ADMIN: ["GATC_OFFICER"],
};

export function creatableRoles(role: Role): Role[] {
  return CREATABLE_ROLES[role] ?? [];
}

type Person = { id: string; role: Role; stateId?: string | null };

/** Whether `actor` may edit the details or change the status of `target`. Nobody manages their own account here. */
export function canManageUser(actor: Person, target: Person) {
  if (actor.id === target.id) return false;
  if (actor.role === "SUPER_ADMIN") return true;
  if (!actor.stateId || actor.stateId !== target.stateId) return false;
  if (actor.role === "STATE_ADMIN") return target.role === "LMO" || target.role === "BUSINESS_USER";
  if (actor.role === "GATC_ADMIN") return target.role === "GATC_OFFICER";
  return false;
}

/** LMOs are mapped to the districts they cover; GATC officers to their centre. */
export const needsDistricts = (role: Role) => role === "LMO";
export const needsGatc = (role: Role) => role === "GATC_OFFICER";
