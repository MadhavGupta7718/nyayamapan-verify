"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  React.useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorState
      kind={offline ? "network" : "server"}
      code={error.digest ? `ref ${error.digest}` : "500"}
      title={offline ? t("network.title") : t("server.title")}
      description={offline ? t("network.desc") : t("server.desc")}
      action={
        <Button onClick={reset}>
          <RotateCcw /> {t("retry")}
        </Button>
      }
    />
  );
}
