"use client";

import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/routing";
import { PAGE_SIZES } from "@/lib/list-params";

export function PageSizeSelect({ value, label }: { value: number; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-body-sm text-fg-subtle">
      <span className="hidden sm:inline">{label}</span>
      <select
        className="h-8 rounded-md border border-line-strong bg-surface px-2 text-body-sm text-fg"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(sp.toString());
          next.set("pageSize", e.target.value);
          next.delete("page");
          start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
        }}
      >
        {PAGE_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}
