import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { writeAudit } from "@/server/audit";
import { passwordSchema } from "@/lib/validation";
import { rateLimit } from "@/server/rate-limit";

const prefsSchema = z.object({
  kind: z.literal("preferences"),
  name: z.string().trim().min(2).max(120).optional(),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/)
    .optional()
    .or(z.literal("")),
  locale: z.enum(["en", "hi"]).optional(),
  emailAlerts: z.boolean().optional(),
  expiryDigest: z.boolean().optional(),
});

const passwordChange = z.object({
  kind: z.literal("password"),
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export async function PATCH(req: NextRequest) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const raw = await readJson(req);
  const parsed = z.discriminatedUnion("kind", [prefsSchema, passwordChange]).safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  if (parsed.data.kind === "password") {
    if (!rateLimit(`pw-change:${user.id}`, 5, 15 * 60_000).ok) return jsonError(429, "RATE_LIMITED");
    const record = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!record || !(await bcrypt.compare(parsed.data.currentPassword, record.passwordHash))) {
      return jsonError(400, "CURRENT_PASSWORD_INCORRECT");
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) } });
    await writeAudit({ actorId: user.id, action: "PASSWORD_CHANGED", entity: "User", entityId: user.id });
    return NextResponse.json({ ok: true });
  }

  const current = await prisma.user.findUnique({ where: { id: user.id }, select: { preferences: true } });
  const prefs = { ...((current?.preferences as Record<string, unknown> | null) ?? {}) };
  if (parsed.data.emailAlerts != null) prefs.emailAlerts = parsed.data.emailAlerts;
  if (parsed.data.expiryDigest != null) prefs.expiryDigest = parsed.data.expiryDigest;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      mobile: parsed.data.mobile === "" ? null : parsed.data.mobile,
      locale: parsed.data.locale,
      preferences: prefs as Prisma.InputJsonObject,
    },
  });
  await writeAudit({ actorId: user.id, action: "PROFILE_UPDATED", entity: "User", entityId: user.id });
  return NextResponse.json({ ok: true });
}
