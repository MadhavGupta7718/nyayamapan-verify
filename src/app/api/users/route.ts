import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { writeAudit } from "@/server/audit";
import { passwordSchema } from "@/lib/validation";

const STAFF_ROLES = ["STATE_ADMIN", "LMO", "INSPECTOR", "GATC_ADMIN", "GATC_OFFICER", "AUDITOR"] as const;

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/)
    .optional()
    .or(z.literal("")),
  role: z.enum(STAFF_ROLES),
  stateId: z.string().uuid(),
  password: passwordSchema,
});

/** Staff account provisioning. State admins may only create non-admin staff within their own state. */
export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN", "STATE_ADMIN"]);
  if (response) return response;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  if (user.role === "STATE_ADMIN") {
    if (body.data.stateId !== user.stateId) return jsonError(403, "OUTSIDE_JURISDICTION");
    if ((["STATE_ADMIN"] as Role[]).includes(body.data.role)) return jsonError(403, "ROLE_NOT_ALLOWED");
  }

  try {
    const created = await prisma.user.create({
      data: {
        name: body.data.name,
        email: body.data.email,
        mobile: body.data.mobile || null,
        role: body.data.role,
        stateId: body.data.stateId,
        passwordHash: await bcrypt.hash(body.data.password, 12),
        isDemo: false,
      },
      select: { id: true, email: true, role: true },
    });
    await writeAudit({ actorId: user.id, action: "USER_CREATED", entity: "User", entityId: created.id, after: { role: created.role } });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return jsonError(409, "EMAIL_IN_USE");
    throw e;
  }
}
