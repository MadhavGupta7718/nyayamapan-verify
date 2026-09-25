import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, "PASSWORD_TOO_SHORT")
  .max(128)
  .regex(/[a-z]/, "PASSWORD_NEEDS_LOWER")
  .regex(/[A-Z]/, "PASSWORD_NEEDS_UPPER")
  .regex(/\d/, "PASSWORD_NEEDS_DIGIT");

export function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;
