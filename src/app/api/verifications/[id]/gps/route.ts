import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { loadOpenInspection, loadVerifiableApplication } from "@/server/verification-access";

const schema = z.object({
  inspectionId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).optional(),
  purpose: z.enum(["ARRIVAL", "EVIDENCE", "RESULT", "STAMPING"]).default("ARRIVAL"),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { id } = await ctx.params;
  const res = await loadVerifiableApplication(user, id);
  if ("error" in res) return jsonError(res.error!, res.error === 404 ? "NOT_FOUND" : "FORBIDDEN");
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);
  const inspection = await loadOpenInspection(id, body.data.inspectionId);
  if (!inspection) return jsonError(404, "INSPECTION_NOT_FOUND");

  const record = await prisma.gpsRecord.create({
    data: {
      inspectionId: inspection.id,
      userId: user.id,
      latitude: body.data.latitude,
      longitude: body.data.longitude,
      accuracy: body.data.accuracy,
      purpose: body.data.purpose,
    },
    select: { id: true, latitude: true, longitude: true, accuracy: true, capturedAt: true },
  });
  return NextResponse.json({ data: record }, { status: 201 });
}
