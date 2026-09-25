import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { jsonError, requireApiUser } from "@/server/api";
import { certificateScope } from "@/server/scope";
import { loadCertificate, renderCertificatePdf } from "@/services/certificates";
import { writeAudit } from "@/server/audit";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { id } = await ctx.params;
  const allowed = await prisma.certificate.findFirst({ where: { AND: [{ id }, certificateScope(user)] }, select: { id: true } });
  if (!allowed) return jsonError(404, "NOT_FOUND");
  const cert = await loadCertificate(id);
  if (!cert) return jsonError(404, "NOT_FOUND");

  const pdf = await renderCertificatePdf(cert);
  await writeAudit({ actorId: user.id, action: "CERTIFICATE_DOWNLOADED", entity: "Certificate", entityId: id });
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${cert.certificateNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
