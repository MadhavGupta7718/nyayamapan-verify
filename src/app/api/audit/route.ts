import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { requireApiUser } from "@/server/api";
import { auditScope } from "@/server/scope";
import { MODULE_ROLES } from "@/lib/permissions";
import { pageMeta } from "@/lib/list-params";

export async function GET(req: NextRequest) {
  const { user, response } = await requireApiUser(MODULE_ROLES.audit);
  if (response) return response;
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 50));
  const where = auditScope(user);
  const total = await prisma.auditLog.count({ where });
  const meta = pageMeta(total, page, pageSize);
  const data = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: meta.skip,
    take: pageSize,
    select: { id: true, action: true, entity: true, entityId: true, reason: true, createdAt: true, actor: { select: { name: true, role: true } } },
  });
  return NextResponse.json({ data, meta });
}
