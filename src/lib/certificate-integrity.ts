import { createHash } from "crypto";

/** Fields that define a certificate. Any change to them after issuance breaks the seal. */
export type CertificatePayload = {
  certificateNumber: string;
  applicationNumber: string;
  instrumentCode: string;
  instrumentTypeCode: string;
  manufacturer: string;
  modelName: string;
  serialNumber: string;
  organizationId: string;
  verificationDate: string;
  validUntil: string | null;
  result: string;
  issuingAuthority: string;
  ruleVersionId: string | null;
};

export function canonicalPayload(p: CertificatePayload) {
  const ordered = Object.keys(p)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = p[k as keyof CertificatePayload];
      return acc;
    }, {});
  return JSON.stringify(ordered);
}

export function payloadHash(p: CertificatePayload) {
  return createHash("sha256").update(canonicalPayload(p)).digest("hex");
}

export function dateOnly(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : null;
}
