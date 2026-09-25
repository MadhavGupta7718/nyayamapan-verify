/** Photo categories used when an instrument type doesn't list any of its own. */
export const DEFAULT_REQUIRED_PHOTOS = ["instrument_front"];

/** Category of the proof photo taken when the officer can't find the instrument site; only the dismissal route stores it. */
export const LOCATION_NOT_FOUND_CATEGORY = "location_not_found";

/** Minimum length of the officer's explanation when dismissing a visit because the site couldn't be found. */
export const DISMISS_REASON_MIN = 20;

export function requiredPhotoCategories(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string" && c.length > 0) : [];
  return list.length ? list : DEFAULT_REQUIRED_PHOTOS;
}

/** Required photo categories not yet captured. A result can't be recorded until this is empty. */
export function missingPhotos(required: string[], captured: Iterable<string>): string[] {
  const have = new Set(captured);
  return required.filter((c) => !have.has(c));
}
