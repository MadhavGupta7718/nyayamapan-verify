import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { writeAudit } from "@/server/audit";

const SELECT = {
  id: true,
  stateId: true,
  name: true,
  nameHi: true,
  isActive: true,
} as const;

const schema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    nameHi: z.string().trim().max(80).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN"]);
  if (response) return response;
  const { id } = await ctx.params;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  const before = await prisma.district.findUnique({
    where: { id },
    select: { ...SELECT, state: { select: { isActive: true } } },
  });
  if (!before) return jsonError(404, "NOT_FOUND");
  if (body.data.isActive && !before.state.isActive) return jsonError(409, "STATE_INACTIVE");
  if (body.data.name && body.data.name.toLowerCase() !== before.name.toLowerCase()) {
    const clash = await prisma.district.findFirst({
      where: {
        id: { not: id },
        stateId: before.stateId,
        name: { equals: body.data.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (clash) return jsonError(409, "DISTRICT_EXISTS");
  }

  const after = await prisma.district.update({
    where: { id },
    data: {
      name: body.data.name,
      nameHi: body.data.nameHi === undefined ? undefined : body.data.nameHi || null,
      isActive: body.data.isActive,
    },
    select: SELECT,
  });
  const { state: _state, ...snapshot } = before;
  await writeAudit({
    actorId: user.id,
    action: "DISTRICT_UPDATED",
    entity: "District",
    entityId: id,
    before: snapshot,
    after,
  });
  return NextResponse.json({ data: after });
}

/** Referenced districts are deactivated so historic records keep their location; unused ones are deleted. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN"]);
  if (response) return response;
  const { id } = await ctx.params;
  const district = await prisma.district.findUnique({
    where: { id },
    select: {
      ...SELECT,
      _count: {
        select: {
          instruments: true,
          organizations: true,
          gatcProfiles: true,
          officers: true,
        },
      },
    },
  });
  if (!district) return jsonError(404, "NOT_FOUND");

  const { _count, ...snapshot } = district;
  if (Object.values(_count).some((n) => n > 0)) {
    await prisma.district.update({ where: { id }, data: { isActive: false } });
    await writeAudit({
      actorId: user.id,
      action: "DISTRICT_DEACTIVATED",
      entity: "District",
      entityId: id,
      before: snapshot,
      after: { isActive: false, references: _count },
    });
    return NextResponse.json({ data: { id, outcome: "deactivated" } });
  }

  await prisma.district.delete({ where: { id } });
  await writeAudit({
    actorId: user.id,
    action: "DISTRICT_DELETED",
    entity: "District",
    entityId: id,
    before: snapshot,
  });
  return NextResponse.json({ data: { id, outcome: "deleted" } });
}
