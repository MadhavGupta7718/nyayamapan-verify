export type RawSearchParams = Record<string, string | string[] | undefined>;

export type ListParams = {
  page: number;
  pageSize: number;
  q: string;
  sort: string;
  dir: "asc" | "desc";
  raw: Record<string, string>;
  get: (key: string) => string | undefined;
};

export const PAGE_SIZES = [10, 20, 50, 100];

export function parseListParams(
  sp: RawSearchParams,
  opts: { defaultSort: string; defaultDir?: "asc" | "desc"; sortable: string[]; defaultPageSize?: number }
): ListParams {
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val != null && val !== "") raw[k] = val;
  }
  const page = Math.max(1, Math.min(10_000, Number.parseInt(raw.page ?? "1", 10) || 1));
  const sizeCandidate = Number.parseInt(raw.pageSize ?? "", 10);
  const pageSize = PAGE_SIZES.includes(sizeCandidate) ? sizeCandidate : opts.defaultPageSize ?? 20;
  const sort = raw.sort && opts.sortable.includes(raw.sort) ? raw.sort : opts.defaultSort;
  const dir = raw.dir === "asc" || raw.dir === "desc" ? raw.dir : opts.defaultDir ?? "desc";
  const q = (raw.q ?? "").trim().slice(0, 100);
  return { page, pageSize, q, sort, dir, raw, get: (key) => raw[key] };
}

export function buildHref(path: string, params: Record<string, string | undefined>, patch: Record<string, string | undefined | null>) {
  const next = new URLSearchParams();
  const merged = { ...params, ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== "") next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}

export function pageMeta(total: number, page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  return {
    total,
    page: safePage,
    pageSize,
    pageCount,
    from: total === 0 ? 0 : (safePage - 1) * pageSize + 1,
    to: Math.min(total, safePage * pageSize),
    skip: (safePage - 1) * pageSize,
  };
}
