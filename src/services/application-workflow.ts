import { prisma } from "@/db/client";
import type { ApplicationStatus, Role } from "@prisma/client";
import { writeAudit } from "@/server/audit";
import { notifyUser } from "@/services/notifications";
import { requiredDocumentsFor } from "@/lib/required-documents";

export const ALLOWED: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["DOCUMENT_REVIEW", "RETURNED", "REJECTED", "CANCELLED"],
  DOCUMENT_REVIEW: ["APPROVED", "RETURNED", "REJECTED"],
  APPROVED: ["SCHEDULED", "CANCELLED"],
  RETURNED: ["SUBMITTED", "CANCELLED"],
  REJECTED: [],
  SCHEDULED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["FIELD_VERIFICATION", "RETURNED", "CANCELLED"],
  FIELD_VERIFICATION: ["INSPECTION_COMPLETED", "RETURNED", "CANCELLED"],
  INSPECTION_COMPLETED: ["PASS", "FAIL"],
  PASS: ["STAMPING"],
  FAIL: ["CANCELLED"],
  STAMPING: ["CERTIFICATE_GENERATED"],
  CERTIFICATE_GENERATED: ["CERTIFICATE_ISSUED"],
  CERTIFICATE_ISSUED: ["ACTIVE"],
  ACTIVE: ["EXPIRED", "SUSPENDED", "REVOKED"],
  SUSPENDED: ["ACTIVE", "REVOKED"],
  EXPIRED: ["REVOKED"],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus) {
  return (ALLOWED[from] ?? []).includes(to);
}

export class WorkflowError extends Error {
  constructor(
    public code: "INVALID_TRANSITION" | "CONCURRENT_UPDATE" | "NOT_FOUND",
    message: string
  ) {
    super(message);
  }
}

/**
 * Moves an application along the state machine. Transitions outside ALLOWED are rejected —
 * there is no override path. The status update is conditional on the status we read, so two
 * officers acting at once cannot both succeed (optimistic concurrency).
 */
export async function transitionApplication(opts: {
  applicationId: string;
  to: ApplicationStatus;
  actorId?: string;
  reason?: string;
  remarks?: string;
  notify?: boolean;
}) {
  const app = await prisma.application.findUnique({
    where: { id: opts.applicationId },
    select: { id: true, status: true, applicationNumber: true, createdById: true },
  });
  if (!app) throw new WorkflowError("NOT_FOUND", "Application not found");
  if (!canTransition(app.status, opts.to)) {
    throw new WorkflowError("INVALID_TRANSITION", `Invalid transition ${app.status} → ${opts.to}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.application.updateMany({
      where: { id: app.id, status: app.status },
      data: { status: opts.to },
    });
    if (res.count !== 1) throw new WorkflowError("CONCURRENT_UPDATE", "Application was updated by someone else");
    await tx.applicationStatusHistory.create({
      data: {
        applicationId: app.id,
        previousStatus: app.status,
        newStatus: opts.to,
        changedById: opts.actorId,
        reason: opts.reason,
        remarks: opts.remarks,
      },
    });
    return tx.application.findUniqueOrThrow({ where: { id: app.id } });
  });

  await writeAudit({
    actorId: opts.actorId,
    action: "APPLICATION_STATUS_CHANGED",
    entity: "Application",
    entityId: app.id,
    before: { status: app.status },
    after: { status: opts.to },
    reason: opts.reason,
  });

  if (opts.notify !== false && app.createdById && app.createdById !== opts.actorId) {
    await notifyUser({
      userId: app.createdById,
      type: "APPLICATION_STATUS",
      title: `Application ${app.applicationNumber}`,
      body: `Status updated to ${opts.to.replaceAll("_", " ").toLowerCase()}`,
      meta: { applicationId: app.id, applicationNumber: app.applicationNumber, status: opts.to },
    });
  }

  return updated;
}

/** Required document types (from the instrument type master) that have no current upload. */
export async function missingRequiredDocuments(applicationId: string) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      verificationType: true,
      instrument: { select: { instrumentType: { select: { requiredDocuments: true } } } },
      documents: { where: { status: { notIn: ["SUPERSEDED", "REJECTED"] } }, select: { documentType: true } },
    },
  });
  if (!app) return [];
  const required = requiredDocumentsFor(app.instrument.instrumentType.requiredDocuments, app.verificationType);
  const have = new Set(app.documents.map((d) => d.documentType));
  return required.filter((r) => !have.has(r));
}

type ActionDef = { from: ApplicationStatus[]; to: ApplicationStatus; roles: Role[]; requiresReason?: boolean; ownerOnly?: boolean };

/** Document review is the State Admin's (Controller's) decision; the Super Admin oversees but does not decide. */
const REVIEWERS: Role[] = ["STATE_ADMIN"];
const APPLICANTS: Role[] = ["BUSINESS_USER"];

/** User-facing actions on an application, each bound to the roles allowed to perform it. */
export const APPLICATION_ACTIONS = {
  submit: { from: ["DRAFT", "RETURNED"], to: "SUBMITTED", roles: APPLICANTS, ownerOnly: true },
  cancel: { from: ["DRAFT", "SUBMITTED", "RETURNED"], to: "CANCELLED", roles: APPLICANTS, requiresReason: true, ownerOnly: true },
  startReview: { from: ["SUBMITTED"], to: "DOCUMENT_REVIEW", roles: REVIEWERS },
  approve: { from: ["DOCUMENT_REVIEW"], to: "APPROVED", roles: REVIEWERS },
  return: { from: ["SUBMITTED", "DOCUMENT_REVIEW"], to: "RETURNED", roles: REVIEWERS, requiresReason: true },
  reject: { from: ["SUBMITTED", "DOCUMENT_REVIEW"], to: "REJECTED", roles: REVIEWERS, requiresReason: true },
} satisfies Record<string, ActionDef>;

export type ApplicationAction = keyof typeof APPLICATION_ACTIONS;

export function availableActions(status: ApplicationStatus, role: Role, isOwner: boolean): ApplicationAction[] {
  return (Object.entries(APPLICATION_ACTIONS) as [ApplicationAction, ActionDef][])
    .filter(([, def]) => def.from.includes(status) && def.roles.includes(role))
    .filter(([, def]) => !def.ownerOnly || isOwner)
    .map(([key]) => key);
}
