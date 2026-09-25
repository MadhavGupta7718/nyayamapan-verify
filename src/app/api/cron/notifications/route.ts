import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { notifyUser } from "@/services/notifications";
import { isAuthorizedCron } from "@/server/cron-auth";

/**
 * Expiry reminders at the configured alert offsets (a platform preference, not a statutory
 * notice period). Each certificate/offset pair is notified at most once.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req.headers)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const setting = await prisma.systemSetting.findUnique({ where: { key: "expiry_alert_days" } });
  const days = Array.isArray(setting?.value) ? (setting!.value as number[]) : [90, 60, 30, 15, 7, 1];
  let sent = 0;

  for (const d of days) {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() + d);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    const certs = await prisma.certificate.findMany({
      where: { status: "ACTIVE", validUntil: { gte: from, lt: to } },
      select: { id: true, certificateNumber: true, validUntil: true, application: { select: { createdById: true } } },
      take: 500,
    });
    for (const c of certs) {
      const already = await prisma.notification.findFirst({
        where: {
          userId: c.application.createdById,
          type: "CERTIFICATE_EXPIRING",
          AND: [{ meta: { path: ["certificateId"], equals: c.id } }, { meta: { path: ["days"], equals: d } }],
        },
        select: { id: true },
      });
      if (already) continue;
      await notifyUser({
        userId: c.application.createdById,
        type: "CERTIFICATE_EXPIRING",
        title: `Certificate ${c.certificateNumber} due in ${d} day(s)`,
        body: `Valid until ${c.validUntil?.toISOString().slice(0, 10)}. Apply for re-verification in time.`,
        meta: { certificateId: c.id, certificateNumber: c.certificateNumber, days: d },
      });
      sent += 1;
    }
  }
  return NextResponse.json({ ok: true, sent });
}

export const POST = GET;
