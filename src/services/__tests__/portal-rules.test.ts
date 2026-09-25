import { describe, expect, it } from "vitest";
import { checkGeofence, distanceMeters, GEOFENCE_METERS } from "../../lib/geo";
import { integerTicks } from "../../lib/chart-scale";
import { nextWorkingDay, pickLeastLoaded, visitDate } from "../../lib/assignment-rules";
import { canManageUser, creatableRoles } from "../../lib/user-hierarchy";
import { requiredDocumentsFor } from "../../lib/required-documents";
import { tokenFromQr } from "../../lib/qr-token";
import { canEditLocation } from "../../lib/instrument-location";

const site = { lat: 28.6139, lng: 77.209 };

describe("1 km geofence", () => {
  it("measures great-circle distance", () => {
    expect(distanceMeters(site, site)).toBe(0);
    // 0.01° of latitude is about 1.11 km everywhere.
    expect(Math.round(distanceMeters(site, { lat: site.lat + 0.01, lng: site.lng }))).toBeGreaterThan(1100);
    expect(Math.round(distanceMeters(site, { lat: site.lat + 0.01, lng: site.lng }))).toBeLessThan(1120);
  });

  it("allows an officer within 1 km and blocks one beyond", () => {
    expect(checkGeofence(site, { lat: site.lat + 0.008, lng: site.lng })).toMatchObject({ ok: true });
    const far = checkGeofence(site, { lat: site.lat + 0.01, lng: site.lng });
    expect(far).toMatchObject({ ok: false, code: "OUTSIDE_GEOFENCE" });
    expect(far.distance).toBeGreaterThan(GEOFENCE_METERS);
  });

  it("requires an arrival fix and site coordinates", () => {
    expect(checkGeofence(site, null)).toMatchObject({ ok: false, code: "ARRIVAL_REQUIRED" });
    expect(checkGeofence({ lat: null, lng: null }, site)).toMatchObject({ ok: false, code: "SITE_LOCATION_MISSING" });
  });
});

describe("chart axis ticks", () => {
  it("never repeats a tick for small counts", () => {
    expect(integerTicks(0)).toEqual([0, 1]);
    expect(integerTicks(1)).toEqual([0, 1]);
    expect(integerTicks(3)).toEqual([0, 1, 2, 3]);
  });

  it("uses whole-number steps that cover the maximum", () => {
    for (const max of [5, 7, 13, 48, 99, 1234]) {
      const ticks = integerTicks(max);
      expect(new Set(ticks).size).toBe(ticks.length);
      expect(ticks.every(Number.isInteger)).toBe(true);
      expect(ticks[0]).toBe(0);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
      expect(ticks.length).toBeLessThanOrEqual(6);
    }
  });
});

describe("auto-assignment", () => {
  it("picks the officer with the fewest open tasks, breaking ties by name", () => {
    const officers = [
      { id: "a", name: "Pooja", openTasks: 3 },
      { id: "b", name: "Vikram", openTasks: 1 },
      { id: "c", name: "Arjun", openTasks: 1 },
    ];
    expect(pickLeastLoaded(officers)?.id).toBe("c");
    expect(pickLeastLoaded([])).toBeNull();
  });

  it("schedules on a working day", () => {
    const friday = new Date(2026, 8, 25, 15, 0);
    expect(nextWorkingDay(friday).getDay()).toBe(1);
    expect(nextWorkingDay(new Date(2026, 8, 22)).getDate()).toBe(23);
  });

  it("uses the applicant's preferred date only when it is a future working day", () => {
    const now = new Date(2026, 8, 21, 10, 0); // Monday
    expect(visitDate(new Date(2026, 8, 24), now).getDate()).toBe(24);
    expect(visitDate(new Date(2026, 8, 26), now).getDate()).toBe(22); // Saturday → next working day
    expect(visitDate(new Date(2026, 8, 20), now).getDate()).toBe(22); // past
    expect(visitDate(null, now).getDate()).toBe(22);
  });
});

describe("user hierarchy", () => {
  it("lets each admin create only the roles below it", () => {
    expect(creatableRoles("SUPER_ADMIN")).toEqual(["STATE_ADMIN", "GATC_ADMIN", "AUDITOR", "INSPECTOR"]);
    expect(creatableRoles("STATE_ADMIN")).toEqual(["LMO"]);
    expect(creatableRoles("GATC_ADMIN")).toEqual(["GATC_OFFICER"]);
    expect(creatableRoles("LMO")).toEqual([]);
  });

  it("limits state-level admins to their own state and officers", () => {
    const stateAdmin = { id: "s", role: "STATE_ADMIN" as const, stateId: "DL" };
    const gatcAdmin = { id: "g", role: "GATC_ADMIN" as const, stateId: "DL" };
    expect(canManageUser(stateAdmin, { id: "l", role: "LMO", stateId: "DL" })).toBe(true);
    expect(canManageUser(stateAdmin, { id: "l", role: "LMO", stateId: "MH" })).toBe(false);
    expect(canManageUser(stateAdmin, { id: "o", role: "GATC_OFFICER", stateId: "DL" })).toBe(false);
    expect(canManageUser(gatcAdmin, { id: "o", role: "GATC_OFFICER", stateId: "DL" })).toBe(true);
    expect(canManageUser(gatcAdmin, { id: "l", role: "LMO", stateId: "DL" })).toBe(false);
    expect(canManageUser({ id: "x", role: "SUPER_ADMIN" }, { id: "g", role: "GATC_ADMIN", stateId: "DL" })).toBe(true);
    expect(canManageUser(stateAdmin, stateAdmin)).toBe(false);
  });
});

describe("required documents", () => {
  const types = ["previous_certificate", "model_approval", "purchase_invoice"];
  it("drops the previous certificate for an initial verification", () => {
    expect(requiredDocumentsFor(types, "INITIAL_VERIFICATION")).toEqual(["model_approval", "purchase_invoice"]);
  });
  it("keeps it for re-verification", () => {
    expect(requiredDocumentsFor(types, "RE_VERIFICATION")).toEqual(types);
  });
});

describe("QR scanning", () => {
  const token = "AbCdEfGhIjKlMnOpQrStUvWx";
  it("accepts this portal's links and bare tokens", () => {
    expect(tokenFromQr(token, "portal.example")).toBe(token);
    expect(tokenFromQr(`https://portal.example/c/${token}`, "portal.example")).toBe(token);
    expect(tokenFromQr(`https://portal.example/hi/verify/${token}`, "portal.example")).toBe(token);
  });
  it("rejects links to other sites", () => {
    expect(tokenFromQr(`https://evil.example/c/${token}`, "portal.example")).toBeNull();
    expect(tokenFromQr(`javascript:alert(1)`, "portal.example")).toBeNull();
  });
});

describe("instrument location edits", () => {
  it("are allowed only while every open application is with the applicant", () => {
    expect(canEditLocation([])).toBe(true);
    expect(canEditLocation(["RETURNED"])).toBe(true);
    expect(canEditLocation(["ASSIGNED"])).toBe(false);
  });
});
