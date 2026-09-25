import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/server/api";
import { loadVerifiableApplication } from "@/server/verification-access";
import { issueCertificate } from "@/services/certificates";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { id } = await ctx.params;
  const res = await loadVerifiableApplication(user, id);
  if ("error" in res) return jsonError(res.error!, res.error === 404 ? "NOT_FOUND" : "FORBIDDEN");
  if (res.app.status !== "STAMPING") return jsonError(409, "CERTIFICATE_REQUIRES_STAMPING", { status: res.app.status });

  const { certificate, verifyUrl, validity } = await issueCertificate({ applicationId: id, actorId: user.id });
  return NextResponse.json(
    {
      data: {
        id: certificate.id,
        certificateNumber: certificate.certificateNumber,
        validUntil: certificate.validUntil,
        verifyUrl,
        validityMethod: validity.calculationMethod,
      },
    },
    { status: 201 }
  );
}
