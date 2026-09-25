import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { jsonError, requireApiUser } from "@/server/api";
import { applicationScope } from "@/server/scope";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, checksumBuffer, sniffMime, storeFile } from "@/services/storage";
import { getMalwareScanner } from "@/services/malware-scanner";
import { writeAudit } from "@/server/audit";

const DOC_TYPE_RE = /^[a-z_]{2,40}$/;
const EDITABLE = ["DRAFT", "RETURNED", "SUBMITTED", "DOCUMENT_REVIEW"];

export async function POST(req: NextRequest) {
  const { user, response } = await requireApiUser(["BUSINESS_USER"]);
  if (response) return response;

  const form = await req.formData();
  const file = form.get("file");
  const applicationId = String(form.get("applicationId") ?? "");
  const documentType = String(form.get("documentType") ?? "supporting");
  if (!(file instanceof File) || !applicationId) return jsonError(400, "FILE_REQUIRED");
  if (!DOC_TYPE_RE.test(documentType)) return jsonError(400, "INVALID_DOCUMENT_TYPE");
  if (file.size > MAX_UPLOAD_BYTES) return jsonError(413, "FILE_TOO_LARGE");

  const app = await prisma.application.findFirst({
    where: { AND: [{ id: applicationId }, applicationScope(user)] },
    select: { id: true, status: true },
  });
  if (!app) return jsonError(404, "NOT_FOUND");
  if (!EDITABLE.includes(app.status)) return jsonError(409, "DOCUMENTS_LOCKED", { status: app.status });

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime || !ALLOWED_MIME.has(mime)) return jsonError(415, "UNSUPPORTED_FILE_TYPE");
  const scan = await getMalwareScanner().scan(file.name, mime, file.size);
  if (!scan.clean) return jsonError(422, "FILE_REJECTED_BY_SCANNER");

  const checksum = await checksumBuffer(buf);
  const previous = await prisma.applicationDocument.findFirst({
    where: { applicationId: app.id, documentType, status: { not: "SUPERSEDED" } },
    orderBy: { version: "desc" },
    select: { id: true, version: true },
  });
  const stored = await storeFile({
    key: `applications/${app.id}/${documentType}-v${(previous?.version ?? 0) + 1}.${mime.split("/")[1]}`,
    data: buf,
    contentType: mime,
  });
  const doc = await prisma.$transaction(async (tx) => {
    if (previous) await tx.applicationDocument.update({ where: { id: previous.id }, data: { status: "SUPERSEDED" } });
    return tx.applicationDocument.create({
      data: {
        applicationId: app.id,
        documentType,
        fileName: file.name.slice(0, 200),
        mimeType: mime,
        sizeBytes: file.size,
        storageKey: stored.key,
        storageUrl: stored.provider === "vercel-blob" ? stored.url : null,
        checksum,
        version: (previous?.version ?? 0) + 1,
        uploadedById: user.id,
      },
      select: { id: true, documentType: true, fileName: true, sizeBytes: true, version: true, createdAt: true },
    });
  });
  await writeAudit({ actorId: user.id, action: "DOCUMENT_UPLOADED", entity: "Application", entityId: app.id, after: { documentType, version: doc.version } });
  return NextResponse.json({ data: doc, scan: { engine: scan.engine, note: scan.note } }, { status: 201 });
}
