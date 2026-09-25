/**
 * Deployment-level identity. The issuing authority name is configuration, never hard-coded:
 * the platform must not assert issuance by any government body unless that body has
 * authorised the deployment and configured its name here.
 */
export const platformConfig = {
  issuingAuthority: process.env.NEXT_PUBLIC_ISSUING_AUTHORITY?.trim() || "Legal Metrology Verification Authority",
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  showQuickAccess: process.env.NEXT_PUBLIC_SHOW_QUICK_ACCESS === "true",
};

/**
 * Seeded evaluation accounts share one password. It is only ever sent to the browser when quick
 * access is explicitly enabled for a local/evaluation deployment, never in production.
 */
export function quickAccessPassword() {
  if (!platformConfig.showQuickAccess || process.env.VERCEL_ENV === "production") return null;
  return process.env.SEED_USER_PASSWORD || "Verify@2026";
}

export function publicVerifyUrl(token: string) {
  return `${platformConfig.appUrl}/c/${token}`;
}
