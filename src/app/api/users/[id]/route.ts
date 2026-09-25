import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { userScope } from "@/server/scope";
import { writeAudit } from "@/server/audit";
import { placementError } from "@/server/user-placement";
import { canManageUser, needsDistricts, needsGatc } from "@/lib/user-hierarchy";

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]),
  reason: z.string().trim().min(5).max(500),
});

const detailsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/)
    .optional()
    .or(z.literal("")),
  stateId: z.string().uuid().optional(),
  districtIds: z.array(z.string().uuid()).max(100).optional(),
  gatcId: z.string().uuid().optional().or(z.literal("")),
  reason: z.string().trim().max(500).optional(),
});

/** Status changes and detail edits for accounts the caller manages (see `canManageUser`). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN", "STATE_ADMIN", "GATC_ADMIN"]);
  if (response) return response;
  const { id } = await ctx.params;
  if (id === user.id) return jsonError(400, "CANNOT_CHANGE_OWN_STATUS");
  const raw = await readJson(req);

  const target = await prisma.user.findFirst({
    where: { AND: [{ id }, userScope(user)] },
    select: {
      id: true,
      name: true,
      mobile: true,
      status: true,
      role: true,
      stateId: true,
      gatcId: true,
      jurisdiction: { select: { id: true } },
    },
  });
  if (!target) return jsonError(404, "NOT_FOUND");
  if (!canManageUser(user, target)) return jsonError(403, "FORBIDDEN");

  if (raw && typeof raw === "object" && "status" in raw) {
    const body = statusSchema.safeParse(raw);
    if (!body.success) return validationError(body.error);
    await prisma.user.update({ where: { id }, data: { status: body.data.status } });
    await writeAudit({
      actorId: user.id,
      action: "USER_STATUS_CHANGED",
      entity: "User",
      entityId: id,
      before: { status: target.status },
      after: { status: body.data.status },
      reason: body.data.reason,
    });
    return NextResponse.json({ data: { id, status: body.data.status } });
  }

  const body = detailsSchema.safeParse(raw);
  if (!body.success) return validationError(body.error);
  const stateId = user.role === "SUPER_ADMIN" && body.data.stateId ? body.data.stateId : target.stateId;
  const districtIds = needsDistricts(target.role) ? body.data.districtIds ?? target.jurisdiction.map((d) => d.id) : [];
  const gatcId = needsGatc(target.role) ? (body.data.gatcId === undefined ? target.gatcId : body.data.gatcId || null) : null;
  if (stateId && target.role !== "BUSINESS_USER") {
    const invalid = await placementError({ role: target.role, stateId, districtIds, gatcId });
    if (invalid) return jsonError(400, invalid);
  }

  const before = {
    name: target.name,
    mobile: target.mobile,
    stateId: target.stateId,
    gatcId: target.gatcId,
    districtIds: target.jurisdiction.map((d) => d.id),
  };
  const after = { name: body.data.name, mobile: body.data.mobile || null, stateId, gatcId, districtIds };
  await prisma.user.update({
    where: { id },
    data: {
      name: after.name,
      mobile: after.mobile,
      stateId: after.stateId,
      gatcId: after.gatcId,
      jurisdiction: needsDistricts(target.role) ? { set: districtIds.map((d) => ({ id: d })) } : undefined,
    },
  });
  await writeAudit({ actorId: user.id, action: "USER_UPDATED", entity: "User", entityId: id, before, after, reason: body.data.reason || undefined });
  return NextResponse.json({ data: { id } });
}
