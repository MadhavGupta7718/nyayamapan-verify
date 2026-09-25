import { describe, expect, it } from "vitest";
import { DEFAULT_REQUIRED_PHOTOS, missingPhotos, requiredPhotoCategories } from "../../lib/evidence";

describe("required field evidence", () => {
  it("falls back to a front photo when the instrument type lists none", () => {
    expect(requiredPhotoCategories(null)).toEqual(DEFAULT_REQUIRED_PHOTOS);
    expect(requiredPhotoCategories([])).toEqual(DEFAULT_REQUIRED_PHOTOS);
    expect(requiredPhotoCategories(["", 3])).toEqual(DEFAULT_REQUIRED_PHOTOS);
  });

  it("uses the instrument type's own categories when present", () => {
    expect(requiredPhotoCategories(["instrument_front", "seal"])).toEqual(["instrument_front", "seal"]);
  });

  it("reports nothing missing when every required photo is on record", () => {
    expect(missingPhotos(["instrument_front", "seal"], ["seal", "instrument_front", "other"])).toEqual([]);
  });

  it("lists each missing photo category", () => {
    expect(missingPhotos(["instrument_front", "seal"], ["seal"])).toEqual(["instrument_front"]);
  });
});
