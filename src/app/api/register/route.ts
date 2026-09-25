import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { jsonError, readJson, validationError } from "@/server/api";
import { writeAudit } from "@/server/audit";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { GSTIN_RE, MOBILE_RE, passwordSchema } from "@/lib/validation";

const schema = z.object({
  organizationName: z.string().trim().min(3).max(160),
  organizationType: z.enum(["TRADER", "MANUFACTURER", "PACKER", "FUEL_STATION", "INSTITUTION", "OTHER"]),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(GSTIN_RE)
    .optional()
    .or(z.literal("")),
  stateId: z.string().uuid(),
  districtId: z.string().uuid().optional().or(z.literal("")),
  address: z.string().trim().min(5).max(300),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  mobile: z.string().trim().regex(MOBILE_RE),
  password: passwordSchema,
  acceptTerms: z.literal(true),
});

/**
 * Creates a platform account for a business. This is not statutory registration or a licence
 * under the Legal Metrology Act; licences are recorded separately and verified by the authority.
 */
export async function POST(req: NextRequest) {
  const limit = rateLimit(`register:${clientIp(req.headers)}`, 5, 60 * 60_000);
  if (!limit.ok) return jsonError(429, "RATE_LIMITED", { retryAfter: limit.retryAfter });
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  const state = await prisma.state.findFirst({ where: { id: body.data.stateId, isActive: true }, select: { id: true } });
  if (!state) return jsonError(400, "INVALID_STATE");
  if (body.data.districtId) {
    const district = await prisma.district.findFirst({ where: { id: body.data.districtId, stateId: state.id, isActive: true }, select: { id: true } });
    if (!district) return jsonError(400, "INVALID_DISTRICT");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: body.data.organizationName,
          type: body.data.organizationType,
          gstin: body.data.gstin || null,
          stateId: state.id,
          districtId: body.data.districtId || null,
          address: body.data.address,
          isDemo: false,
          licenses: {
            create: {
              licenseType: "Statutory registration / licence",
              status: "CONFIGURATION_REQUIRED",
              notes: "To be verified by the competent Legal Metrology authority",
            },
          },
        },
      });
      const user = await tx.user.create({
        data: {
          name: body.data.name,
          email: body.data.email,
          mobile: body.data.mobile,
          role: "BUSINESS_USER",
          organizationId: org.id,
          stateId: state.id,
          passwordHash: await bcrypt.hash(body.data.password, 12),
          isDemo: false,
        },
        select: { id: true },
      });
      return { orgId: org.id, userId: user.id };
    });
    await writeAudit({ actorId: result.userId, action: "ACCOUNT_REGISTERED", entity: "Organization", entityId: result.orgId });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return jsonError(409, "EMAIL_IN_USE");
    throw e;
  }
}
