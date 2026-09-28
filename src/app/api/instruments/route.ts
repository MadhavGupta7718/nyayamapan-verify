import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { instrumentScope } from "@/server/scope";
import { writeAudit } from "@/server/audit";
import { checkSiteLocation } from "@/server/location-check";
import { blocksSave } from "@/lib/site-location";

const code = customAlphabet("0123456789", 6);

const schema = z.object({
  instrumentTypeId: z.string().uuid(),
  manufacturer: z.string().trim().min(2).max(120),
  modelName: z.string().trim().min(1).max(120),
  serialNumber: z.string().trim().min(2).max(80),
  capacity: z.string().trim().max(60).optional(),
  accuracy: z.string().trim().max(60).optional(),
  unit: z.string().trim().max(20).optional(),
  yearOfManufacture: z.number().int().min(1950).max(new Date().getFullYear()).optional(),
  address: z.string().trim().max(300).optional(),
  locationLabel: z.string().trim().max(120).optional(),
  stateId: z.string().uuid(),
  districtId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  organizationId: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const data = await prisma.instrument.findMany({
    where: {
      AND: [
        instrumentScope(user),
        q
          ? {
              OR: [
                { instrumentCode: { contains: q, mode: "insensitive" } },
                { serialNumber: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      instrumentCode: true,
      serialNumber: true,
      manufacturer: true,
      modelName: true,
      verificationStatus: true,
      instrumentType: { select: { id: true, name: true, nameHi: true, requiredDocuments: true } },
    },
  });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser(["BUSINESS_USER"]);
  if (response) return response;
  const body = schema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  const organizationId = user.organizationId;
  if (!organizationId) return jsonError(400, "ORGANIZATION_REQUIRED");

  const type = await prisma.instrumentType.findFirst({ where: { id: body.data.instrumentTypeId, isActive: true }, select: { id: true } });
  if (!type) return jsonError(400, "INVALID_INSTRUMENT_TYPE");

  const state = await prisma.state.findFirst({ where: { id: body.data.stateId, isActive: true }, select: { code: true } });
  if (!state) return jsonError(400, "INVALID_STATE");
  const district = await prisma.district.findFirst({ where: { id: body.data.districtId, stateId: body.data.stateId, isActive: true }, select: { id: true } });
  if (!district) return jsonError(400, "INVALID_DISTRICT");

  const site = await checkSiteLocation(body.data);
  if (blocksSave(site)) return jsonError(422, "LOCATION_STATE_MISMATCH", { check: site });

  try {
    const instrument = await prisma.instrument.create({
      data: {
        instrumentCode: `INS-${state.code}-${code()}`,
        instrumentTypeId: type.id,
        manufacturer: body.data.manufacturer,
        modelName: body.data.modelName,
        serialNumber: body.data.serialNumber,
        capacity: body.data.capacity,
        accuracy: body.data.accuracy,
        unit: body.data.unit,
        yearOfManufacture: body.data.yearOfManufacture,
        address: body.data.address,
        locationLabel: body.data.locationLabel,
        stateId: body.data.stateId,
        districtId: body.data.districtId,
        latitude: body.data.latitude,
        longitude: body.data.longitude,
        organizationId,
        isDemo: false,
      },
      select: { id: true, instrumentCode: true },
    });
    await writeAudit({ actorId: user.id, action: "INSTRUMENT_CREATED", entity: "Instrument", entityId: instrument.id });
    return NextResponse.json({ data: instrument }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonError(409, "DUPLICATE_SERIAL");
    }
    throw e;
  }
}
