import { prisma } from "@/db/client";

type AuditInput = {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string;
};

export async function writeAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? undefined,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? undefined,
        before: input.before as object | undefined,
        after: input.after as object | undefined,
        reason: input.reason,
        ip: input.ip ?? undefined,
        userAgent: input.userAgent ?? undefined,
        requestId: input.requestId,
      },
    });
  } catch (e) {
    console.error("[audit]", e);
  }
}
