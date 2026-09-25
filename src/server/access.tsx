import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { canAccessModule, type ModuleKey } from "@/lib/permissions";
import { getSessionUser } from "@/server/session";
import type { SessionUser } from "@/server/rbac";

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }
  return user;
}

export async function Forbidden() {
  const t = await getTranslations("errors");
  return (
    <ErrorState
      kind="forbidden"
      code="403"
      title={t("forbidden.title")}
      description={t("forbidden.desc")}
      action={
        <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
          {t("backToOverview")}
        </Link>
      }
    />
  );
}

/**
 * Page-level RBAC. Returns the user when allowed; otherwise a rendered 403 state the page returns.
 * APIs enforce the same rules independently — hiding navigation is never the only control.
 */
export async function guard(module: ModuleKey): Promise<{ user: SessionUser; denied: null } | { user: null; denied: React.ReactElement }> {
  const user = await requireUser();
  if (!canAccessModule(user.role, module)) {
    return { user: null, denied: await Forbidden() };
  }
  return { user, denied: null };
}
