import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { readJson, requireApiUser, validationError } from "@/server/api";

const schema = z.union([z.object({ all: z.literal(true) }), z.object({ ids: z.array(z.string().uuid()).min(1).max(200) })]);

/** Marks the caller's own notifications as read. Other users' notifications are never touched. */
export async function PATCH(req: NextRequest) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);
  const res = await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null, ...("ids" in body.data ? { id: { in: body.data.ids } } : {}) },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ data: { updated: res.count } });
}
