import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { isAuthorizedCron } from "@/server/cron-auth";
import { writeAudit } from "@/server/audit";

/**
 * Marks certificates whose rule-derived validUntil has passed as EXPIRED and mirrors the
 * change on the application. Certificates without validUntil (period not configured) are untouched.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req.headers)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const now = new Date();
  const due = await prisma.certificate.findMany({
    where: { status: "ACTIVE", validUntil: { lt: now } },
    select: { id: true, applicationId: true, instrumentId: true },
    take: 1000,
  });
  if (due.length) {
    await prisma.$transaction([
      prisma.certificate.updateMany({ where: { id: { in: due.map((d) => d.id) } }, data: { status: "EXPIRED" } }),
      prisma.application.updateMany({ where: { id: { in: due.map((d) => d.applicationId) }, status: "ACTIVE" }, data: { status: "EXPIRED" } }),
      prisma.instrument.updateMany({ where: { id: { in: due.map((d) => d.instrumentId) } }, data: { verificationStatus: "EXPIRED" } }),
    ]);
    await writeAudit({ action: "CERTIFICATES_EXPIRED", entity: "System", after: { count: due.length } });
  }
  return NextResponse.json({ ok: true, expired: due.length });
}

export const POST = GET;
