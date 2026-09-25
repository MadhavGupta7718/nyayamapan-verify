import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { requireApiUser } from "@/server/api";
import { SCHEDULER_ROLES } from "@/lib/permissions";
import { openTaskCounts } from "@/services/assignment";

/** Reference data for forms. Officer lists are only returned to schedulers and never include contact details. */
export async function GET(req: NextRequest) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const include = new URL(req.url).searchParams.get("include")?.split(",") ?? [];
  const canSchedule = SCHEDULER_ROLES.includes(user.role);

  const [types, states, officers, gatcs] = await Promise.all([
    prisma.instrumentType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, nameHi: true, requiredDocuments: true, requiredPhotos: true },
    }),
    prisma.state.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, nameHi: true, districts: { where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, nameHi: true } } },
    }),
    canSchedule && include.includes("officers")
      ? prisma.user.findMany({
          where: {
            role: user.role === "GATC_ADMIN" ? "GATC_OFFICER" : { in: ["LMO", "INSPECTOR"] },
            status: "ACTIVE",
            deletedAt: null,
            stateId: user.stateId ?? "__none__",
          },
          select: { id: true, name: true, role: true, stateId: true, gatcId: true, jurisdiction: { select: { id: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    include.includes("gatcs")
      ? prisma.gATCProfile.findMany({
          where: { approvalStatus: "APPROVED" },
          select: { id: true, name: true, approvalNumber: true, stateId: true, authorizations: { select: { instrumentTypeId: true } } },
        })
      : Promise.resolve([]),
  ]);
  if (officers.length) {
    const counts = await openTaskCounts(officers.map((o) => o.id));
    const withLoad = officers.map(({ jurisdiction, ...o }) => ({ ...o, districtIds: jurisdiction.map((d) => d.id), openTasks: counts.get(o.id) ?? 0 }));
    return NextResponse.json({ types, states, officers: withLoad, gatcs }, { headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.json({ types, states, officers, gatcs }, { headers: { "Cache-Control": "private, max-age=300" } });
}
