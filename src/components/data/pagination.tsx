import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { cn, formatNumber } from "@/lib/utils";
import { buildHref } from "@/lib/list-params";
import { PageSizeSelect } from "./page-size-select";

function pageWindow(page: number, count: number) {
  const pages = new Set<number>([1, count, page, page - 1, page + 1]);
  return [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
}

export async function Pagination({
  path,
  params,
  meta,
  locale,
}: {
  path: string;
  params: Record<string, string>;
  meta: { total: number; page: number; pageSize: number; pageCount: number; from: number; to: number };
  locale: string;
}) {
  const t = await getTranslations("table");
  const pages = pageWindow(meta.page, meta.pageCount);
  const linkCls =
    "grid h-8 min-w-8 place-items-center rounded-md px-2 text-body-sm font-medium tabular transition-colors";
  return (
    <nav aria-label={t("pagination")} className="mt-3 flex flex-col-reverse items-center justify-between gap-3 sm:flex-row">
      <p className="text-body-sm text-fg-subtle">
        {t("showing", {
          from: formatNumber(meta.from, locale),
          to: formatNumber(meta.to, locale),
          total: formatNumber(meta.total, locale),
        })}
      </p>
      <div className="flex items-center gap-3">
        <PageSizeSelect value={meta.pageSize} label={t("rowsPerPage")} />
        <div className="flex items-center gap-1">
          {meta.page > 1 ? (
            <Link href={buildHref(path, params, { page: String(meta.page - 1) })} scroll={false} className={cn(linkCls, "text-fg-muted hover:bg-ink-100")} aria-label={t("previous")}>
              <ChevronLeft className="size-4" />
            </Link>
          ) : (
            <span className={cn(linkCls, "text-fg-faint")} aria-hidden>
              <ChevronLeft className="size-4" />
            </span>
          )}
          {pages.map((p, i) => (
            <span key={p} className="flex items-center">
              {i > 0 && p - pages[i - 1] > 1 ? <span className="px-1 text-fg-faint">…</span> : null}
              <Link
                href={buildHref(path, params, { page: String(p) })}
                scroll={false}
                aria-current={p === meta.page ? "page" : undefined}
                className={cn(linkCls, p === meta.page ? "bg-brand-800 text-white" : "text-fg-muted hover:bg-ink-100")}
              >
                {p}
              </Link>
            </span>
          ))}
          {meta.page < meta.pageCount ? (
            <Link href={buildHref(path, params, { page: String(meta.page + 1) })} scroll={false} className={cn(linkCls, "text-fg-muted hover:bg-ink-100")} aria-label={t("next")}>
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span className={cn(linkCls, "text-fg-faint")} aria-hidden>
              <ChevronRight className="size-4" />
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}
