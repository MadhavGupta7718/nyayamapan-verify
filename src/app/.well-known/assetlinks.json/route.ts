import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Digital Asset Links for the Android app (Trusted Web Activity). Without a matching fingerprint the app
// still opens, but Chrome shows its URL bar on top of the site.
export function GET() {
  const fingerprints = (process.env.TWA_SHA256_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean);
  if (!fingerprints.length) return NextResponse.json([], { status: 404 });
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: process.env.TWA_PACKAGE_NAME || "in.nyayamapan.verify", sha256_cert_fingerprints: fingerprints },
      },
    ],
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
