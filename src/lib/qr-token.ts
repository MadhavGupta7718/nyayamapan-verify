const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const PATH_RE = /^\/(?:(?:en|hi)\/verify|c)\/([A-Za-z0-9_-]{16,64})\/?$/;

/**
 * Extracts a certificate token from scanned QR text. Only this portal's own `/c/<token>` or
 * `/<locale>/verify/<token>` links (same host) or a bare token are accepted, so a QR code
 * can never redirect the user to another site.
 */
export function tokenFromQr(text: string, host: string): string | null {
  const raw = text.trim();
  if (TOKEN_RE.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.host !== host) return null;
  return url.pathname.match(PATH_RE)?.[1] ?? null;
}
