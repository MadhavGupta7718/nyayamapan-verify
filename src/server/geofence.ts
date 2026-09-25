import { prisma } from "@/db/client";
import { jsonError } from "@/server/api";
import { checkGeofence, GEOFENCE_METERS } from "@/lib/geo";

/**
 * Every step after arrival is refused unless the officer's latest arrival fix for this inspection is
 * within 1 km of the instrument site. Returns an error response, or null when the step may proceed.
 */
export async function geofenceResponse(inspectionId: string, instrument: { latitude: number | null; longitude: number | null }) {
  const arrival = await prisma.gpsRecord.findFirst({
    where: { inspectionId, purpose: "ARRIVAL" },
    orderBy: { capturedAt: "desc" },
    select: { latitude: true, longitude: true },
  });
  const check = checkGeofence({ lat: instrument.latitude, lng: instrument.longitude }, arrival ? { lat: arrival.latitude, lng: arrival.longitude } : null);
  if (check.ok) return null;
  return jsonError(check.code === "OUTSIDE_GEOFENCE" ? 403 : 409, check.code, { distance: check.distance, limit: GEOFENCE_METERS });
}
