export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: unknown
  ) {
    super(code);
  }
}

/** JSON fetch for mutations. Normalises network failures, timeouts and API error bodies into ApiError. */
export async function api<T = unknown>(
  url: string,
  opts: { method?: string; body?: unknown; form?: FormData; timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("timeout"), opts.timeoutMs ?? 20_000);
  opts.signal?.addEventListener("abort", () => ctrl.abort());
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
      headers: opts.form ? undefined : { "Content-Type": "application/json" },
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: ctrl.signal,
      credentials: "same-origin",
    });
  } catch {
    clearTimeout(timer);
    if (ctrl.signal.reason === "timeout") throw new ApiError(0, "TIMEOUT");
    throw new ApiError(0, typeof navigator !== "undefined" && !navigator.onLine ? "OFFLINE" : "NETWORK");
  }
  clearTimeout(timer);
  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const code = (data && (data.code || data.error)) || (res.status === 401 ? "UNAUTHORIZED" : res.status === 403 ? "FORBIDDEN" : res.status === 404 ? "NOT_FOUND" : "SERVER_ERROR");
    throw new ApiError(res.status, String(code), data);
  }
  return data as T;
}

/** Resolves a translated message for an API error code, falling back to a generic message. */
export function errorMessage(err: unknown, t: { (key: string): string; has: (key: string) => boolean }) {
  const code = err instanceof ApiError ? err.code : "SERVER_ERROR";
  return t.has(code) ? t(code) : t("SERVER_ERROR");
}
