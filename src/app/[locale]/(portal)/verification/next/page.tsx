import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { prisma } from "@/db/client";
import { guard } from "@/server/access";
import { applicationScope } from "@/server/scope";

/** Opens the officer's current work: an inspection in progress first, otherwise the next scheduled visit. */
export default async function NextVerificationPage() {
  const { user, denied } = await guard("verification");
  if (denied) return denied;
  const locale = await getLocale();
  const scope = applicationScope(user);
  const inProgress = await prisma.application.findFirst({
    where: { AND: [scope, { status: { in: ["FIELD_VERIFICATION", "PASS", "STAMPING"] } }] },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  const nextVisit = inProgress
    ? null
    : await prisma.verificationSchedule.findFirst({
        where: { status: "SCHEDULED", application: { AND: [scope, { status: "ASSIGNED" }] } },
        orderBy: { scheduledDate: "asc" },
        select: { applicationId: true },
      });
  const id = inProgress?.id ?? nextVisit?.applicationId;
  redirect(id ? `/${locale}/verification/${id}` : `/${locale}/verification`);
}
