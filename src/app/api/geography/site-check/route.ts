import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser, validationError } from "@/server/api";
import { checkSiteLocation } from "@/server/location-check";

const query = z.object({
  stateId: z.string().uuid(),
  districtId: z.string().uuid().optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** Advisory check used by the instrument forms; the instrument routes enforce the same rule on save. */
export async function GET(req: NextRequest) {
  const { response } = await requireApiUser();
  if (response) return response;
  const params = Object.fromEntries([...new URL(req.url).searchParams].filter(([, v]) => v !== ""));
  const parsed = query.safeParse(params);
  if (!parsed.success) return validationError(parsed.error);
  const { stateId, districtId, lat, lng } = parsed.data;
  const data = await checkSiteLocation({ stateId, districtId, latitude: lat, longitude: lng });
  return NextResponse.json({ data });
}
