/** A ring is a flat [lng, lat, lng, lat, ...] array; a polygon is its outer ring followed by holes. */
export type Ring = number[];
export type Polygon = Ring[];
export type Area = { bbox: [number, number, number, number]; polys: Polygon[] };
export type BoundaryData = {
  source: string;
  states: (Area & { iso: string; name: string })[];
  districts: (Area & { iso: string | null; name: string })[];
};

function inRing(lng: number, lat: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inArea(lng: number, lat: number, area: Area) {
  const [minX, minY, maxX, maxY] = area.bbox;
  if (lng < minX || lng > maxX || lat < minY || lat > maxY) return false;
  return area.polys.some((poly) => inRing(lng, lat, poly[0]) && !poly.slice(1).some((hole) => inRing(lng, lat, hole)));
}

const KM_PER_DEG_LAT = 110.574;

/** Kilometres from the point to the nearest edge of the area (0 when inside), using a local flat projection. */
export function distanceToAreaKm(lng: number, lat: number, area: Area) {
  if (inArea(lng, lat, area)) return 0;
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = KM_PER_DEG_LAT;
  let best = Infinity;
  for (const poly of area.polys) {
    for (const ring of poly) {
      for (let i = 0; i + 3 < ring.length; i += 2) {
        const ax = (ring[i] - lng) * kx, ay = (ring[i + 1] - lat) * ky;
        const bx = (ring[i + 2] - lng) * kx, by = (ring[i + 3] - lat) * ky;
        const dx = bx - ax, dy = by - ay;
        const len = dx * dx + dy * dy;
        const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
        const px = ax + t * dx, py = ay + t * dy;
        best = Math.min(best, px * px + py * py);
      }
    }
  }
  return Math.sqrt(best);
}

/** Our state codes that differ from the ISO 3166-2:IN suffixes used by the boundary data. */
export const STATE_ISO: Record<string, string> = { CG: "CT", OD: "OR", TS: "TG", UK: "UT" };

/**
 * Lower-case ASCII letters and digits only, with Hindi direction words and spelt-out numbers unified, so
 * "Pashchim Champaran" and "West Champaran", or "North Twenty Four Parganas" and "North 24 Parganas", compare equal.
 */
export function normalizePlaceName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/\btwenty[\s-]*four\b/g, "24")
    .replace(/\b(pashchimi|pashchim|paschim)\b/g, "west")
    .replace(/\b(purbi|purba|purva)\b/g, "east")
    .replace(/\buttar\b/g, "north")
    .replace(/\bdakshin\b/g, "south")
    .replace(/\b(the|district)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Absorbs transliteration variants such as Ahmadabad/Ahmedabad: drop vowels and doubled letters. */
function skeleton(normalized: string) {
  return normalized[0] + normalized.slice(1).replace(/[aeiouyh]/g, "").replace(/w/g, "v").replace(/(.)\1+/g, "$1");
}

/** Boundary data (LGD 2021) names for districts since renamed or re-spelt: [state ISO, boundary name, our name]. */
const DISTRICT_ALIASES: [string, string, string][] = [
  ["AS", "Karimganj", "Sribhumi"],
  ["CT", "Uttar Bastar Kanker", "Kanker"],
  ["CT", "Dakshin Bastar Dantewada", "Dantewada"],
  ["GJ", "Kachchh", "Kutch"],
  ["HR", "Gurgaon", "Gurugram"],
  ["HR", "Mewat", "Nuh"],
  ["KA", "Bijapur", "Vijayapura"],
  ["KA", "Gulbarga", "Kalaburagi"],
  ["KA", "Shimoga", "Shivamogga"],
  ["KA", "Belgaum", "Belagavi"],
  ["KA", "Bangalore", "Bengaluru Urban"],
  ["KA", "Ramanagara", "Bengaluru South"],
  ["MP", "Hoshangabad", "Narmadapuram"],
  ["MP", "Narsimhapur", "Narsinghpur"],
  ["MP", "Agar", "Agar Malwa"],
  ["MH", "Ahmadnagar", "Ahilyanagar"],
  ["MH", "Osmanabad", "Dharashiv"],
  ["MH", "Aurangabad", "Chhatrapati Sambhajinagar"],
  ["MH", "Raigarh", "Raigad"],
  ["MH", "Mumbai", "Mumbai City"],
  ["OR", "Debagarh", "Deogarh"],
  ["OR", "Baleshwar", "Balasore"],
  ["SK", "North District", "Mangan"],
  ["SK", "South District", "Namchi"],
  ["SK", "West District", "Gyalshing"],
  ["SK", "East District", "Gangtok"],
  ["TG", "Komaram Bheem", "Kumuram Bheem Asifabad"],
  ["TG", "Yadadri Bhongiri", "Yadadri Bhuvanagiri"],
  ["UP", "Kanshiram Nagar", "Kasganj"],
  ["UP", "Shrawasti", "Shravasti"],
  ["UP", "Mahamaya Nagar", "Hathras"],
  ["UP", "Jyotiba Phule Nagar", "Amroha"],
  ["UP", "Faizabad", "Ayodhya"],
  ["UP", "Allahabad", "Prayagraj"],
  ["UP", "Sant Ravidas Nagar", "Bhadohi"],
  ["UT", "Garhwal", "Pauri Garhwal"],
  ["WB", "Haora", "Howrah"],
  ["WB", "Koch Bihar", "Cooch Behar"],
  ["DL", "East", "East Delhi"],
  ["DL", "West", "West Delhi"],
  ["DL", "South", "South Delhi"],
  ["DL", "North", "North Delhi"],
];

/**
 * Finds our district for a boundary-data district name: exact, known alias, transliteration variant, then a
 * unique partial match. Returns null rather than guess when the name is ambiguous.
 */
export function findDistrictByName<T extends { name: string }>(districts: T[], name: string, stateIso?: string): T | null {
  const target = normalizePlaceName(name);
  if (!target) return null;
  const norm = districts.map((d) => ({ d, n: normalizePlaceName(d.name) }));
  const exact = norm.find((x) => x.n === target);
  if (exact) return exact.d;
  const alias = DISTRICT_ALIASES.find(([iso, from]) => (!stateIso || iso === stateIso) && normalizePlaceName(from) === target);
  const aliased = alias && norm.find((x) => x.n === normalizePlaceName(alias[2]));
  if (aliased) return aliased.d;
  const sk = skeleton(target);
  const bySkeleton = norm.filter((x) => x.n && skeleton(x.n) === sk);
  if (bySkeleton.length === 1) return bySkeleton[0].d;
  const partial = norm.filter((x) => x.n.length >= 4 && target.length >= 4 && (x.n.includes(target) || target.includes(x.n)));
  return partial.length === 1 ? partial[0].d : null;
}
