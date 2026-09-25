/** Documents that only exist once an instrument has been verified before, so they can't be demanded on a first verification. */
const REVERIFICATION_ONLY = new Set(["previous_certificate"]);

/** Required document types for an application, from the instrument type master adjusted for the verification type. */
export function requiredDocumentsFor(types: unknown, verificationType: string): string[] {
  const list = Array.isArray(types) ? types.filter((x): x is string => typeof x === "string") : [];
  return verificationType === "INITIAL_VERIFICATION" ? list.filter((d) => !REVERIFICATION_ONLY.has(d)) : list;
}
