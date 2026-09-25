import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/db/client";
import { Forbidden, requireUser } from "@/server/access";
import { PageHeader } from "@/components/ui/page-header";
import { InstrumentForm } from "@/components/instruments/instrument-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("instrumentForm"))("title") };
}

export default async function NewInstrumentPage() {
  const user = await requireUser();
  if (!["BUSINESS_USER", "SUPER_ADMIN", "STATE_ADMIN"].includes(user.role)) return Forbidden();
  const [t, locale] = await Promise.all([getTranslations("instrumentForm"), getLocale()]);
  const [types, states, orgs] = await Promise.all([
    prisma.instrumentType.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, nameHi: true, category: true } }),
    prisma.state.findMany({
      where: user.role === "STATE_ADMIN" ? { id: user.stateId ?? "__none__" } : {},
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameHi: true, districts: { orderBy: { name: "asc" }, select: { id: true, name: true, nameHi: true } } },
    }),
    user.role === "BUSINESS_USER"
      ? Promise.resolve([])
      : prisma.organization.findMany({
          where: { deletedAt: null, ...(user.role === "STATE_ADMIN" ? { stateId: user.stateId ?? "__none__" } : {}) },
          orderBy: { name: "asc" },
          take: 500,
          select: { id: true, name: true },
        }),
  ]);
  const own = user.organizationId
    ? await prisma.organization.findUnique({ where: { id: user.organizationId }, select: { stateId: true, districtId: true, address: true } })
    : null;
  const tn = (x: { name: string; nameHi: string | null }) => (locale === "hi" && x.nameHi ? x.nameHi : x.name);

  return (
    <>
      <PageHeader title={t("title")} description={t("desc")} />
      <InstrumentForm
        types={types.map((x) => ({ id: x.id, label: tn(x) }))}
        states={states.map((s) => ({ id: s.id, label: tn(s), districts: s.districts.map((d) => ({ id: d.id, label: tn(d) })) }))}
        organizations={orgs.map((o) => ({ id: o.id, label: o.name }))}
        defaults={{ stateId: own?.stateId ?? user.stateId ?? "", districtId: own?.districtId ?? "", address: own?.address ?? "" }}
      />
    </>
  );
}
