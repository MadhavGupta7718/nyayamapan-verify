import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { buildHref } from "@/lib/list-params";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  /** Hidden below this breakpoint to keep mobile tables readable. */
  minBreakpoint?: "sm" | "md" | "lg" | "xl";
};

const BP: Record<NonNullable<Column<unknown>["minBreakpoint"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

/**
 * Server-rendered data table. Sorting and pagination are URL-driven so the server only ever
 * returns one page; rows can link to a detail page via a stretched link on the first cell.
 */
export function DataTable<T>({
  id,
  columns,
  rows,
  rowKey,
  rowHref,
  path,
  params,
  sort,
  dir,
  empty,
  caption,
}: {
  id: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  path: string;
  params: Record<string, string>;
  sort?: string;
  dir?: "asc" | "desc";
  empty?: React.ReactNode;
  caption: string;
}) {
  return (
    <div id={id} className="relative overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
      <div className="relative max-h-[calc(100vh-15rem)] overflow-auto scrollbar-thin">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-body-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort === c.key;
                const nextDir = active && dir === "asc" ? "desc" : "asc";
                const SortIcon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    data-col={c.key}
                    scope="col"
                    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "sticky top-0 z-10 whitespace-nowrap border-b border-line bg-surface-subtle/95 px-4 py-2.5 text-caption font-semibold uppercase tracking-wide text-fg-subtle backdrop-blur",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.minBreakpoint && BP[c.minBreakpoint],
                      c.className
                    )}
                  >
                    {c.sortable ? (
                      <Link
                        href={buildHref(path, params, { sort: c.key, dir: nextDir, page: undefined })}
                        scroll={false}
                        prefetch={false}
                        className={cn(
                          "-mx-1 inline-flex items-center gap-1 rounded px-1 transition-colors hover:text-fg",
                          active && "text-fg"
                        )}
                      >
                        {c.header}
                        <SortIcon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
                      </Link>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <tr key={rowKey(row)} className={cn("group relative transition-colors", href && "hover:bg-brand-50/40")}>
                  {columns.map((c, ci) => (
                    <td
                      key={c.key}
                      data-col={c.key}
                      className={cn(
                        "border-b border-line px-4 py-3 align-middle text-fg group-last:border-b-0",
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                        c.minBreakpoint && BP[c.minBreakpoint],
                        c.className
                      )}
                    >
                      {ci === 0 && href ? (
                        <Link href={href} className="font-medium text-fg outline-none after:absolute after:inset-0 after:content-[''] hover:text-brand-800 focus-visible:underline">
                          {c.cell(row)}
                        </Link>
                      ) : (
                        <div className={cn(href && "relative z-[1] w-fit", c.align === "right" && "ml-auto")}>{c.cell(row)}</div>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <div className="border-t border-line">{empty}</div> : null}
      </div>
    </div>
  );
}
