import type { Role } from "@prisma/client";

export type ModuleKey =
  | "overview"
  | "applications"
  | "instruments"
  | "verification"
  | "scheduling"
  | "certificates"
  | "gatc"
  | "reports"
  | "notifications"
  | "rules"
  | "users"
  | "geography"
  | "audit"
  | "profile"
  | "settings";

const ALL: Role[] = [
  "SUPER_ADMIN",
  "STATE_ADMIN",
  "LMO",
  "GATC_ADMIN",
  "GATC_OFFICER",
  "BUSINESS_USER",
  "INSPECTOR",
  "AUDITOR",
];

export const MODULE_ROLES: Record<ModuleKey, Role[]> = {
  overview: ALL,
  applications: ALL,
  instruments: ["SUPER_ADMIN", "STATE_ADMIN", "BUSINESS_USER", "AUDITOR", "LMO", "INSPECTOR"],
  verification: ["LMO", "INSPECTOR", "GATC_OFFICER"],
  scheduling: ["SUPER_ADMIN", "STATE_ADMIN", "GATC_ADMIN", "LMO", "INSPECTOR", "GATC_OFFICER"],
  certificates: ALL,
  gatc: ["SUPER_ADMIN", "STATE_ADMIN", "GATC_ADMIN", "GATC_OFFICER", "AUDITOR"],
  reports: ["SUPER_ADMIN", "STATE_ADMIN", "AUDITOR", "GATC_ADMIN"],
  notifications: ALL,
  rules: ["SUPER_ADMIN", "STATE_ADMIN", "AUDITOR"],
  users: ["SUPER_ADMIN", "STATE_ADMIN", "GATC_ADMIN"],
  geography: ["SUPER_ADMIN"],
  audit: ["SUPER_ADMIN", "STATE_ADMIN", "AUDITOR"],
  profile: ALL,
  settings: ALL,
};

export function canAccessModule(role: Role, module: ModuleKey) {
  return MODULE_ROLES[module].includes(role);
}

export const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "STATE_ADMIN"];
export const FIELD_ROLES: Role[] = ["LMO", "INSPECTOR", "GATC_OFFICER"];
/** Roles that assign officers to visits. The Super Admin is deliberately read-only here. */
export const SCHEDULER_ROLES: Role[] = ["STATE_ADMIN", "GATC_ADMIN"];

export function isFieldRole(role: Role) {
  return FIELD_ROLES.includes(role);
}

export function isAdminRole(role: Role) {
  return ADMIN_ROLES.includes(role);
}
