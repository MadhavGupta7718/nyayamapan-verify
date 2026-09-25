import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { PublicHeader } from "@/components/public/public-shell";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle">
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <ErrorState
          kind="notFound"
          code="404"
          title={t("notFound.title")}
          description={t("notFound.descPublic")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/" className={buttonVariants()}>
                {t("home")}
              </Link>
              <Link href="/verify" className={buttonVariants({ variant: "secondary" })}>
                {t("verifyCertificate")}
              </Link>
            </div>
          }
        />
      </main>
    </div>
  );
}
