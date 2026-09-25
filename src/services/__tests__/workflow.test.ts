import { describe, expect, it } from "vitest";
import { ALLOWED, availableActions, canTransition } from "../application-workflow";

describe("application workflow transitions", () => {
  it("follows the statutory happy path", () => {
    const path = [
      "DRAFT",
      "SUBMITTED",
      "DOCUMENT_REVIEW",
      "APPROVED",
      "SCHEDULED",
      "ASSIGNED",
      "FIELD_VERIFICATION",
      "INSPECTION_COMPLETED",
      "PASS",
      "STAMPING",
      "CERTIFICATE_GENERATED",
      "CERTIFICATE_ISSUED",
      "ACTIVE",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });

  it("never allows skipping inspection, stamping or approval", () => {
    expect(canTransition("DRAFT", "ACTIVE")).toBe(false);
    expect(canTransition("SUBMITTED", "APPROVED")).toBe(false);
    expect(canTransition("APPROVED", "FIELD_VERIFICATION")).toBe(false);
    expect(canTransition("INSPECTION_COMPLETED", "STAMPING")).toBe(false);
    expect(canTransition("PASS", "CERTIFICATE_ISSUED")).toBe(false);
    expect(canTransition("FAIL", "STAMPING")).toBe(false);
  });

  it("treats rejection as terminal", () => {
    expect(ALLOWED.REJECTED).toEqual([]);
  });

  it("allows only revocation after expiry", () => {
    expect(ALLOWED.EXPIRED).toEqual(["REVOKED"]);
    expect(canTransition("REVOKED", "ACTIVE")).toBe(false);
  });
});

describe("availableActions (role-bound)", () => {
  it("lets the owning business submit a draft", () => {
    expect(availableActions("DRAFT", "BUSINESS_USER", true)).toContain("submit");
  });

  it("blocks a business user from acting on another organisation's application", () => {
    expect(availableActions("DRAFT", "BUSINESS_USER", false)).toEqual([]);
  });

  it("does not let an administrator submit or cancel someone else's draft", () => {
    expect(availableActions("DRAFT", "SUPER_ADMIN", false)).toEqual([]);
    expect(availableActions("RETURNED", "STATE_ADMIN", false)).toEqual([]);
    expect(availableActions("DRAFT", "STATE_ADMIN", true)).toEqual(expect.arrayContaining(["submit", "cancel"]));
  });

  it("never lets a business user approve or reject", () => {
    const acts = availableActions("DOCUMENT_REVIEW", "BUSINESS_USER", true);
    expect(acts).not.toContain("approve");
    expect(acts).not.toContain("reject");
  });

  it("gives reviewers review actions only in review states", () => {
    expect(availableActions("SUBMITTED", "STATE_ADMIN", false)).toEqual(expect.arrayContaining(["startReview", "return", "reject"]));
    expect(availableActions("DOCUMENT_REVIEW", "STATE_ADMIN", false)).toContain("approve");
    expect(availableActions("APPROVED", "STATE_ADMIN", false)).toEqual([]);
  });

  it("gives field officers and auditors no application actions", () => {
    for (const role of ["LMO", "INSPECTOR", "GATC_OFFICER", "AUDITOR"] as const) {
      expect(availableActions("SUBMITTED", role, false)).toEqual([]);
      expect(availableActions("DOCUMENT_REVIEW", role, false)).toEqual([]);
    }
  });
});
