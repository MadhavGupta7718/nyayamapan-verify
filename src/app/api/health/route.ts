import { NextResponse } from "next/server";
import { prisma } from "@/db/client";

export async function GET() {
  const requestId = crypto.randomUUID();
  let db = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }
  return NextResponse.json({
    status: db === "ok" ? "healthy" : "degraded",
    requestId,
    checks: {
      database: db,
      storage: process.env.BLOB_READ_WRITE_TOKEN ? "vercel-blob" : "local-filesystem",
    },
    time: new Date().toISOString(),
  });
}
