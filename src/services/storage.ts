import { put, del } from "@vercel/blob";
import { createHash } from "crypto";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";

const LOCAL_DIR = path.join(process.cwd(), ".local-storage");

export async function checksumBuffer(buf: Buffer) {
  return createHash("sha256").update(buf).digest("hex");
}

/** Detects the real file type from magic bytes; the client-declared MIME type is never trusted. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export function safeKey(key: string) {
  const normalized = path.posix.normalize(key.replace(/\\/g, "/")).replace(/^(\.\.(\/|$))+/, "");
  return normalized.replace(/[^a-zA-Z0-9._/-]/g, "_");
}

export async function storeFile(opts: { key: string; data: Buffer; contentType: string }) {
  const key = safeKey(opts.key);
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, opts.data, {
      access: "public",
      contentType: opts.contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true,
    });
    return { url: blob.url, key: blob.pathname, provider: "vercel-blob" as const };
  }
  const full = path.join(LOCAL_DIR, key);
  if (!full.startsWith(LOCAL_DIR)) throw new Error("Invalid storage key");
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, opts.data);
  return { url: `/api/storage/${key}`, key, provider: "local" as const };
}

export async function readLocalFile(key: string) {
  const full = path.join(LOCAL_DIR, safeKey(key));
  if (!full.startsWith(LOCAL_DIR)) throw new Error("Invalid storage key");
  return readFile(full);
}

/** Public hostname of the connected Blob store, derived from BLOB_STORE_ID or the read-write token. */
function blobHost() {
  const fromId = process.env.BLOB_STORE_ID?.replace(/^store_/, "");
  const fromToken = process.env.BLOB_READ_WRITE_TOKEN?.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/)?.[1];
  const id = (fromId || fromToken)?.toLowerCase();
  return id ? `https://${id}.public.blob.vercel-storage.com` : null;
}

function isBlobUrl(url: string) {
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/**
 * Reads a stored file for the authorised download route. Blob uploads are fetched server-side
 * (records created before `storageUrl` existed are resolved from the store hostname); anything
 * else comes from local storage.
 */
export async function readStoredFile(key: string, storageUrl?: string | null): Promise<Buffer> {
  const url = storageUrl && isBlobUrl(storageUrl) ? storageUrl : process.env.BLOB_READ_WRITE_TOKEN && blobHost() ? `${blobHost()}/${safeKey(key)}` : null;
  if (url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return readLocalFile(key);
}

export async function deleteFile(key: string, url?: string) {
  if (process.env.BLOB_READ_WRITE_TOKEN && url) {
    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return;
  }
  try {
    await unlink(path.join(LOCAL_DIR, safeKey(key)));
  } catch {
    /* already removed */
  }
}

export const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
