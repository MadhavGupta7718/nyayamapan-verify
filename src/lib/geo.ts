/** Officers must be within this distance of the instrument site to carry out any step after arrival. */
export const GEOFENCE_METERS = 1000;

type Point = { lat: number; lng: number };

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: Point, b: Point) {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type GeofenceCheck =
  | { ok: true; distance: number }
  | { ok: false; code: "SITE_LOCATION_MISSING" | "ARRIVAL_REQUIRED"; distance: null }
  | { ok: false; code: "OUTSIDE_GEOFENCE"; distance: number };

/** Whether the officer's recorded position is close enough to the instrument site. */
export function checkGeofence(site: { lat: number | null; lng: number | null }, position: Point | null, limit = GEOFENCE_METERS): GeofenceCheck {
  if (site.lat == null || site.lng == null) return { ok: false, code: "SITE_LOCATION_MISSING", distance: null };
  if (!position) return { ok: false, code: "ARRIVAL_REQUIRED", distance: null };
  const distance = Math.round(distanceMeters(position, { lat: site.lat, lng: site.lng }));
  return distance <= limit ? { ok: true, distance } : { ok: false, code: "OUTSIDE_GEOFENCE", distance };
}
