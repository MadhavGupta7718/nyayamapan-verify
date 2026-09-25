"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, FileUp, Loader2, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number; name: string }
  | { phase: "done"; name: string }
  | { phase: "error"; message: string };

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Drag-and-drop uploader with real progress (XHR), client-side type/size pre-checks and a
 * retry path. The server re-validates everything (magic-byte sniffing, size, scan).
 */
export function FileUploader({
  url,
  fields,
  accept = "application/pdf,image/jpeg,image/png,image/webp",
  label,
  hint,
  onUploaded,
  compact,
  capture,
  disabled,
}: {
  url: string;
  fields: Record<string, string>;
  accept?: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  onUploaded?: (response: unknown) => void;
  compact?: boolean;
  capture?: "environment" | "user";
  disabled?: boolean;
}) {
  const t = useTranslations("upload");
  const te = useTranslations("apiErrors");
  const input = React.useRef<HTMLInputElement>(null);
  const [state, setState] = React.useState<UploadState>({ phase: "idle" });
  const [drag, setDrag] = React.useState(false);
  const xhrRef = React.useRef<XMLHttpRequest | null>(null);

  function send(file: File) {
    const allowed = accept.split(",").map((s) => s.trim());
    if (!allowed.includes(file.type)) return setState({ phase: "error", message: t("wrongType") });
    if (file.size > MAX_BYTES) return setState({ phase: "error", message: t("tooLarge", { size: "8 MB" }) });

    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setState({ phase: "uploading", progress: Math.round((e.loaded / e.total) * 100), name: file.name });
    };
    xhr.onload = () => {
      let body: { error?: string } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        setState({ phase: "done", name: file.name });
        onUploaded?.(body);
      } else {
        const code = body?.error ?? "SERVER_ERROR";
        setState({ phase: "error", message: te.has(code) ? te(code) : te("SERVER_ERROR") });
      }
    };
    xhr.onerror = () => setState({ phase: "error", message: te(navigator.onLine ? "NETWORK" : "OFFLINE") });
    xhr.onabort = () => setState({ phase: "idle" });
    setState({ phase: "uploading", progress: 0, name: file.name });
    xhr.send(form);
  }

  function onFiles(files: FileList | null) {
    const f = files?.[0];
    if (f) send(f);
    if (input.current) input.current.value = "";
  }

  const busy = state.phase === "uploading";
  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || busy}
        onClick={() => !disabled && !busy && input.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled && !busy) {
            e.preventDefault();
            input.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!disabled && !busy) onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group relative flex cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-surface transition-colors",
          compact ? "px-3 py-2.5" : "flex-col justify-center px-4 py-6 text-center",
          drag ? "border-brand-500 bg-brand-50" : "border-line-strong hover:border-brand-400 hover:bg-surface-subtle",
          (disabled || busy) && "cursor-not-allowed opacity-70",
          state.phase === "error" && "border-danger-300 bg-danger-50/50"
        )}
      >
        <input
          ref={input}
          type="file"
          accept={accept}
          capture={capture}
          className="sr-only"
          onChange={(e) => onFiles(e.target.files)}
          disabled={disabled || busy}
          tabIndex={-1}
          aria-hidden
        />
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-md",
            state.phase === "done" ? "bg-success-50 text-success-700" : state.phase === "error" ? "bg-danger-100 text-danger-700" : "bg-brand-50 text-brand-700"
          )}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : state.phase === "done" ? (
            <CheckCircle2 className="size-4" />
          ) : state.phase === "error" ? (
            <TriangleAlert className="size-4" />
          ) : (
            <FileUp className="size-4" />
          )}
        </span>
        <span className={cn("min-w-0", compact ? "flex-1 text-left" : "")}>
          <span className="block truncate text-body-sm font-medium text-fg">
            {busy ? state.name : state.phase === "done" ? t("uploaded", { name: state.name }) : label}
          </span>
          <span className={cn("block text-caption", state.phase === "error" ? "text-danger-700" : "text-fg-subtle")}>
            {state.phase === "error" ? state.message : busy ? `${state.progress}%` : hint ?? t("hint")}
          </span>
        </span>
        {busy ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              xhrRef.current?.abort();
            }}
            className="ml-auto grid size-7 place-items-center rounded text-fg-subtle hover:bg-ink-100 hover:text-fg"
            aria-label={t("cancel")}
          >
            <X className="size-4" />
          </button>
        ) : null}
        {busy ? (
          <span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-lg bg-brand-100" aria-hidden>
            <span className="block h-full bg-brand-600 transition-[width]" style={{ width: `${state.progress}%` }} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
