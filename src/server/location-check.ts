import { prisma } from "@/db/client";
import { STATE_ISO, distanceToAreaKm, findDistrictByName, inArea } from "@/lib/boundary";
import { STATE_BORDER_TOLERANCE_KM, type SiteLocationCheck } from "@/lib/site-location";
import { INDIA_BOUNDARIES } from "@/server/data/india-boundaries";

const ISO_TO_CODE = Object.fromEntries(Object.entries(STATE_ISO).map(([code, iso]) => [iso, code]));
const isoOf = (code: string) => STATE_ISO[code] ?? code;
const codeOf = (iso: string) => ISO_TO_CODE[iso] ?? iso;

async function matchDistrict(stateId: string, stateIso: string, name: string) {
  const districts = await prisma.district.findMany({ where: { stateId, isActive: true }, select: { id: true, name: true } });
  return findDistrictByName(districts, name, stateIso);
}

/**
 * Checks that a site's coordinates fall in the state (with a small border tolerance) and district chosen for it.
 * Only a state mismatch is meant to block; district names in the boundary data don't always match ours.
 */
export async function checkSiteLocation(input: { stateId: string; districtId?: string | null; latitude: number; longitude: number }): Promise<SiteLocationCheck> {
  const { latitude: lat, longitude: lng } = input;
  const unknown: SiteLocationCheck = { state: "unknown", distanceKm: 0, detectedState: null, district: "unknown", detectedDistrict: null };
  const chosen = await prisma.state.findUnique({ where: { id: input.stateId }, select: { code: true } });
  if (!chosen) return unknown;
  const chosenArea = INDIA_BOUNDARIES.states.find((s) => s.iso === isoOf(chosen.code));
  if (!chosenArea) return unknown;

  const distanceKm = Math.round(distanceToAreaKm(lng, lat, chosenArea) * 10) / 10;
  const state: SiteLocationCheck["state"] = distanceKm === 0 ? "inside" : distanceKm <= STATE_BORDER_TOLERANCE_KM ? "near" : "outside";

  let detectedState: SiteLocationCheck["detectedState"] = null;
  // The state whose districts the point is compared against: the chosen one, or where the point really is.
  let here: { iso: string; stateId: string } | null = state === "inside" ? { iso: chosenArea.iso, stateId: input.stateId } : null;
  if (state !== "inside") {
    const area = INDIA_BOUNDARIES.states.find((s) => inArea(lng, lat, s));
    if (area) {
      const row = await prisma.state.findFirst({ where: { code: codeOf(area.iso), isActive: true }, select: { id: true, name: true } });
      detectedState = { id: row?.id ?? null, name: row?.name ?? area.name };
      if (state === "outside" && row) here = { iso: area.iso, stateId: row.id };
    }
  }

  const districtArea = here ? INDIA_BOUNDARIES.districts.find((d) => d.iso === here.iso && inArea(lng, lat, d)) : undefined;
  if (!here || !districtArea) return { state, distanceKm, detectedState, district: "unknown", detectedDistrict: null };

  const match = await matchDistrict(here.stateId, here.iso, districtArea.name);
  const detectedDistrict = { id: match?.id ?? null, name: match?.name ?? districtArea.name };
  const district: SiteLocationCheck["district"] =
    !match || !input.districtId ? "unknown" : match.id === input.districtId ? "same" : "different";
  return { state, distanceKm, detectedState, district, detectedDistrict };
}
