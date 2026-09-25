import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { userScope } from "@/server/scope";
import { writeAudit } from "@/server/audit";

const schema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]),
  reason: z.string().trim().min(5).max(500),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN", "STATE_ADMIN"]);
  if (response) return response;
  const { id } = await ctx.params;
  if (id === user.id) return jsonError(400, "CANNOT_CHANGE_OWN_STATUS");
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  const target = await prisma.user.findFirst({ where: { AND: [{ id }, userScope(user)] }, select: { id: true, status: true, role: true } });
  if (!target) return jsonError(404, "NOT_FOUND");
  if (target.role === "SUPER_ADMIN" && user.role !== "SUPER_ADMIN") return jsonError(403, "FORBIDDEN");

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
