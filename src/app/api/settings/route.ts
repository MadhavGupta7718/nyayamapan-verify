import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { readJson, requireApiUser, validationError } from "@/server/api";
import { writeAudit } from "@/server/audit";

const schema = z.object({
  expiryAlertDays: z
    .array(z.number().int().min(1).max(365))
    .min(1)
    .max(10)
    .transform((a) => [...new Set(a)].sort((x, y) => y - x)),
});

/** Platform-wide settings (Super Admin). Alert offsets are preferences, not statutory periods. */
export async function PATCH(req: NextRequest) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN"]);
  if (response) return response;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);
  const before = await prisma.systemSetting.findUnique({ where: { key: "expiry_alert_days" } });
  await prisma.systemSetting.upsert({
    where: { key: "expiry_alert_days" },
    create: { key: "expiry_alert_days", value: body.data.expiryAlertDays },
    update: { value: body.data.expiryAlertDays },
  });
  await writeAudit({
    actorId: user.id,
    action: "SETTING_CHANGED",
    entity: "SystemSetting",
    entityId: "expiry_alert_days",
    before: before?.value,
    after: body.data.expiryAlertDays,
  });
  return NextResponse.json({ data: { expiryAlertDays: body.data.expiryAlertDays } });
}
