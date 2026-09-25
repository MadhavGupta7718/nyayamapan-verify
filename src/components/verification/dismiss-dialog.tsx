"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Camera, MapPinOff } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { api, errorMessage } from "@/lib/api-client";
import { DISMISS_REASON_MIN } from "@/lib/evidence";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/input";

function currentPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 });
  });
}

/**
 * "Location not found": the officer photographs what they found at the registered site and explains why
 * the instrument couldn't be located. The visit ends and the application returns to the applicant.
 */
export function DismissDialog({ appId, inspectionId, disabled }: { appId: string; inspectionId: string; disabled?: boolean }) {
  const t = useTranslations("field.dismiss");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const valid = !!file && reason.trim().length >= DISMISS_REASON_MIN;

  async function submit() {
    if (!file) return;
    setSaving(true);
    try {
      const pos = await currentPosition();
      const form = new FormData();
      form.set("file", file);
      form.set("inspectionId", inspectionId);
      form.set("reason", reason.trim());
      if (pos) {
        form.set("latitude", String(pos.coords.latitude));
        form.set("longitude", String(pos.coords.longitude));
      }
      await api(`/api/verifications/${appId}/dismiss`, { form, timeoutMs: 60_000 });
      toast.success(t("done"));
      setOpen(false);
      router.replace("/verification");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e, te));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !saving && setOpen(o)}
      title={t("title")}
      description={t("desc")}
      trigger={
        <Button variant="secondary" disabled={disabled}>
          <MapPinOff /> {t("action")}
        </Button>
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={submit} loading={saving} disabled={!valid}>
            <MapPinOff /> {t("submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="dismiss-photo" label={t("photo")} required hint={t("photoHint")}>
          <div className="space-y-2">
            <input
              ref={inputRef}
              id="dismiss-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt={t("photo")} className="max-h-56 w-full rounded-lg object-cover ring-1 ring-line" />
            ) : null}
            <Button type="button" variant="secondary" block onClick={() => inputRef.current?.click()}>
              <Camera /> {file ? t("retake") : t("take")}
            </Button>
          </div>
        </Field>
        <Field id="dismiss-reason" label={t("reason")} required hint={t("reasonHint", { count: DISMISS_REASON_MIN })}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={1000} />
        </Field>
      </div>
    </Modal>
  );
}
