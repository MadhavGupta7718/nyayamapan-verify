import { Role } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId?: string | null;
  stateId?: string | null;
};

const ROLE_HIERARCHY: Record<Role, number> = {
  PUBLIC: 0,
  BUSINESS_USER: 1,
  INSPECTOR: 2,
  LMO: 3,
  GATC_OFFICER: 3,
  GATC_ADMIN: 4,
  AUDITOR: 4,
  STATE_ADMIN: 5,
  SUPER_ADMIN: 6,
};

export function hasRole(user: SessionUser | null | undefined, allowed: Role[]) {
  if (!user) return false;
  return allowed.includes(user.role);
}

export function assertRole(user: SessionUser | null | undefined, allowed: Role[]) {
  if (!hasRole(user, allowed)) {
    const err = new Error("Forbidden");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}

export function canAccessState(
  user: SessionUser,
  stateId: string | null | undefined
) {
  if (user.role === "SUPER_ADMIN" || user.role === "AUDITOR") return true;
  if (!stateId) return false;
  if (user.role === "STATE_ADMIN") return user.stateId === stateId;
  return true;
}

export function isAdmin(user: SessionUser) {
  return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY.STATE_ADMIN;
}
