/** A site this close to its chosen state's border is accepted, to absorb GPS error and simplified boundaries. */
export const STATE_BORDER_TOLERANCE_KM = 2;

export type SiteLocationCheck = {
  /** "unknown" when there is no boundary for the chosen state (e.g. a state added later by the Super Admin). */
  state: "inside" | "near" | "outside" | "unknown";
  /** Distance from the chosen state's boundary, rounded to 0.1 km. */
  distanceKm: number;
  detectedState: { id: string | null; name: string } | null;
  /** "unknown" when the district couldn't be resolved or its name doesn't match one of ours. */
  district: "same" | "different" | "unknown";
  detectedDistrict: { id: string | null; name: string } | null;
};

export const blocksSave = (check: SiteLocationCheck | null) => check?.state === "outside";
