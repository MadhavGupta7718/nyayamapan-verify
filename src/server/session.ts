import { cache } from "react";
import { auth } from "@/server/auth";
import { prisma } from "@/db/client";
import type { SessionUser } from "@/server/rbac";

/**
 * Memoised per request so layout, page and nested server components share one session read.
 * The JWT only proves identity; role, jurisdiction and account status are re-read from the
 * database so suspensions and role changes take effect immediately rather than at token expiry.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const u = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, organizationId: true, stateId: true, status: true, deletedAt: true },
  });
  if (!u || u.status !== "ACTIVE" || u.deletedAt) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    organizationId: u.organizationId,
    stateId: u.stateId,
  };
});
