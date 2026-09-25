/**
 * Single status vocabulary for the whole portal. Every badge, timeline node and chart
 * legend resolves its tone and icon from here; labels/descriptions live in messages
 * under `status.<KEY>.label|desc`.
 */
export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

export type StatusIcon =
  | "check"
  | "clock"
  | "alert"
  | "x"
  | "ban"
  | "file"
  | "search"
  | "calendar"
  | "user"
  | "map"
  | "stamp"
  | "award"
  | "pause"
  | "rotate"
  | "circle"
  | "help";

type StatusDef = { tone: Tone; icon: StatusIcon };

export const STATUS: Record<string, StatusDef> = {
  // Application workflow
  DRAFT: { tone: "neutral", icon: "file" },
  SUBMITTED: { tone: "info", icon: "file" },
  DOCUMENT_REVIEW: { tone: "info", icon: "search" },
  APPROVED: { tone: "brand", icon: "check" },
  RETURNED: { tone: "warning", icon: "rotate" },
  REJECTED: { tone: "danger", icon: "x" },
  SCHEDULED: { tone: "brand", icon: "calendar" },
  ASSIGNED: { tone: "brand", icon: "user" },
  FIELD_VERIFICATION: { tone: "info", icon: "map" },
  INSPECTION_COMPLETED: { tone: "info", icon: "check" },
  PASS: { tone: "success", icon: "check" },
  FAIL: { tone: "danger", icon: "x" },
  STAMPING: { tone: "brand", icon: "stamp" },
  CERTIFICATE_GENERATED: { tone: "brand", icon: "award" },
  CERTIFICATE_ISSUED: { tone: "success", icon: "award" },
  ACTIVE: { tone: "success", icon: "check" },
  CANCELLED: { tone: "neutral", icon: "ban" },
  EXPIRED: { tone: "warning", icon: "clock" },
  SUSPENDED: { tone: "warning", icon: "pause" },
  REVOKED: { tone: "danger", icon: "ban" },
  // Certificate / public verification
  VALID: { tone: "success", icon: "check" },
  INVALID: { tone: "neutral", icon: "help" },
  EXPIRING: { tone: "warning", icon: "clock" },
  // Rules
  UNDER_REVIEW: { tone: "info", icon: "search" },
  RETIRED: { tone: "neutral", icon: "ban" },
  CONFIGURATION_REQUIRED: { tone: "warning", icon: "alert" },
  // Checklist / tests
  NA: { tone: "neutral", icon: "circle" },
  PENDING: { tone: "neutral", icon: "clock" },
  // Instrument verification status
  VERIFIED: { tone: "success", icon: "check" },
  EXPIRING_SOON: { tone: "warning", icon: "clock" },
  REGISTERED: { tone: "neutral", icon: "file" },
  // Accounts
  INACTIVE: { tone: "neutral", icon: "pause" },
  // Schedules
  COMPLETED: { tone: "success", icon: "check" },
};

export function statusDef(key: string | null | undefined): StatusDef {
  if (!key) return { tone: "neutral", icon: "circle" };
  return STATUS[key] ?? { tone: "neutral", icon: "circle" };
}

export const TONE_CLASSES: Record<Tone, { badge: string; dot: string; soft: string; text: string; ring: string }> = {
  success: {
    badge: "bg-success-50 text-success-800 ring-success-200",
    dot: "bg-success-500",
    soft: "bg-success-50",
    text: "text-success-700",
    ring: "ring-success-200",
  },
  warning: {
    badge: "bg-warning-50 text-warning-800 ring-warning-200",
    dot: "bg-warning-500",
    soft: "bg-warning-50",
    text: "text-warning-700",
    ring: "ring-warning-200",
  },
  danger: {
    badge: "bg-danger-50 text-danger-800 ring-danger-200",
    dot: "bg-danger-500",
    soft: "bg-danger-50",
    text: "text-danger-700",
    ring: "ring-danger-200",
  },
  info: {
    badge: "bg-info-50 text-info-800 ring-info-200",
    dot: "bg-info-500",
    soft: "bg-info-50",
    text: "text-info-700",
    ring: "ring-info-200",
  },
  neutral: {
    badge: "bg-ink-50 text-ink-700 ring-ink-200",
    dot: "bg-ink-400",
    soft: "bg-ink-50",
    text: "text-ink-600",
    ring: "ring-ink-200",
  },
  brand: {
    badge: "bg-brand-50 text-brand-800 ring-brand-200",
    dot: "bg-brand-500",
    soft: "bg-brand-50",
    text: "text-brand-700",
    ring: "ring-brand-200",
  },
};

/** Groups used by filters and dashboards. */
export const APPLICATION_STAGE_GROUPS = {
  needsReview: ["SUBMITTED", "DOCUMENT_REVIEW"],
  readyToSchedule: ["APPROVED"],
  inField: ["SCHEDULED", "ASSIGNED", "FIELD_VERIFICATION", "INSPECTION_COMPLETED"],
  certification: ["PASS", "STAMPING", "CERTIFICATE_GENERATED", "CERTIFICATE_ISSUED"],
  completed: ["ACTIVE"],
  actionRequired: ["RETURNED", "FAIL"],
  closed: ["REJECTED", "CANCELLED", "EXPIRED", "REVOKED", "SUSPENDED"],
} as const;

export const WORKFLOW_MILESTONES = [
  "SUBMITTED",
  "DOCUMENT_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "FIELD_VERIFICATION",
  "INSPECTION_COMPLETED",
  "STAMPING",
  "ACTIVE",
] as const;

/** Maps any application status to the index of the milestone it has reached. */
export function milestoneIndex(status: string): number {
  const order: Record<string, number> = {
    DRAFT: -1,
    SUBMITTED: 0,
    RETURNED: 0,
    DOCUMENT_REVIEW: 1,
    REJECTED: 1,
    APPROVED: 2,
    SCHEDULED: 3,
    ASSIGNED: 3,
    FIELD_VERIFICATION: 4,
    INSPECTION_COMPLETED: 5,
    PASS: 5,
    FAIL: 5,
    STAMPING: 6,
    CERTIFICATE_GENERATED: 6,
    CERTIFICATE_ISSUED: 7,
    ACTIVE: 7,
    EXPIRED: 7,
    SUSPENDED: 7,
    REVOKED: 7,
    CANCELLED: -1,
  };
  return order[status] ?? -1;
}
