import { describe, expect, it } from "vitest";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, safeKey, sniffMime } from "../storage";
import { applicationScope, auditScope, certificateScope, userScope } from "../../server/scope";
import { canAccessModule } from "../../lib/permissions";
import { isAuthorizedCron } from "../../server/cron-auth";
import type { SessionUser } from "../../server/rbac";

const u = (role: SessionUser["role"], extra: Partial<SessionUser> = {}): SessionUser => ({ id: "u1", email: "x@y.z", name: "X", role, ...extra });

describe("upload security", () => {
  it("allows only configured mime types", () => {
    expect(ALLOWED_MIME.has("application/pdf")).toBe(true);
    expect(ALLOWED_MIME.has("image/jpeg")).toBe(true);
    expect(ALLOWED_MIME.has("application/x-msdownload")).toBe(false);
    expect(ALLOWED_MIME.has("text/html")).toBe(false);
  });

  it("enforces the size limit", () => {
    expect(MAX_UPLOAD_BYTES).toBeLessThanOrEqual(8 * 1024 * 1024);
  });

  it("detects the real file type from magic bytes", () => {
    expect(sniffMime(Buffer.from("%PDF-1.7\n%âãÏÓ\n"))).toBe("application/pdf");
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(sniffMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe("image/png");
  });

  it("rejects executables and HTML disguised as documents", () => {
    expect(sniffMime(Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00"))).toBeNull();
    expect(sniffMime(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
  });

  it("neutralises path traversal in storage keys", () => {
    expect(safeKey("../../etc/passwd")).not.toContain("..");
    expect(safeKey("..\\..\\windows\\system32")).not.toContain("..");
    expect(safeKey("applications/a b/<x>.pdf")).toBe("applications/a_b/_x_.pdf");
  });
});

describe("data scoping (IDOR prevention)", () => {
  it("binds business users to their organisation", () => {
    expect(applicationScope(u("BUSINESS_USER", { organizationId: "org-a" }))).toEqual({ organizationId: "org-a" });
  });

  it("returns an empty result set for a business user without an organisation", () => {
    expect(applicationScope(u("BUSINESS_USER"))).not.toEqual({});
  });

  it("binds state admins to their state", () => {
    expect(applicationScope(u("STATE_ADMIN", { stateId: "dl" }))).toEqual({ instrument: { stateId: "dl" } });
    expect(applicationScope(u("STATE_ADMIN"))).not.toEqual({});
  });

  it("limits field officers to their own current assignments", () => {
    expect(applicationScope(u("LMO", { id: "officer-1" }))).toEqual({ assignments: { some: { officerId: "officer-1", status: { notIn: ["CANCELLED", "REASSIGNED"] } } } });
  });

  it("keeps verification away from every administrator", () => {
    for (const role of ["SUPER_ADMIN", "STATE_ADMIN", "GATC_ADMIN", "AUDITOR"] as const) expect(canAccessModule(role, "verification")).toBe(false);
  });

  it("scopes certificates through the application scope", () => {
    expect(certificateScope(u("BUSINESS_USER", { organizationId: "org-a" }))).toEqual({ application: { organizationId: "org-a" } });
  });

  it("lets non-admins see only their own account", () => {
    expect(userScope(u("LMO", { id: "me" }))).toEqual({ id: "me" });
    expect(userScope(u("BUSINESS_USER", { id: "me" }))).toEqual({ id: "me" });
  });

  it("hides audit logs from operational and business roles", () => {
    for (const role of ["BUSINESS_USER", "LMO", "INSPECTOR", "GATC_OFFICER", "GATC_ADMIN"] as const) {
      expect(auditScope(u(role))).not.toEqual({});
    }
  });
});

describe("module access", () => {
  it("keeps administration modules away from business users", () => {
    for (const m of ["rules", "users", "audit", "reports", "scheduling", "verification", "gatc"] as const) {
      expect(canAccessModule("BUSINESS_USER", m)).toBe(false);
    }
  });

  it("gives auditors read modules but not user administration", () => {
    expect(canAccessModule("AUDITOR", "audit")).toBe(true);
    expect(canAccessModule("AUDITOR", "users")).toBe(false);
  });
});

describe("cron authentication", () => {
  it("fails closed in production without a secret", () => {
    const env = { ...process.env };
    try {
      delete process.env.CRON_SECRET;
      (process.env as Record<string, string>).NODE_ENV = "production";
      expect(isAuthorizedCron(new Headers())).toBe(false);
    } finally {
      Object.assign(process.env, env);
    }
  });

  it("requires the exact bearer secret", () => {
    const env = { ...process.env };
    try {
      process.env.CRON_SECRET = "s3cret-value";
      expect(isAuthorizedCron(new Headers({ authorization: "Bearer s3cret-value" }))).toBe(true);
      expect(isAuthorizedCron(new Headers({ authorization: "Bearer wrong" }))).toBe(false);
      expect(isAuthorizedCron(new Headers())).toBe(false);
    } finally {
      Object.assign(process.env, env);
    }
  });
});
