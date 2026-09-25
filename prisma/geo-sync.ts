/**
 * Adds missing states/UTs and districts from prisma/data/india-geography.ts and fills in Hindi
 * state names. Never deletes or deactivates anything, so it is safe to run on a live database:
 *   DATABASE_URL=... npm run db:geo
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { INDIA_GEOGRAPHY } from "./data/india-geography";

export async function syncGeography(prisma: PrismaClient) {
  const existing = await prisma.state.findMany({ select: { id: true, code: true, name: true, nameHi: true, districts: { select: { name: true } } } });
  const byCode = new Map(existing.map((s) => [s.code, s]));
  let statesCreated = 0;
  let districtsCreated = 0;

  for (const g of INDIA_GEOGRAPHY) {
    let state = byCode.get(g.code);
    if (!state) {
      const created = await prisma.state.create({ data: { code: g.code, name: g.name, nameHi: g.nameHi }, select: { id: true, code: true, name: true, nameHi: true } });
      state = { ...created, districts: [] };
      statesCreated++;
    } else if (!state.nameHi) {
      await prisma.state.update({ where: { id: state.id }, data: { nameHi: g.nameHi } });
    }
    const have = new Set(state.districts.map((d) => d.name.toLowerCase()));
    const missing = g.districts.filter((d) => !have.has(d.toLowerCase()));
    if (missing.length) {
      const r = await prisma.district.createMany({ data: missing.map((name) => ({ name, stateId: state!.id })), skipDuplicates: true });
      districtsCreated += r.count;
    }
  }
  return { statesCreated, districtsCreated };
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("prisma/geo-sync.ts")) {
  config({ path: ".env" });
  const prisma = new PrismaClient();
  syncGeography(prisma)
    .then((r) => console.log(`Geography sync: ${r.statesCreated} states and ${r.districtsCreated} districts added.`))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
