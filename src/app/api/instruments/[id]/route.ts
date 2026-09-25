import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { instrumentScope } from "@/server/scope";
import { writeAudit } from "@/server/audit";
import { OPEN_APPLICATION_STATUSES, canEditLocation } from "@/lib/instrument-location";

const schema = z.object({
  locationLabel: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  districtId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * The applicant corrects where the instrument is, typically after an officer dismissed a visit because
 * the site couldn't be found. Only allowed while no application for it is under review or in the field.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser(["BUSINESS_USER"]);
  if (response) return response;
  const { id } = await ctx.params;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  const instrument = await prisma.instrument.findFirst({
    where: { AND: [{ id }, instrumentScope(user)] },
    select: {
      id: true,
      stateId: true,
      locationLabel: true,
      address: true,
      districtId: true,
      latitude: true,
      longitude: true,
      applications: { where: { status: { in: [...OPEN_APPLICATION_STATUSES] } }, select: { status: true } },
    },
  });
  if (!instrument) return jsonError(404, "NOT_FOUND");
  if (!canEditLocation(instrument.applications.map((a) => a.status))) return jsonError(409, "INSTRUMENT_LOCKED");

  const district = await prisma.district.findFirst({ where: { id: body.data.districtId, stateId: instrument.stateId ?? "__none__", isActive: true }, select: { id: true } });
  if (!district) return jsonError(400, "INVALID_DISTRICT");

  const after = {
    locationLabel: body.data.locationLabel || null,
    address: body.data.address || null,
    districtId: body.data.districtId,
    latitude: body.data.latitude,
    longitude: body.data.longitude,
  };
  await prisma.instrument.update({ where: { id: instrument.id }, data: after });
  const before = {
    locationLabel: instrument.locationLabel,
    address: instrument.address,
    districtId: instrument.districtId,
    latitude: instrument.latitude,
    longitude: instrument.longitude,
  };
  await writeAudit({ actorId: user.id, action: "INSTRUMENT_LOCATION_UPDATED", entity: "Instrument", entityId: instrument.id, before, after });
  return NextResponse.json({ data: { id: instrument.id } });
}
