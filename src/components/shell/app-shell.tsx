import { getTranslations } from "next-intl/server";
import type { SessionUser } from "@/server/rbac";
import { isFieldRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { MobileFieldNav } from "./mobile-field-nav";
import { SessionGuard } from "./session-guard";

export async function AppShell({
  user,
  unread,
  children,
}: {
  user: SessionUser;
  unread: number;
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  const field = isFieldRole(user.role);
  return (
    <div className="min-h-screen lg:pl-sidebar">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-brand-800 focus:px-4 focus:py-2 focus:text-white"
      >
        {t("common.skipToContent")}
      </a>
      <Sidebar role={user.role} unread={unread} brand={t("brand")} tagline={t("brandTagline")} />
      <div className="flex min-h-screen min-w-0 flex-col">
        <TopBar
          user={{ name: user.name, email: user.email, role: user.role }}
          unread={unread}
          brand={t("brand")}
          tagline={t("brandTagline")}
        />
        <main id="main" className={cn("mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8", field ? "pb-[calc(9rem+env(safe-area-inset-bottom))] lg:pb-8" : "pb-12")}>
          {children}
        </main>
      </div>
      {field ? <MobileFieldNav /> : null}
      <SessionGuard />
    </div>
  );
}
