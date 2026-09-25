import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { jsonError, requireApiUser } from "@/server/api";
import { applicationScope } from "@/server/scope";
import { readStoredFile, safeKey, sniffMime } from "@/services/storage";

/**
 * Serves locally stored files only after resolving the owning record and applying the
 * caller's data scope — a valid session alone is not enough (prevents IDOR on file keys).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { key } = await ctx.params;
  const pathKey = safeKey(key.map(decodeURIComponent).join("/"));

  const [doc, photo] = await Promise.all([
    prisma.applicationDocument.findFirst({
      where: { storageKey: pathKey, application: applicationScope(user) },
      select: { fileName: true, storageUrl: true },
    }),
    prisma.inspectionPhoto.findFirst({
      where: { storageKey: pathKey, inspection: { application: applicationScope(user) } },
      select: { id: true, storageUrl: true },
    }),
  ]);
  if (!doc && !photo) return jsonError(404, "NOT_FOUND");

  try {
    const buf = await readStoredFile(pathKey, doc?.storageUrl ?? photo?.storageUrl);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": sniffMime(buf) ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${(doc?.fileName ?? pathKey.split("/").pop() ?? "file").replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return jsonError(404, "NOT_FOUND");
  }
}
