import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { requireApiUser } from "@/server/api";
import { certificateScope } from "@/server/scope";
import { pageMeta } from "@/lib/list-params";

export async function GET(req: NextRequest) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 20));
  const where = certificateScope(user);
  const total = await prisma.certificate.count({ where });
  const meta = pageMeta(total, page, pageSize);
  const data = await prisma.certificate.findMany({
    where,
    orderBy: { verificationDate: "desc" },
    skip: meta.skip,
    take: pageSize,
    select: {
      id: true,
      certificateNumber: true,
      status: true,
      verificationDate: true,
      validUntil: true,
      instrument: { select: { serialNumber: true, instrumentType: { select: { name: true } } } },
    },
  });
  return NextResponse.json({ data, meta });
}
