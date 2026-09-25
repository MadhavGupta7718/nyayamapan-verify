import type { Role } from "@prisma/client";
import { prisma } from "@/db/client";
import { needsDistricts, needsGatc } from "@/lib/user-hierarchy";

/**
 * Checks that a staff member's state, districts and GATC fit together: the state is active, an LMO's
 * districts are active districts of that state and a GATC officer's centre is an approved GATC in it.
 * Returns an API error code, or null when the placement is valid.
 */
export async function placementError(input: { role: Role; stateId: string; districtIds?: string[]; gatcId?: string | null }) {
  const state = await prisma.state.findFirst({ where: { id: input.stateId, isActive: true }, select: { id: true } });
  if (!state) return "INVALID_STATE";
  if (needsDistricts(input.role)) {
    const ids = [...new Set(input.districtIds ?? [])];
    if (!ids.length) return "DISTRICTS_REQUIRED";
    const found = await prisma.district.count({ where: { id: { in: ids }, stateId: state.id, isActive: true } });
    if (found !== ids.length) return "INVALID_DISTRICT";
  }
  if (needsGatc(input.role)) {
    if (!input.gatcId) return "GATC_REQUIRED";
    const gatc = await prisma.gATCProfile.findFirst({ where: { id: input.gatcId, stateId: state.id, approvalStatus: "APPROVED" }, select: { id: true } });
    if (!gatc) return "INVALID_GATC";
  }
  return null;
}
