import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { customAlphabet, nanoid } from "nanoid";
import { prisma } from "@/db/client";
import { getCertificateSigner } from "@/services/certificate-signer";
import { legalRuleEngine } from "@/services/legal-rule-engine";
import { transitionApplication } from "@/services/application-workflow";
import { notifyUser } from "@/services/notifications";
import { writeAudit } from "@/server/audit";
import { platformConfig, publicVerifyUrl } from "@/server/config";
import { dateOnly, payloadHash, type CertificatePayload } from "@/lib/certificate-integrity";

const serial = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

export function newCertificateNumber(stateCode: string | null | undefined, at = new Date()) {
  return `LMVC-${stateCode ?? "IN"}-${at.getFullYear()}-${serial()}`;
}

const certificateInclude = {
  application: { select: { applicationNumber: true, organizationId: true, organization: { select: { name: true, address: true } } } },
  instrument: {
    select: {
      instrumentCode: true,
      manufacturer: true,
      modelName: true,
      serialNumber: true,
      capacity: true,
      accuracy: true,
      locationLabel: true,
      address: true,
      instrumentType: { select: { code: true, name: true, nameHi: true } },
      state: { select: { name: true, code: true } },
    },
  },
  ruleVersion: {
    select: {
      versionNumber: true,
      effectiveFrom: true,
      legalRule: { select: { ruleNumber: true, ruleName: true, amendmentReference: true, sourceNotification: true } },
    },
  },
  qrToken: { select: { token: true } },
  revocations: { orderBy: { revokedAt: "desc" as const }, take: 1, select: { reason: true, revokedAt: true } },
} as const;

export async function loadCertificate(id: string) {
  return prisma.certificate.findUnique({ where: { id }, include: certificateInclude });
}

export type LoadedCertificate = NonNullable<Awaited<ReturnType<typeof loadCertificate>>>;

export function payloadFor(cert: LoadedCertificate): CertificatePayload {
  return {
    certificateNumber: cert.certificateNumber,
    applicationNumber: cert.application.applicationNumber,
    instrumentCode: cert.instrument.instrumentCode,
    instrumentTypeCode: cert.instrument.instrumentType.code,
    manufacturer: cert.instrument.manufacturer,
    modelName: cert.instrument.modelName,
    serialNumber: cert.instrument.serialNumber,
    organizationId: cert.application.organizationId,
    verificationDate: dateOnly(cert.verificationDate)!,
    validUntil: dateOnly(cert.validUntil),
    result: cert.result,
    issuingAuthority: cert.issuingAuthority ?? platformConfig.issuingAuthority,
    ruleVersionId: cert.ruleVersionId,
  };
}

/** Recomputes the payload hash from current DB values and checks it against the stored seal. */
export async function checkIntegrity(cert: LoadedCertificate) {
  if (!cert.contentHash) return { sealed: false, intact: false };
  const hash = payloadHash(payloadFor(cert));
  const sig = (cert.signatureMeta as { signature?: string } | null)?.signature;
  const signatureOk = sig
    ? await getCertificateSigner().verify({ certificateNumber: cert.certificateNumber, content: cert.contentHash }, sig)
    : false;
  return { sealed: true, intact: hash === cert.contentHash && signatureOk };
}

/** Public, non-personal fields only — no owner name, address or contact details. */
export function publicFieldsFor(p: CertificatePayload, instrumentTypeName: string) {
  return {
    certificateNumber: p.certificateNumber,
    instrumentType: instrumentTypeName,
    manufacturer: p.manufacturer,
    modelName: p.modelName,
    serialNumber: p.serialNumber,
    verificationDate: p.verificationDate,
    validUntil: p.validUntil,
    result: p.result,
    issuingAuthority: p.issuingAuthority,
  };
}

/**
 * Issues the certificate for an application that has been stamped. Validity comes only from the
 * Legal Rules Engine; when no period is configured, validUntil stays null (CONFIGURATION REQUIRED).
 */
export async function issueCertificate(opts: { applicationId: string; actorId: string }) {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: opts.applicationId },
    include: {
      instrument: { include: { instrumentType: true, state: true } },
      inspections: { include: { officer: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (application.status !== "STAMPING") {
    throw new Error(`Certificate can only be issued after stamping (current: ${application.status})`);
  }

  const verificationDate = new Date();
  const validity = await legalRuleEngine.calculateValidity({
    instrumentTypeCode: application.instrument.instrumentType.code,
    stateCode: application.instrument.state?.code,
    verificationDate,
  });

  const certificateNumber = newCertificateNumber(application.instrument.state?.code, verificationDate);
  const token = nanoid(24);
  const payload: CertificatePayload = {
    certificateNumber,
    applicationNumber: application.applicationNumber,
    instrumentCode: application.instrument.instrumentCode,
    instrumentTypeCode: application.instrument.instrumentType.code,
    manufacturer: application.instrument.manufacturer,
    modelName: application.instrument.modelName,
    serialNumber: application.instrument.serialNumber,
    organizationId: application.organizationId,
    verificationDate: dateOnly(verificationDate)!,
    validUntil: dateOnly(validity.nextDueDate),
    result: "PASS",
    issuingAuthority: platformConfig.issuingAuthority,
    ruleVersionId: validity.ruleVersionId ?? null,
  };
  const hash = payloadHash(payload);
  const signature = await getCertificateSigner().sign({ certificateNumber, content: hash });

  await transitionApplication({ applicationId: application.id, to: "CERTIFICATE_GENERATED", actorId: opts.actorId, notify: false });

  const cert = await prisma.certificate.create({
    data: {
      certificateNumber,
      applicationId: application.id,
      instrumentId: application.instrumentId,
      status: "ACTIVE",
      verificationDate,
      validUntil: validity.nextDueDate,
      result: "PASS",
      issuingAuthority: payload.issuingAuthority,
      officerName: application.inspections[0]?.officer?.name ?? null,
      ruleVersionId: validity.ruleVersionId ?? undefined,
      validityCalcMethod: validity.calculationMethod,
      contentHash: hash,
      signatureMeta: signature,
      isDemo: false,
      publicFields: publicFieldsFor(payload, application.instrument.instrumentType.name),
      versions: { create: { version: 1, snapshot: { payload, hash, signature } } },
      qrToken: { create: { token } },
    },
    include: { qrToken: true },
  });

  await transitionApplication({ applicationId: application.id, to: "CERTIFICATE_ISSUED", actorId: opts.actorId, notify: false });
  await transitionApplication({ applicationId: application.id, to: "ACTIVE", actorId: opts.actorId, notify: false });

  await prisma.instrument.update({
    where: { id: application.instrumentId },
    data: {
      lastVerificationAt: verificationDate,
      nextDueDate: validity.nextDueDate,
      certificateNumber,
      verificationStatus: "VERIFIED",
    },
  });

  await writeAudit({
    actorId: opts.actorId,
    action: "CERTIFICATE_ISSUED",
    entity: "Certificate",
    entityId: cert.id,
    after: { certificateNumber, validUntil: payload.validUntil, calc: validity.calculationMethod },
  });

  if (application.createdById !== opts.actorId) {
    await notifyUser({
      userId: application.createdById,
      type: "CERTIFICATE_ISSUED",
      title: `Certificate ${certificateNumber} issued`,
      body: `Verification certificate issued for application ${application.applicationNumber}.`,
      meta: { certificateId: cert.id, certificateNumber, applicationNumber: application.applicationNumber },
    });
  }

  return { certificate: cert, verifyUrl: publicVerifyUrl(token), validity };
}

// ---------------------------------------------------------------- PDF rendering

const INK = rgb(0.09, 0.1, 0.12);
const MUTED = rgb(0.36, 0.39, 0.44);
const BRAND = rgb(0.14, 0.21, 0.39);
const ACCENT = rgb(0.85, 0.45, 0.12);
const LINE = rgb(0.85, 0.87, 0.9);

function text(page: PDFPage, s: string, x: number, y: number, font: PDFFont, size: number, color = INK) {
  page.drawText(s, { x, y, size, font, color });
}

function fit(s: string, font: PDFFont, size: number, max: number) {
  if (font.widthOfTextAtSize(s, size) <= max) return s;
  let out = s;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > max) out = out.slice(0, -1);
  return `${out}…`;
}

export async function renderCertificatePdf(cert: LoadedCertificate) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Verification Certificate ${cert.certificateNumber}`);
  pdf.setSubject("Legal Metrology verification certificate");
  pdf.setProducer(platformConfig.issuingAuthority);
  pdf.setCreationDate(cert.createdAt);

  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  // Frame
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: BRAND, borderWidth: 1.4 });
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderColor: LINE, borderWidth: 0.6 });

  // Header band
  page.drawRectangle({ x: 30, y: height - 138, width: width - 60, height: 108, color: BRAND });
  page.drawRectangle({ x: 30, y: height - 141, width: width - 60, height: 3, color: ACCENT });
  text(page, fit(cert.issuingAuthority ?? platformConfig.issuingAuthority, bold, 11, 360).toUpperCase(), 52, height - 62, bold, 11, rgb(0.85, 0.89, 0.96));
  text(page, "VERIFICATION CERTIFICATE", 52, height - 92, bold, 24, rgb(1, 1, 1));
  text(page, "Weights and measures · Legal Metrology Act, 2009", 52, height - 114, regular, 10, rgb(0.8, 0.85, 0.94));

  // QR
  const url = cert.qrToken ? publicVerifyUrl(cert.qrToken.token) : platformConfig.appUrl;
  const qrPng = await QRCode.toBuffer(url, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#111a33", light: "#ffffff" } });
  const qr = await pdf.embedPng(qrPng);
  page.drawRectangle({ x: width - 158, y: height - 130, width: 100, height: 100, color: rgb(1, 1, 1) });
  page.drawImage(qr, { x: width - 154, y: height - 126, width: 92, height: 92 });

  // Number + status
  let y = height - 184;
  text(page, "CERTIFICATE NO.", 52, y + 16, bold, 8, MUTED);
  text(page, cert.certificateNumber, 52, y - 2, bold, 16, INK);
  const statusLabel = cert.status === "ACTIVE" ? (cert.validUntil && cert.validUntil < new Date() ? "EXPIRED" : "VALID") : cert.status;
  const statusColor = statusLabel === "VALID" ? rgb(0.02, 0.47, 0.34) : statusLabel === "EXPIRED" ? rgb(0.71, 0.33, 0.04) : rgb(0.73, 0.11, 0.11);
  const sw = bold.widthOfTextAtSize(statusLabel, 10) + 20;
  page.drawRectangle({ x: width - 52 - sw, y: y - 4, width: sw, height: 20, borderColor: statusColor, borderWidth: 1.2 });
  text(page, statusLabel, width - 52 - sw + 10, y + 2, bold, 10, statusColor);

  const section = (title: string, rows: [string, string][]) => {
    y -= 34;
    text(page, title.toUpperCase(), 52, y, bold, 9, BRAND);
    page.drawLine({ start: { x: 52, y: y - 6 }, end: { x: width - 52, y: y - 6 }, thickness: 0.6, color: LINE });
    y -= 24;
    const colW = (width - 104) / 2;
    rows.forEach(([label, value], i) => {
      const col = i % 2;
      const x = 52 + col * colW;
      if (col === 0 && i > 0) y -= 34;
      text(page, label, x, y + 10, regular, 8, MUTED);
      text(page, fit(value || "—", bold, 10.5, colW - 16), x, y - 3, bold, 10.5, INK);
    });
  };

  const typeName = cert.instrument.instrumentType.name;
  section("Instrument", [
    ["Instrument type", typeName],
    ["Instrument ID", cert.instrument.instrumentCode],
    ["Manufacturer", cert.instrument.manufacturer],
    ["Model", cert.instrument.modelName],
    ["Serial number", cert.instrument.serialNumber],
    ["Capacity", cert.instrument.capacity ?? "—"],
  ]);
  section("Owner & location", [
    ["Registered owner", cert.application.organization.name],
    ["Location", [cert.instrument.locationLabel, cert.instrument.state?.name].filter(Boolean).join(", ") || "—"],
  ]);
  const ruleRef = cert.ruleVersion
    ? `Rule ${cert.ruleVersion.legalRule.ruleNumber ?? ""} · ${cert.ruleVersion.legalRule.amendmentReference ?? cert.ruleVersion.legalRule.ruleName} (v${cert.ruleVersion.versionNumber})`
    : "Verification period: configuration required";
  section("Verification", [
    ["Result", cert.result],
    ["Application no.", cert.application.applicationNumber],
    ["Date of verification", dateOnly(cert.verificationDate) ?? "—"],
    ["Valid until", dateOnly(cert.validUntil) ?? "Configuration required"],
    ["Verifying officer", cert.officerName ?? "—"],
    ["Issuing authority", cert.issuingAuthority ?? platformConfig.issuingAuthority],
  ]);
  y -= 30;
  text(page, "Validity basis", 52, y, regular, 8, MUTED);
  text(page, fit(ruleRef, regular, 9.5, width - 104), 52, y - 13, regular, 9.5, INK);

  // Seal
  y -= 52;
  page.drawRectangle({ x: 52, y: y - 58, width: width - 104, height: 70, color: rgb(0.965, 0.97, 0.98), borderColor: LINE, borderWidth: 0.6 });
  const sig = cert.signatureMeta as { algorithm?: string; signedAt?: string; signature?: string } | null;
  text(page, "DIGITAL INTEGRITY SEAL", 66, y - 6, bold, 8.5, BRAND);
  text(page, `Content hash (SHA-256): ${cert.contentHash ?? "—"}`, 66, y - 22, mono, 7.2, INK);
  text(page, `Seal: ${sig?.algorithm ?? "—"} · ${sig?.signature ? `${sig.signature.slice(0, 32)}…` : "—"}`, 66, y - 34, mono, 7.2, INK);
  text(page, `Sealed at: ${sig?.signedAt ?? cert.createdAt.toISOString()}`, 66, y - 46, mono, 7.2, MUTED);

  // Footer
  page.drawLine({ start: { x: 52, y: 92 }, end: { x: width - 52, y: 92 }, thickness: 0.6, color: LINE });
  text(page, "Verify this certificate", 52, 74, bold, 9, INK);
  text(page, fit(url, regular, 9, width - 104), 52, 60, regular, 9, BRAND);
  text(
    page,
    "Scan the QR code or open the link to confirm the current status. The online status prevails over this printed copy.",
    52,
    44,
    regular,
    7.5,
    MUTED
  );

  return Buffer.from(await pdf.save());
}
