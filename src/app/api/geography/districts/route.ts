import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { writeAudit } from "@/server/audit";

const schema = z.object({
  stateId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  nameHi: z.string().trim().max(80).optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser(["SUPER_ADMIN"]);
  if (response) return response;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  const state = await prisma.state.findUnique({
    where: { id: body.data.stateId },
    select: { id: true },
  });
  if (!state) return jsonError(404, "NOT_FOUND");
  const clash = await prisma.district.findFirst({
    where: {
      stateId: body.data.stateId,
      name: { equals: body.data.name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (clash) return jsonError(409, "DISTRICT_EXISTS");

  const district = await prisma.district.create({
    data: {
      stateId: body.data.stateId,
      name: body.data.name,
      nameHi: body.data.nameHi || null,
    },
    select: {
      id: true,
      stateId: true,
      name: true,
      nameHi: true,
      isActive: true,
    },
  });
  await writeAudit({
    actorId: user.id,
    action: "DISTRICT_CREATED",
    entity: "District",
    entityId: district.id,
    after: district,
  });
  return NextResponse.json({ data: district }, { status: 201 });
}
