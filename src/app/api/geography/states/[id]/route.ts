import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { writeAudit } from "@/server/audit";

const SELECT = {
  id: true,
  code: true,
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

  const before = await prisma.state.findUnique({
    where: { id },
    select: SELECT,
  });
  if (!before) return jsonError(404, "NOT_FOUND");
  if (body.data.name && body.data.name.toLowerCase() !== before.name.toLowerCase()) {
    const clash = await prisma.state.findFirst({
      where: {
        id: { not: id },
        name: { equals: body.data.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (clash) return jsonError(409, "STATE_EXISTS");
  }

  const after = await prisma.state.update({
    where: { id },
    data: {
      name: body.data.name,
      nameHi: body.data.nameHi === undefined ? undefined : body.data.nameHi || null,
      isActive: body.data.isActive,
    },
    select: SELECT,
  });
  await writeAudit({
    actorId: user.id,
    action: "STATE_UPDATED",
    entity: "State",
    entityId: id,
    before,
    after,
  });
  return NextResponse.json({ data: after });
}

/**
 * States that are referenced by users, instruments, organisations, GATCs or rule configuration are
 * deactivated (hidden from forms, history kept); unused states are deleted with their districts.
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN"]);
  if (response) return response;
  const { id } = await ctx.params;
  const state = await prisma.state.findUnique({
    where: { id },
    select: {
      ...SELECT,
      _count: {
        select: {
          users: true,
          instruments: true,
          organizations: true,
          gatcProfiles: true,
          stateRuleConfigs: true,
        },
      },
    },
  });
  if (!state) return jsonError(404, "NOT_FOUND");

  const { _count, ...snapshot } = state;
  const inUse = Object.values(_count).some((n) => n > 0);
  if (inUse) {
    await prisma.state.update({ where: { id }, data: { isActive: false } });
    await prisma.district.updateMany({
      where: { stateId: id },
      data: { isActive: false },
    });
    await writeAudit({
      actorId: user.id,
      action: "STATE_DEACTIVATED",
      entity: "State",
      entityId: id,
      before: snapshot,
      after: { isActive: false, references: _count },
    });
    return NextResponse.json({ data: { id, outcome: "deactivated" } });
  }

  await prisma.$transaction([prisma.district.deleteMany({ where: { stateId: id } }), prisma.state.delete({ where: { id } })]);
  await writeAudit({
    actorId: user.id,
    action: "STATE_DELETED",
    entity: "State",
    entityId: id,
    before: snapshot,
  });
  return NextResponse.json({ data: { id, outcome: "deleted" } });
}
