import { describe, expect, it, vi } from "vitest";

const STATES = [
  { id: "s-dl", code: "DL", name: "Delhi" },
  { id: "s-hr", code: "HR", name: "Haryana" },
  { id: "s-mh", code: "MH", name: "Maharashtra" },
  { id: "s-zz", code: "ZZ", name: "New Territory" },
];
const DISTRICTS: Record<string, { id: string; name: string }[]> = {
  "s-dl": ["Central Delhi", "New Delhi", "South West Delhi"].map((name) => ({ id: `d-${name}`, name })),
  "s-hr": ["Faridabad", "Gurugram", "Jhajjar"].map((name) => ({ id: `d-${name}`, name })),
  "s-mh": ["Mumbai City", "Mumbai Suburban", "Pune"].map((name) => ({ id: `d-${name}`, name })),
};

vi.mock("@/db/client", () => ({
  prisma: {
    state: {
      findUnique: async ({ where }: { where: { id: string } }) => STATES.find((s) => s.id === where.id) ?? null,
      findFirst: async ({ where }: { where: { code: string } }) => STATES.find((s) => s.code === where.code) ?? null,
    },
    district: { findMany: async ({ where }: { where: { stateId: string } }) => DISTRICTS[where.stateId] ?? [] },
  },
}));

const { checkSiteLocation } = await import("@/server/location-check");
const { blocksSave } = await import("@/lib/site-location");

describe("site location check", () => {
  it("accepts a site inside the chosen state and district", async () => {
    const r = await checkSiteLocation({ stateId: "s-hr", districtId: "d-Gurugram", latitude: 28.4595, longitude: 77.0266 });
    expect(r).toMatchObject({ state: "inside", distanceKm: 0, district: "same", detectedDistrict: { id: "d-Gurugram" } });
    expect(blocksSave(r)).toBe(false);
  });

  it("blocks a site in another state and suggests that state and its district", async () => {
    const r = await checkSiteLocation({ stateId: "s-dl", districtId: "d-New Delhi", latitude: 28.4595, longitude: 77.0266 });
    expect(r.state).toBe("outside");
    expect(r.distanceKm).toBeGreaterThan(2);
    expect(r.detectedState).toEqual({ id: "s-hr", name: "Haryana" });
    expect(r.detectedDistrict).toEqual({ id: "d-Gurugram", name: "Gurugram" });
    expect(blocksSave(r)).toBe(true);
  });

  it("warns without blocking when only the district is wrong", async () => {
    const r = await checkSiteLocation({ stateId: "s-mh", districtId: "d-Pune", latitude: 18.94, longitude: 72.8356 });
    expect(r).toMatchObject({ state: "inside", district: "different", detectedDistrict: { id: "d-Mumbai City" } });
    expect(blocksSave(r)).toBe(false);
  });

  it("blocks coordinates that are in no state at all", async () => {
    const r = await checkSiteLocation({ stateId: "s-mh", latitude: 15, longitude: 68 });
    expect(r).toMatchObject({ state: "outside", detectedState: null, detectedDistrict: null });
    expect(blocksSave(r)).toBe(true);
  });

  it("skips states without a boundary", async () => {
    const r = await checkSiteLocation({ stateId: "s-zz", latitude: 18.94, longitude: 72.8356 });
    expect(r.state).toBe("unknown");
    expect(blocksSave(r)).toBe(false);
  });
});
