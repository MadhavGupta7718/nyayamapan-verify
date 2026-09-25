import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default async function PortalNotFound() {
  const t = await getTranslations("errors");
  return (
    <ErrorState
      kind="notFound"
      code="404"
      title={t("notFound.title")}
      description={t("notFound.desc")}
      action={
        <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
          {t("backToOverview")}
        </Link>
      }
    />
  );
}
