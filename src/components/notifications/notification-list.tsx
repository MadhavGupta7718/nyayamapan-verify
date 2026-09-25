"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  unread: boolean;
  time: string;
  timeTitle: string;
};

export function MarkAllRead({ disabled }: { disabled: boolean }) {
  const t = useTranslations("notifications");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="secondary"
      loading={busy}
      disabled={disabled}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await api<{ data: { updated: number } }>("/api/notifications", { method: "PATCH", body: { all: true } });
          toast.success(t("markedAll", { count: r.data.updated }));
          router.refresh();
        } catch (e) {
          toast.error(errorMessage(e, te));
        } finally {
          setBusy(false);
        }
      }}
    >
      <CheckCheck /> {t("markAll")}
    </Button>
  );
}

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [read, setRead] = React.useState<Set<string>>(new Set());

  function open(n: NotificationItem) {
    if (n.unread && !read.has(n.id)) {
      setRead((s) => new Set(s).add(n.id));
      void api("/api/notifications", { method: "PATCH", body: { ids: [n.id] } })
        .then(() => router.refresh())
        .catch(() => undefined);
    }
    if (n.href) router.push(n.href);
  }

  return (
    <ul className="divide-y divide-line">
      {items.map((n) => {
        const unread = n.unread && !read.has(n.id);
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => open(n)}
              className={cn("flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-subtle", unread && "bg-brand-50/50")}
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-brand-600" : "bg-transparent")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className={cn("text-body-sm text-fg", unread && "font-semibold")}>{n.title}</span>
                  <span className="text-caption text-fg-faint">{t.has(`types.${n.type}`) ? t(`types.${n.type}`) : null}</span>
                </span>
                <span className="mt-0.5 block text-body-sm text-fg-muted">{n.body}</span>
              </span>
              <time className="shrink-0 whitespace-nowrap text-caption text-fg-subtle" title={n.timeTitle}>
                {n.time}
              </time>
              {unread ? <span className="sr-only">{t("unread")}</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
