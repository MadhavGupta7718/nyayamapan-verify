"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CameraOff, ImageUp, ScanLine } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { tokenFromQr } from "@/lib/qr-token";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };

async function nativeDetector(): Promise<Detector | null> {
  const Ctor = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const formats = (await Ctor.getSupportedFormats?.()) ?? ["qr_code"];
    return formats.includes("qr_code") ? new Ctor({ formats: ["qr_code"] }) : null;
  } catch {
    return null;
  }
}

async function decodeCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { default: jsQR } = await import("jsqr");
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

/** Scans a certificate QR with the device camera (or a photo of it) and opens the public verification page. */
export function QrScanButton({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const t = useTranslations("verify.scan");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" variant="secondary" size={size} className={className} onClick={() => setOpen(true)}>
        <ScanLine /> {t("button")}
      </Button>
      {open ? <QrScanDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function QrScanDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("verify.scan");
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [camera, setCamera] = React.useState<"starting" | "on" | "off">("starting");
  const done = React.useRef(false);

  const handle = React.useCallback(
    (text: string | null) => {
      if (!text || done.current) return false;
      const token = tokenFromQr(text, window.location.host);
      if (!token) {
        setError(t("foreign"));
        return false;
      }
      done.current = true;
      router.push(`/verify/${token}`);
      onClose();
      return true;
    },
    [onClose, router, t]
  );

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function run() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera("off");
        setError(t("unsupported"));
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e) {
        setCamera("off");
        setError((e as DOMException)?.name === "NotAllowedError" ? t("denied") : t("noCamera"));
        return;
      }
      if (cancelled || !videoRef.current) return stream.getTracks().forEach((tr) => tr.stop());
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setCamera("on");
      const detector = await nativeDetector();

      const tick = async () => {
        if (cancelled || done.current) return;
        if (video.readyState >= 2 && video.videoWidth) {
          let text: string | null = null;
          if (detector) {
            text = (await detector.detect(video).catch(() => []))[0]?.rawValue ?? null;
          } else if (canvasRef.current) {
            const c = canvasRef.current;
            const scale = Math.min(1, 640 / video.videoWidth);
            c.width = Math.round(video.videoWidth * scale);
            c.height = Math.round(video.videoHeight * scale);
            c.getContext("2d", { willReadFrequently: true })?.drawImage(video, 0, 0, c.width, c.height);
            text = await decodeCanvas(c);
          }
          if (handle(text)) return;
        }
        timer = setTimeout(tick, 250);
      };
      tick();
    }
    run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [handle, t]);

  async function fromFile(file: File) {
    setError(null);
    const bitmap = await createImageBitmap(file).catch(() => null);
    const c = canvasRef.current;
    if (!bitmap || !c) return setError(t("unreadable"));
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    c.width = Math.round(bitmap.width * scale);
    c.height = Math.round(bitmap.height * scale);
    c.getContext("2d", { willReadFrequently: true })?.drawImage(bitmap, 0, 0, c.width, c.height);
    const text = await decodeCanvas(c);
    if (!text) return setError(t("unreadable"));
    handle(text);
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("title")}
      description={t("desc")}
      footer={
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) fromFile(f);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <ImageUp /> {t("fromPhoto")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("close")}
          </Button>
        </>
      }
    >
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-ink-900">
        <video ref={videoRef} playsInline muted className="size-full object-cover" aria-label={t("title")} />
        {camera === "on" ? (
          <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" aria-hidden />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-body-sm text-white/80">
            {camera === "starting" ? t("starting") : <CameraOff className="size-10" aria-hidden />}
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" aria-hidden />
      <p role={error ? "alert" : undefined} className={error ? "mt-3 text-body-sm font-medium text-danger-700" : "mt-3 text-caption text-fg-subtle"}>
        {error ?? t("hint")}
      </p>
    </Modal>
  );
}
