"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, FileText } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { FileUploader } from "@/components/ui/file-uploader";
import { StatusBadge } from "@/components/ui/status-badge";

export type DocRow = {
  id: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  status: string;
  storageKey: string;
  createdAt: string;
};

function size(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Required documents with their latest version, and per-type upload when the application is editable. */
export function DocumentPanel({
  applicationId,
  required,
  documents,
  editable,
}: {
  applicationId: string;
  required: string[];
  documents: DocRow[];
  editable: boolean;
}) {
  const t = useTranslations("documents");
  const router = useRouter();
  const current = documents.filter((d) => d.status !== "SUPERSEDED");
  const types = [...new Set([...required, ...current.map((d) => d.documentType)])];
  const label = (k: string) => (t.has(`types.${k}`) ? t(`types.${k}`) : k.replaceAll("_", " "));

  return (
    <ul className="divide-y divide-line">
      {types.map((type) => {
        const doc = current.find((d) => d.documentType === type);
        const isRequired = required.includes(type);
        const viewable = doc && !doc.storageKey.startsWith("applications/seed/");
        return (
          <li key={type} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {viewable && doc.mimeType.startsWith("image/") ? (
                <a href={`/api/storage/${doc.storageKey}`} target="_blank" rel="noreferrer" className="block size-12 shrink-0 overflow-hidden rounded-md border border-line bg-surface-sunken">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private files behind the RBAC route, not optimisable by next/image */}
                  <img src={`/api/storage/${doc.storageKey}`} alt={label(type)} loading="lazy" className="size-full object-cover" />
                </a>
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-sunken text-fg-subtle">
                  <FileText className="size-4" aria-hidden />
                </span>
              )}
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-body-sm font-medium text-fg">
                  {label(type)}
                  {isRequired ? <span className="text-caption font-normal text-fg-subtle">· {t("required")}</span> : null}
                </p>
                <p className="truncate text-caption text-fg-subtle">
                  {doc ? `${doc.fileName} · ${size(doc.sizeBytes)} · v${doc.version}` : t("missing")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {doc ? (
                <StatusBadge status={doc.status === "UPLOADED" ? "SUBMITTED" : doc.status} withTooltip={false} />
              ) : isRequired ? (
                <StatusBadge status="PENDING" withTooltip={false} />
              ) : null}
              {viewable ? (
                <a
                  href={`/api/storage/${doc.storageKey}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-body-sm font-medium text-brand-700 hover:text-brand-900"
                >
                  {t("view")} <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
            </div>
            {editable ? (
              <div className="sm:w-64">
                <FileUploader
                  compact
                  url="/api/documents/upload"
                  fields={{ applicationId, documentType: type }}
                  label={doc ? t("replace") : t("upload")}
                  hint={t("formats")}
                  onUploaded={() => router.refresh()}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
