import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { requireApiUser } from "@/server/api";
import { applicationScope, certificateScope, scheduleScope } from "@/server/scope";
import { MODULE_ROLES } from "@/lib/permissions";
import { publicStatusOf } from "@/lib/certificate-status";
import { writeAudit } from "@/server/audit";

const MAX_ROWS = 5000;

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[], headers: string[]) {
  return ["\uFEFF" + headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\r\n");
}

export async function GET(req: NextRequest) {
  const { user, response } = await requireApiUser(MODULE_ROLES.reports);
  if (response) return response;
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type") ?? "applications";
  const from = sp.get("from") ? new Date(sp.get("from")!) : undefined;
  const to = sp.get("to") ? new Date(`${sp.get("to")}T23:59:59`) : undefined;
  const range = from || to ? { gte: from, lte: to } : undefined;

  let headers: string[] = [];
  let rows: Record<string, unknown>[] = [];

  if (type === "applications") {
    const data = await prisma.application.findMany({
      where: { AND: [applicationScope(user), range ? { createdAt: range } : {}] },
      take: MAX_ROWS,
      orderBy: { createdAt: "desc" },
      select: {
        applicationNumber: true,
        status: true,
        verificationType: true,
        createdAt: true,
        updatedAt: true,
        organization: { select: { name: true } },
        instrument: { select: { instrumentCode: true, serialNumber: true, instrumentType: { select: { name: true } }, state: { select: { name: true } } } },
      },
    });
    headers = ["applicationNumber", "status", "verificationType", "organization", "instrumentCode", "instrumentType", "serialNumber", "state", "createdAt", "updatedAt"];
    rows = data.map((a) => ({
      applicationNumber: a.applicationNumber,
      status: a.status,
      verificationType: a.verificationType,
      organization: a.organization.name,
      instrumentCode: a.instrument.instrumentCode,
      instrumentType: a.instrument.instrumentType.name,
      serialNumber: a.instrument.serialNumber,
      state: a.instrument.state?.name ?? "",
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  } else if (type === "certificates" || type === "expiring" || type === "expired") {
    const now = new Date();
    const extra =
      type === "expiring"
        ? { status: "ACTIVE" as const, validUntil: { gte: now, lte: new Date(now.getTime() + 90 * 86400000) } }
        : type === "expired"
          ? { OR: [{ status: "EXPIRED" as const }, { status: "ACTIVE" as const, validUntil: { lt: now } }] }
          : {};
    const data = await prisma.certificate.findMany({
      where: { AND: [certificateScope(user), extra, range ? { verificationDate: range } : {}] },
      take: MAX_ROWS,
      orderBy: { validUntil: "asc" },
      select: {
        certificateNumber: true,
        status: true,
        result: true,
        verificationDate: true,
        validUntil: true,
        validityCalcMethod: true,
        instrument: { select: { instrumentCode: true, serialNumber: true, instrumentType: { select: { name: true } } } },
        application: { select: { organization: { select: { name: true } } } },
      },
    });
    headers = ["certificateNumber", "effectiveStatus", "result", "organization", "instrumentCode", "instrumentType", "serialNumber", "verificationDate", "validUntil", "validityBasis"];
    rows = data.map((c) => ({
      certificateNumber: c.certificateNumber,
      effectiveStatus: publicStatusOf(c),
      result: c.result,
      organization: c.application.organization.name,
      instrumentCode: c.instrument.instrumentCode,
      instrumentType: c.instrument.instrumentType.name,
      serialNumber: c.instrument.serialNumber,
      verificationDate: c.verificationDate.toISOString().slice(0, 10),
      validUntil: c.validUntil?.toISOString().slice(0, 10) ?? "CONFIGURATION REQUIRED",
      validityBasis: c.validityCalcMethod ?? "",
    }));
  } else if (type === "workload") {
    const data = await prisma.verificationSchedule.findMany({
      where: { AND: [scheduleScope(user), range ? { scheduledDate: range } : {}] },
      take: MAX_ROWS,
      select: { status: true, assignment: { select: { officer: { select: { name: true } }, authorityType: true } } },
    });
    const byOfficer = new Map<string, { officer: string; authority: string; scheduled: number; completed: number }>();
    for (const s of data) {
      const name = s.assignment?.officer?.name ?? "Unassigned";
      const row = byOfficer.get(name) ?? { officer: name, authority: s.assignment?.authorityType ?? "", scheduled: 0, completed: 0 };
      if (s.status === "COMPLETED") row.completed += 1;
      else row.scheduled += 1;
      byOfficer.set(name, row);
    }
    headers = ["officer", "authority", "scheduled", "completed"];
    rows = [...byOfficer.values()];
  } else if (type === "public-verifications") {
    const data = await prisma.publicVerification.findMany({
      where: { AND: [range ? { verifiedAt: range } : {}, { qrToken: { certificate: certificateScope(user) } }] },
      take: MAX_ROWS,
      orderBy: { verifiedAt: "desc" },
      select: { result: true, verifiedAt: true, qrToken: { select: { certificate: { select: { certificateNumber: true } } } } },
    });
    headers = ["certificateNumber", "result", "verifiedAt"];
    rows = data.map((p) => ({ certificateNumber: p.qrToken.certificate.certificateNumber, result: p.result, verifiedAt: p.verifiedAt.toISOString() }));
  } else {
    return NextResponse.json({ error: "UNKNOWN_REPORT" }, { status: 400 });
  }

  await writeAudit({ actorId: user.id, action: "REPORT_EXPORTED", entity: "Report", after: { type, rows: rows.length } });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(rows, headers), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lm-${type}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
