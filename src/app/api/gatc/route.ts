import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { requireApiUser } from "@/server/api";

export async function GET() {
  const { user, response } = await requireApiUser(["SUPER_ADMIN", "STATE_ADMIN", "AUDITOR", "GATC_ADMIN", "GATC_OFFICER", "BUSINESS_USER", "LMO"]);
  if (response) return response;
  const data = await prisma.gATCProfile.findMany({
    where: user.role === "GATC_ADMIN" || user.role === "STATE_ADMIN" ? { stateId: user.stateId ?? "__none__" } : {},
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      approvalNumber: true,
      approvalStatus: true,
      approvalStart: true,
      approvalEnd: true,
      address: true,
      latitude: true,
      longitude: true,
      state: { select: { name: true, nameHi: true } },
      authorizations: { select: { instrumentType: { select: { code: true, name: true, nameHi: true } } } },
    },
  });
  return NextResponse.json({ data });
}
