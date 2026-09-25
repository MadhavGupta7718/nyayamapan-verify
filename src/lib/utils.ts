import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display", "h1", "h2", "h3", "h4", "body", "body-sm", "caption", "label", "data", "overline"] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function toDate(d: Date | string) {
  return typeof d === "string" ? new Date(d) : d;
}

function intlLocale(locale: string) {
  return locale === "hi" ? "hi-IN" : "en-IN";
}

export function formatDate(d: Date | string | null | undefined, locale = "en") {
  if (!d) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(toDate(d));
}

export function formatDateTime(d: Date | string | null | undefined, locale = "en") {
  if (!d) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(toDate(d));
}

export function formatNumber(n: number, locale = "en") {
  return new Intl.NumberFormat(intlLocale(locale)).format(n);
}

export function formatRelative(d: Date | string | null | undefined, locale = "en", now = new Date()) {
  if (!d) return "—";
  const date = toDate(d);
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
  return rtf.format(Math.round(diffSec / (86400 * 365)), "year");
}

export function daysUntil(d: Date | string | null | undefined, now = new Date()) {
  if (!d) return null;
  return Math.ceil((toDate(d).getTime() - now.getTime()) / 86400000);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
