import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { certificateScope } from "@/server/scope";
import { writeAudit } from "@/server/audit";
import { notifyUser } from "@/services/notifications";
import { canTransition } from "@/services/application-workflow";
import type { ApplicationStatus, CertificateStatus } from "@prisma/client";

const schema = z.object({
  action: z.enum(["revoke", "suspend", "reinstate"]).default("revoke"),
  reason: z.string().trim().min(10).max(1000),
});

const TARGET: Record<"revoke" | "suspend" | "reinstate", { from: CertificateStatus[]; to: CertificateStatus; app: ApplicationStatus }> = {
  revoke: { from: ["ACTIVE", "SUSPENDED", "EXPIRED"], to: "REVOKED", app: "REVOKED" },
  suspend: { from: ["ACTIVE"], to: "SUSPENDED", app: "SUSPENDED" },
  reinstate: { from: ["SUSPENDED"], to: "ACTIVE", app: "ACTIVE" },
};

/** Certificate lifecycle changes. Historical versions are kept; a revocation record is appended. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN", "STATE_ADMIN"]);
  if (response) return response;
  const { id } = await ctx.params;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  const cert = await prisma.certificate.findFirst({
    where: { AND: [{ id }, certificateScope(user)] },
    select: { id: true, status: true, certificateNumber: true, applicationId: true, application: { select: { createdById: true, status: true } } },
  });
  if (!cert) return jsonError(404, "NOT_FOUND");
  const target = TARGET[body.data.action];
  if (!target.from.includes(cert.status)) return jsonError(409, "INVALID_CERTIFICATE_TRANSITION", { status: cert.status });

  await prisma.$transaction(async (tx) => {
    await tx.certificate.update({ where: { id }, data: { status: target.to } });
    await tx.certificateRevocation.create({
      data: { certificateId: id, reason: `[${body.data.action.toUpperCase()}] ${body.data.reason}`, revokedById: user.id },
    });
    if (canTransition(cert.application.status, target.app)) {
      await tx.application.update({ where: { id: cert.applicationId }, data: { status: target.app } });
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: cert.applicationId,
          previousStatus: cert.application.status,
          newStatus: target.app,
          changedById: user.id,
          reason: body.data.reason,
        },
      });
    }
  });

  await writeAudit({
    actorId: user.id,
    action: { revoke: "CERTIFICATE_REVOKED", suspend: "CERTIFICATE_SUSPENDED", reinstate: "CERTIFICATE_REINSTATED" }[body.data.action],
    entity: "Certificate",
    entityId: id,
    before: { status: cert.status },
    after: { status: target.to },
    reason: body.data.reason,
  });
  await notifyUser({
    userId: cert.application.createdById,
    type: "CERTIFICATE_STATUS",
    title: `Certificate ${cert.certificateNumber}`,
    body: `Certificate status changed to ${target.to.toLowerCase()}.`,
    meta: { certificateId: id, certificateNumber: cert.certificateNumber, status: target.to },
  });

  return NextResponse.json({ data: { id, status: target.to } });
}
