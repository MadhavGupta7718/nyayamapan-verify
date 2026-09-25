import { createHash } from "crypto";
import { prisma } from "@/db/client";
import { checkIntegrity, loadCertificate } from "@/services/certificates";
import { publicStatusOf, type PublicStatus } from "@/lib/certificate-status";

export type { PublicStatus };

export type PublicVerificationResult = {
  status: PublicStatus;
  verifiedAt: string;
  sealIntact: boolean | null;
  certificate: null | {
    certificateNumber: string;
    instrumentType: string;
    instrumentTypeHi: string | null;
    manufacturer: string;
    modelName: string;
    serialNumber: string;
    verificationDate: string;
    validUntil: string | null;
    result: string;
    issuingAuthority: string;
    statusChangedAt: string | null;
  };
};

const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Resolves an opaque QR token to the minimal public view of a certificate.
 * Never returns owner identity, addresses, contacts or internal identifiers.
 */
export async function verifyPublicToken(
  token: string,
  meta: { ip: string; userAgent?: string | null }
): Promise<PublicVerificationResult> {
  const verifiedAt = new Date().toISOString();
  if (!TOKEN_RE.test(token)) return { status: "INVALID", verifiedAt, sealIntact: null, certificate: null };

  const qr = await prisma.qrToken.findUnique({ where: { token }, select: { id: true, certificateId: true, expiresAt: true } });
  if (!qr || (qr.expiresAt && qr.expiresAt < new Date())) {
    return { status: "INVALID", verifiedAt, sealIntact: null, certificate: null };
  }
  const cert = await loadCertificate(qr.certificateId);
  if (!cert) return { status: "INVALID", verifiedAt, sealIntact: null, certificate: null };

  const status = publicStatusOf(cert);
  const integrity = await checkIntegrity(cert);

  await prisma.publicVerification.create({
    data: {
      qrTokenId: qr.id,
      result: status,
      ipHash: createHash("sha256").update(meta.ip).digest("hex").slice(0, 16),
      userAgent: meta.userAgent?.slice(0, 200),
    },
  });

  return {
    status,
    verifiedAt,
    sealIntact: integrity.sealed ? integrity.intact : null,
    certificate: {
      certificateNumber: cert.certificateNumber,
      instrumentType: cert.instrument.instrumentType.name,
      instrumentTypeHi: cert.instrument.instrumentType.nameHi,
      manufacturer: cert.instrument.manufacturer,
      modelName: cert.instrument.modelName,
      serialNumber: cert.instrument.serialNumber,
      verificationDate: cert.verificationDate.toISOString(),
      validUntil: cert.validUntil?.toISOString() ?? null,
      result: cert.result,
      issuingAuthority: cert.issuingAuthority ?? "",
      statusChangedAt: cert.revocations[0]?.revokedAt.toISOString() ?? null,
    },
  };
}

export async function tokenForCertificateNumber(certificateNumber: string) {
  const normalized = certificateNumber.trim().toUpperCase();
  if (!/^[A-Z0-9-]{6,40}$/.test(normalized)) return null;
  const cert = await prisma.certificate.findUnique({
    where: { certificateNumber: normalized },
    select: { qrToken: { select: { token: true } } },
  });
  return cert?.qrToken?.token ?? null;
}
