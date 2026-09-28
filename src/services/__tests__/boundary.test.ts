import { describe, expect, it } from "vitest";
import { STATE_ISO, distanceToAreaKm, findDistrictByName, inArea, normalizePlaceName, type Area } from "@/lib/boundary";
import { INDIA_BOUNDARIES } from "@/server/data/india-boundaries";
import { INDIA_GEOGRAPHY } from "../../../prisma/data/india-geography";

const square = (x0: number, y0: number, x1: number, y1: number) => [x0, y0, x1, y0, x1, y1, x0, y1, x0, y0];
const donut: Area = { bbox: [0, 0, 10, 10], polys: [[square(0, 0, 10, 10), square(4, 4, 6, 6)]] };

describe("point in polygon", () => {
  it("respects the outer ring, holes and the bounding box", () => {
    expect(inArea(1, 1, donut)).toBe(true);
    expect(inArea(5, 5, donut)).toBe(false);
    expect(inArea(11, 5, donut)).toBe(false);
  });

  it("measures distance to the nearest edge in km", () => {
    expect(distanceToAreaKm(5, 1, donut)).toBe(0);
    expect(distanceToAreaKm(0, 10.01, donut)).toBeCloseTo(1.1, 1);
  });
});

describe("India boundaries", () => {
  const stateAt = (lng: number, lat: number) => INDIA_BOUNDARIES.states.find((s) => inArea(lng, lat, s))?.iso;
  const districtAt = (lng: number, lat: number) => INDIA_BOUNDARIES.districts.find((d) => inArea(lng, lat, d));

  it("covers every state and UT", () => {
    expect(INDIA_BOUNDARIES.states).toHaveLength(36);
    expect(INDIA_BOUNDARIES.districts.every((d) => d.iso)).toBe(true);
  });

  it.each([
    ["Connaught Place", 77.2167, 28.6315, "DL"],
    ["Gurugram", 77.0266, 28.4595, "HR"],
    ["Mumbai CST", 72.8356, 18.94, "MH"],
    ["Bengaluru", 77.5946, 12.9716, "KA"],
    ["Kolkata", 88.3639, 22.5726, "WB"],
    ["Hyderabad", 78.4867, 17.385, "TG"],
    ["Lucknow", 80.9462, 26.8467, "UP"],
  ])("places %s in %s", (_name, lng, lat, iso) => {
    expect(stateAt(lng, lat)).toBe(iso);
  });

  it("assigns districts to their state", () => {
    expect(districtAt(72.5714, 23.0225)).toMatchObject({ iso: "GJ", name: "Ahmadabad" });
  });

  it("matches boundary districts to our district list", () => {
    const misses: string[] = [];
    let total = 0;
    for (const s of INDIA_GEOGRAPHY) {
      const iso = STATE_ISO[s.code] ?? s.code;
      const ours = s.districts;
      for (const b of INDIA_BOUNDARIES.districts.filter((d) => d.iso === iso)) {
        total++;
        if (!findDistrictByName(ours.map((name) => ({ name })), b.name, iso)) misses.push(`${iso}: ${b.name}`);
      }
    }
    // Barddhaman has since been split in two and Ladakh's second polygon is unnamed; those stay "unknown".
    expect(misses, `${total - misses.length}/${total} matched`).toEqual(["WB: Barddhaman", "LA: DATA NOT AVAILABLE"]);
  });

  it("treats a point across the border as outside the state", () => {
    const delhi = INDIA_BOUNDARIES.states.find((s) => s.iso === "DL")!;
    expect(distanceToAreaKm(77.2167, 28.6315, delhi)).toBe(0);
    expect(distanceToAreaKm(72.8356, 18.94, delhi)).toBeGreaterThan(1000);
  });
});

describe("place names", () => {
  it("ignores case, diacritics, punctuation and the word district", () => {
    expect(normalizePlaceName("Bengalūru Urban")).toBe(normalizePlaceName("bengaluru-urban"));
    expect(normalizePlaceName("North West District")).toBe("northwest");
    expect(normalizePlaceName("Dadra & Nagar Haveli")).toBe("dadraandnagarhaveli");
    expect(normalizePlaceName("Pashchim Champaran")).toBe(normalizePlaceName("West Champaran"));
    expect(normalizePlaceName("North Twenty Four Parganas")).toBe(normalizePlaceName("North 24 Parganas"));
  });

  it("maps renamed and re-spelt districts, and refuses to guess", () => {
    const ours = [{ name: "Ahmedabad" }, { name: "Gurugram" }, { name: "Bastar" }, { name: "Kanker" }, { name: "Bengaluru Rural" }, { name: "Bengaluru Urban" }];
    expect(findDistrictByName(ours, "Ahmadabad")?.name).toBe("Ahmedabad");
    expect(findDistrictByName(ours, "Gurgaon", "HR")?.name).toBe("Gurugram");
    expect(findDistrictByName(ours, "Uttar Bastar Kanker", "CT")?.name).toBe("Kanker");
    expect(findDistrictByName(ours, "Bengaluru")).toBeNull();
  });
});
