import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { writeAudit } from "@/server/audit";

const schema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,3}$/),
  name: z.string().trim().min(2).max(80),
  nameHi: z.string().trim().max(80).optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN"]);
  if (response) return response;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  const clash = await prisma.state.findFirst({
    where: {
      OR: [{ code: body.data.code }, { name: { equals: body.data.name, mode: "insensitive" } }],
    },
    select: { id: true },
  });
  if (clash) return jsonError(409, "STATE_EXISTS");

  const state = await prisma.state.create({
    data: {
      code: body.data.code,
      name: body.data.name,
      nameHi: body.data.nameHi || null,
    },
    select: { id: true, code: true, name: true, nameHi: true, isActive: true },
  });
  await writeAudit({
    actorId: user.id,
    action: "STATE_CREATED",
    entity: "State",
    entityId: state.id,
    after: state,
  });
  return NextResponse.json({ data: state }, { status: 201 });
}
