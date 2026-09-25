import { describe, expect, it } from "vitest";
import { DEFAULT_REQUIRED_PHOTOS, missingEvidence, requiredPhotoCategories } from "../../lib/evidence";

describe("required field evidence", () => {
  it("falls back to a front photo when the instrument type lists none", () => {
    expect(requiredPhotoCategories(null)).toEqual(DEFAULT_REQUIRED_PHOTOS);
    expect(requiredPhotoCategories([])).toEqual(DEFAULT_REQUIRED_PHOTOS);
    expect(requiredPhotoCategories(["", 3])).toEqual(DEFAULT_REQUIRED_PHOTOS);
  });

  it("uses the instrument type's own categories when present", () => {
    expect(requiredPhotoCategories(["instrument_front", "seal"])).toEqual(["instrument_front", "seal"]);
  });

  it("reports nothing missing when arrival and every required photo are on record", () => {
    expect(missingEvidence(true, ["instrument_front", "seal"], ["seal", "instrument_front", "other"])).toEqual([]);
  });

  it("lists the missing arrival fix and each missing photo category", () => {
    expect(missingEvidence(false, ["instrument_front", "seal"], ["seal"])).toEqual(["arrival", "photo:instrument_front"]);
  });
});
