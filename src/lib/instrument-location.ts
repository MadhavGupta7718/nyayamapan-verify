export const OPEN_APPLICATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "DOCUMENT_REVIEW",
  "APPROVED",
  "RETURNED",
  "SCHEDULED",
  "ASSIGNED",
  "FIELD_VERIFICATION",
  "INSPECTION_COMPLETED",
  "PASS",
  "STAMPING",
  "CERTIFICATE_GENERATED",
  "CERTIFICATE_ISSUED",
] as const;

/** The applicant may move an instrument only while every open application for it is still with them. */
export const LOCATION_EDITABLE_STATUSES: string[] = ["DRAFT", "RETURNED"];

export function canEditLocation(openStatuses: string[]) {
  return openStatuses.every((s) => LOCATION_EDITABLE_STATUSES.includes(s));
}
