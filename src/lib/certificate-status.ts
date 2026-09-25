export type PublicStatus = "VALID" | "EXPIRED" | "REVOKED" | "SUSPENDED" | "INVALID";

/** Effective status of a certificate as shown to the public and on certificate pages. */
export function publicStatusOf(cert: { status: string; validUntil: Date | string | null }, now = new Date()): PublicStatus {
  if (cert.status === "REVOKED") return "REVOKED";
  if (cert.status === "SUSPENDED") return "SUSPENDED";
  if (cert.status === "CANCELLED") return "INVALID";
  if (cert.status === "EXPIRED") return "EXPIRED";
  const until = cert.validUntil ? new Date(cert.validUntil) : null;
  if (until && until < now) return "EXPIRED";
  if (cert.status === "ACTIVE") return "VALID";
  return "INVALID";
}
