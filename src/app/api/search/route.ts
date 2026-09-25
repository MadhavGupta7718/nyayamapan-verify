import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { requireApiUser } from "@/server/api";
import { applicationScope, certificateScope, instrumentScope, userScope } from "@/server/scope";
import { canAccessModule } from "@/lib/permissions";
import { rateLimit } from "@/server/rate-limit";

const EMPTY = { applications: [], instruments: [], certificates: [], users: [] };

/** Global search for the command palette. Every entity is filtered by the caller's data scope. */
export async function GET(req: NextRequest) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  if (!rateLimit(`search:${user.id}`, 120, 60_000).ok) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 60) ?? "";
  if (q.length < 2) return NextResponse.json({ data: EMPTY });
  const contains = { contains: q, mode: "insensitive" as const };

  const [applications, instruments, certificates, users] = await Promise.all([
    prisma.application.findMany({
      where: {
        AND: [
          applicationScope(user),
          { OR: [{ applicationNumber: contains }, { instrument: { serialNumber: contains } }, { organization: { name: contains } }] },
        ],
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        applicationNumber: true,
        status: true,
        organization: { select: { name: true } },
        instrument: { select: { serialNumber: true } },
      },
    }),
    canAccessModule(user.role, "instruments")
      ? prisma.instrument.findMany({
          where: {
            AND: [
              instrumentScope(user),
              { OR: [{ instrumentCode: contains }, { serialNumber: contains }, { manufacturer: contains }, { modelName: contains }] },
            ],
          },
          take: 5,
          select: {
            id: true,
            instrumentCode: true,
            serialNumber: true,
            manufacturer: true,
            verificationStatus: true,
            instrumentType: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    prisma.certificate.findMany({
      where: { AND: [certificateScope(user), { OR: [{ certificateNumber: contains }, { instrument: { serialNumber: contains } }] }] },
      take: 5,
      orderBy: { verificationDate: "desc" },
      select: { id: true, certificateNumber: true, status: true, instrument: { select: { serialNumber: true, instrumentType: { select: { name: true } } } } },
    }),
    canAccessModule(user.role, "users")
      ? prisma.user.findMany({
          where: { AND: [userScope(user), { OR: [{ name: contains }, { email: contains }] }] },
          take: 5,
          select: { id: true, name: true, email: true, role: true },
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    data: {
      applications: applications.map((a) => ({
        id: a.id,
        applicationNumber: a.applicationNumber,
        status: a.status,
        subtitle: `${a.organization.name} · ${a.instrument.serialNumber}`,
      })),
      instruments: instruments.map((i) => ({
        id: i.id,
        instrumentCode: i.instrumentCode,
        verificationStatus: i.verificationStatus,
        subtitle: `${i.instrumentType.name} · ${i.manufacturer} · ${i.serialNumber}`,
      })),
      certificates: certificates.map((c) => ({
        id: c.id,
        certificateNumber: c.certificateNumber,
        status: c.status,
        subtitle: `${c.instrument.instrumentType.name} · ${c.instrument.serialNumber}`,
      })),
      users: users.map((u) => ({ id: u.id, name: u.name, subtitle: `${u.email} · ${u.role}` })),
    },
  });
}
