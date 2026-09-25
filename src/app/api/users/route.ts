import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { writeAudit } from "@/server/audit";
import { placementError } from "@/server/user-placement";
import { creatableRoles, needsDistricts, needsGatc } from "@/lib/user-hierarchy";
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
  districtIds: z.array(z.string().uuid()).max(100).optional(),
  gatcId: z.string().uuid().optional().or(z.literal("")),
  password: passwordSchema,
});

/**
 * Staff account provisioning along the hierarchy in `CREATABLE_ROLES`. State and GATC admins can only
 * create accounts in their own state.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN", "STATE_ADMIN", "GATC_ADMIN"]);
  if (response) return response;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);
  const { role, stateId } = body.data;

  if (!creatableRoles(user.role).includes(role)) return jsonError(403, "ROLE_NOT_ALLOWED");
  if (user.role !== "SUPER_ADMIN" && stateId !== user.stateId) return jsonError(403, "OUTSIDE_JURISDICTION");
  const districtIds = needsDistricts(role) ? body.data.districtIds ?? [] : [];
  const gatcId = needsGatc(role) ? body.data.gatcId || null : null;
  const invalid = await placementError({ role, stateId, districtIds, gatcId });
  if (invalid) return jsonError(400, invalid);

  try {
    const created = await prisma.user.create({
      data: {
        name: body.data.name,
        email: body.data.email,
        mobile: body.data.mobile || null,
        role,
        stateId,
        gatcId,
        jurisdiction: districtIds.length ? { connect: districtIds.map((id) => ({ id })) } : undefined,
        passwordHash: await bcrypt.hash(body.data.password, 12),
        isDemo: false,
      },
      select: { id: true, email: true, role: true },
    });
    await writeAudit({
      actorId: user.id,
      action: "USER_CREATED",
      entity: "User",
      entityId: created.id,
      after: { role: created.role, stateId, districtIds, gatcId },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return jsonError(409, "EMAIL_IN_USE");
    throw e;
  }
}
