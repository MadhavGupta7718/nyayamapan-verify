import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { jsonError, requireApiUser } from "@/server/api";
import { loadOpenInspection, loadVerifiableApplication } from "@/server/verification-access";
import { geofenceResponse } from "@/server/geofence";
import { LOCATION_NOT_FOUND_CATEGORY } from "@/lib/evidence";
import { MAX_UPLOAD_BYTES, checksumBuffer, sniffMime, storeFile } from "@/services/storage";
import { getMalwareScanner } from "@/services/malware-scanner";

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const CATEGORY_RE = /^[a-z_]{2,40}$/;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { id } = await ctx.params;
  const res = await loadVerifiableApplication(user, id);
  if ("error" in res) return jsonError(res.error!, res.error === 404 ? "NOT_FOUND" : "FORBIDDEN");

  const form = await req.formData();
  const file = form.get("file");
  const inspectionId = String(form.get("inspectionId") ?? "");
  const category = String(form.get("category") ?? "other");
  const lat = form.get("latitude") ? Number(form.get("latitude")) : undefined;
  const lng = form.get("longitude") ? Number(form.get("longitude")) : undefined;

  if (!(file instanceof File)) return jsonError(400, "FILE_REQUIRED");
  if (!CATEGORY_RE.test(category) || category === LOCATION_NOT_FOUND_CATEGORY) return jsonError(400, "INVALID_CATEGORY");
  const inspection = await loadOpenInspection(id, inspectionId);
  if (!inspection || inspection.completedAt) return jsonError(409, "INSPECTION_CLOSED");
  const outside = await geofenceResponse(inspection.id, res.app.instrument);
  if (outside) return outside;
  if (file.size > MAX_UPLOAD_BYTES) return jsonError(413, "FILE_TOO_LARGE");

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime || !IMAGE_MIME.has(mime)) return jsonError(415, "UNSUPPORTED_FILE_TYPE");

  const scan = await getMalwareScanner().scan(file.name, mime, file.size);
  if (!scan.clean) return jsonError(422, "FILE_REJECTED_BY_SCANNER");
  const checksum = await checksumBuffer(buf);
  const ext = mime.split("/")[1];
  const stored = await storeFile({ key: `inspections/${inspection.id}/${category}-${Date.now()}.${ext}`, data: buf, contentType: mime });

  const photo = await prisma.inspectionPhoto.create({
    data: {
      inspectionId: inspection.id,
      category,
      storageKey: stored.key,
      storageUrl: stored.provider === "vercel-blob" ? stored.url : null,
      checksum,
      latitude: Number.isFinite(lat) ? lat : undefined,
      longitude: Number.isFinite(lng) ? lng : undefined,
      capturedById: user.id,
    },
    select: { id: true, category: true, capturedAt: true, storageKey: true },
  });
  return NextResponse.json({ data: photo }, { status: 201 });
}
