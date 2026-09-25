/** Photo categories used when an instrument type doesn't list any of its own. */
export const DEFAULT_REQUIRED_PHOTOS = ["instrument_front"];

/** Minimum length of the officer's reason for recording a result without the required evidence. */
export const EVIDENCE_REASON_MIN = 10;

export function requiredPhotoCategories(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string" && c.length > 0) : [];
  return list.length ? list : DEFAULT_REQUIRED_PHOTOS;
}

/** Evidence still missing before a result can be recorded without an exception: "arrival" and/or "photo:<category>". */
export function missingEvidence(hasArrival: boolean, required: string[], captured: Iterable<string>): string[] {
  const have = new Set(captured);
  return [...(hasArrival ? [] : ["arrival"]), ...required.filter((c) => !have.has(c)).map((c) => `photo:${c}`)];
}
