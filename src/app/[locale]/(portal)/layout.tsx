import { prisma } from "@/db/client";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/server/access";

/**
 * Persistent authenticated shell. Rendered once per session: navigating between portal pages
 * only swaps the page segment, so the sidebar and top bar never remount or refetch.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
  return (
    <AppShell user={user} unread={unread}>
      {children}
    </AppShell>
  );
}
