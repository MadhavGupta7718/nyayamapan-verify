import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { requireApiUser } from "@/server/api";
import { SCHEDULER_ROLES } from "@/lib/permissions";

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
    prisma.state.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true, nameHi: true, districts: { select: { id: true, name: true, nameHi: true } } } }),
    canSchedule && include.includes("officers")
      ? prisma.user.findMany({
          where: {
            role: { in: ["LMO", "INSPECTOR", "GATC_OFFICER"] },
            status: "ACTIVE",
            deletedAt: null,
            ...(user.role === "SUPER_ADMIN" ? {} : { stateId: user.stateId ?? "__none__" }),
          },
          select: { id: true, name: true, role: true, stateId: true },
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
  return NextResponse.json({ types, states, officers, gatcs }, { headers: { "Cache-Control": "private, max-age=300" } });
}
