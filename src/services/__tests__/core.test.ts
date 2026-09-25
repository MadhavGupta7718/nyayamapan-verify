import { describe, expect, it } from "vitest";
import { LegalRuleEngine } from "../legal-rule-engine";
import { PlatformHmacSigner, ProductionDSCSigner } from "../certificate-signer";
import { hasRole } from "../../server/rbac";
import { publicStatusOf } from "../../lib/certificate-status";
import { payloadHash, type CertificatePayload } from "../../lib/certificate-integrity";

describe("LegalRuleEngine.validateMeasurement", () => {
  const engine = new LegalRuleEngine();

  it("returns CONFIGURATION_REQUIRED when the permissible error is not configured", () => {
    const r = engine.validateMeasurement({ observedValue: 10, referenceValue: 10, permissibleError: null });
    expect(r.result).toBe("CONFIGURATION_REQUIRED");
  });

  it("passes when within the permissible error", () => {
    const r = engine.validateMeasurement({ observedValue: 10.05, referenceValue: 10, permissibleError: 0.1 });
    expect(r.result).toBe("PASS");
    expect(r.error).toBeCloseTo(0.05);
  });

  it("fails when the permissible error is exceeded", () => {
    const r = engine.validateMeasurement({ observedValue: 11, referenceValue: 10, permissibleError: 0.1 });
    expect(r.result).toBe("FAIL");
  });
});

describe("PlatformHmacSigner", () => {
  const signer = new PlatformHmacSigner();
  const input = { certificateNumber: "LMVC-DL-2026-ABC234", content: "a".repeat(64) };

  it("verifies its own seal", async () => {
    const sig = await signer.sign(input);
    expect(sig.mode).toBe("platform-hmac");
    expect(await signer.verify(input, sig.signature)).toBe(true);
  });

  it("rejects a seal when the content changes", async () => {
    const sig = await signer.sign(input);
    expect(await signer.verify({ ...input, content: "b".repeat(64) }, sig.signature)).toBe(false);
    expect(await signer.verify({ ...input, certificateNumber: "LMVC-DL-2026-XYZ789" }, sig.signature)).toBe(false);
  });

  it("rejects malformed signatures without throwing", async () => {
    expect(await signer.verify(input, "zz")).toBe(false);
    expect(await signer.verify(input, "")).toBe(false);
  });
});

describe("ProductionDSCSigner", () => {
  it("fails closed until a DSC/HSM is integrated", async () => {
    const s = new ProductionDSCSigner();
    await expect(s.sign({ certificateNumber: "X", content: "Y" })).rejects.toThrow();
    expect(await s.verify()).toBe(false);
  });
});

describe("certificate payload hash", () => {
  const base: CertificatePayload = {
    certificateNumber: "LMVC-DL-2026-ABC234",
    applicationNumber: "LMA-2026-000001",
    instrumentCode: "INS-1",
    instrumentTypeCode: "WEIGHING_NAWI",
    manufacturer: "Acme",
    modelName: "M1",
    serialNumber: "SN-1",
    organizationId: "org-1",
    verificationDate: "2026-01-01",
    validUntil: null,
    result: "PASS",
    issuingAuthority: "Authority",
    ruleVersionId: null,
  };

  it("is deterministic", () => {
    expect(payloadHash(base)).toBe(payloadHash({ ...base }));
  });

  it("changes when any sealed field changes", () => {
    expect(payloadHash({ ...base, serialNumber: "SN-2" })).not.toBe(payloadHash(base));
    expect(payloadHash({ ...base, validUntil: "2027-01-01" })).not.toBe(payloadHash(base));
  });
});

describe("publicStatusOf", () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date("2020-01-01");

  it("maps lifecycle states", () => {
    expect(publicStatusOf({ status: "REVOKED", validUntil: future })).toBe("REVOKED");
    expect(publicStatusOf({ status: "SUSPENDED", validUntil: future })).toBe("SUSPENDED");
    expect(publicStatusOf({ status: "CANCELLED", validUntil: future })).toBe("INVALID");
    expect(publicStatusOf({ status: "EXPIRED", validUntil: future })).toBe("EXPIRED");
  });

  it("treats an active certificate past its validity as expired", () => {
    expect(publicStatusOf({ status: "ACTIVE", validUntil: past })).toBe("EXPIRED");
    expect(publicStatusOf({ status: "ACTIVE", validUntil: future })).toBe("VALID");
  });

  it("revocation wins over expiry", () => {
    expect(publicStatusOf({ status: "REVOKED", validUntil: past })).toBe("REVOKED");
  });
});

describe("hasRole", () => {
  const user = (role: "LMO" | "BUSINESS_USER") => ({ id: "1", email: "a@b.c", name: "A", role });
  it("allows matching roles", () => expect(hasRole(user("LMO"), ["LMO", "SUPER_ADMIN"])).toBe(true));
  it("denies other roles", () => expect(hasRole(user("BUSINESS_USER"), ["LMO"])).toBe(false));
  it("denies anonymous users", () => expect(hasRole(null, ["LMO"])).toBe(false));
});
