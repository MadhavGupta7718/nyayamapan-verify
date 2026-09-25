import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { MapPinned } from "lucide-react";
import { prisma } from "@/db/client";
import { guard } from "@/server/access";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { GeoAddButton, GeoRowMenu } from "@/components/geography/geo-admin";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("geography") };
}

export default async function GeographyPage({ searchParams }: { searchParams: Promise<{ state?: string; q?: string }> }) {
  const { denied } = await guard("geography");
  if (denied) return denied;
  const [t, locale, sp] = await Promise.all([getTranslations("geography"), getLocale(), searchParams]);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const label = (x: { name: string; nameHi: string | null }) => (locale === "hi" && x.nameHi ? x.nameHi : x.name);

  const states = await prisma.state.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      nameHi: true,
      isActive: true,
      _count: { select: { districts: true, users: true, instruments: true } },
    },
  });
  const selected = states.find((s) => s.id === sp.state) ?? states[0] ?? null;
  const districts = selected
    ? await prisma.district.findMany({
        where: {
          stateId: selected.id,
          ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          nameHi: true,
          isActive: true,
          _count: { select: { instruments: true, officers: true } },
        },
      })
    : [];
  const activeStates = states.filter((s) => s.isActive).length;
  const totalDistricts = states.reduce((n, s) => n + s._count.districts, 0);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("desc", {
          states: activeStates,
          districts: totalDistricts,
        })}
        actions={<GeoAddButton kind="state" />}
      />
      <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader title={t("states")} description={t("statesHint")} />
          <nav aria-label={t("states")} className="max-h-[24rem] overflow-y-auto scrollbar-thin lg:max-h-[calc(100vh-16rem)]">
            <ul className="divide-y divide-line">
              {states.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/geography?state=${s.id}`}
                    aria-current={selected?.id === s.id ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between gap-3 px-5 py-2.5 text-body-sm transition-colors hover:bg-surface-subtle",
                      selected?.id === s.id && "bg-brand-50 font-medium text-brand-900",
                    )}
                  >
                    <span className="min-w-0">
                      <span className={cn("block truncate", !s.isActive && "text-fg-subtle line-through")}>{label(s)}</span>
                      <span className="block text-caption text-fg-subtle">
                        {s.code} · {t("districtCount", { count: s._count.districts })}
                      </span>
                    </span>
                    {!s.isActive ? <Badge tone="neutral">{t("inactive")}</Badge> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Card>

        {selected ? (
          <Card className="min-w-0">
            <CardHeader
              icon={<MapPinned />}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {label(selected)} <span className="font-mono text-caption text-fg-subtle">{selected.code}</span>
                  {!selected.isActive ? <Badge tone="neutral">{t("inactive")}</Badge> : null}
                </span>
              }
              description={t("stateStats", {
                users: selected._count.users,
                instruments: selected._count.instruments,
              })}
              action={
                <span className="flex items-center gap-1">
                  <GeoAddButton kind="district" stateId={selected.id} />
                  <GeoRowMenu
                    kind="state"
                    entry={{
                      id: selected.id,
                      code: selected.code,
                      name: selected.name,
                      nameHi: selected.nameHi,
                      isActive: selected.isActive,
                    }}
                  />
                </span>
              }
            />
            <form className="border-b border-line px-5 py-3" action="" method="get">
              <input type="hidden" name="state" value={selected.id} />
              <label htmlFor="geo-q" className="sr-only">
                {t("searchDistricts")}
              </label>
              <input
                id="geo-q"
                name="q"
                defaultValue={q}
                placeholder={t("searchDistricts")}
                className="h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-body-sm text-fg placeholder:text-fg-faint focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 sm:max-w-xs"
              />
            </form>
            {districts.length ? (
              <ul className="divide-y divide-line">
                {districts.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="min-w-0">
                      <span className={cn("block truncate text-body-sm text-fg", !d.isActive && "text-fg-subtle line-through")}>
                        {d.name}
                        {d.nameHi ? <span className="ml-2 text-fg-subtle">{d.nameHi}</span> : null}
                      </span>
                      <span className="block text-caption text-fg-subtle">
                        {t("districtStats", {
                          instruments: d._count.instruments,
                          officers: d._count.officers,
                        })}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {!d.isActive ? <Badge tone="neutral">{t("inactive")}</Badge> : null}
                      <GeoRowMenu
                        kind="district"
                        entry={{
                          id: d.id,
                          name: d.name,
                          nameHi: d.nameHi,
                          isActive: d.isActive,
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={MapPinned} title={t(q ? "noMatch" : "noDistricts")} description={t("noDistrictsDesc")} />
            )}
          </Card>
        ) : (
          <EmptyState icon={MapPinned} title={t("noStates")} description={t("noStatesDesc")} />
        )}
      </div>
    </>
  );
}
