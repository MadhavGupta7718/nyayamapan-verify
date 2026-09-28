"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CircleCheck, Loader2, MapPinOff, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api-client";
import { STATE_BORDER_TOLERANCE_KM, type SiteLocationCheck } from "@/lib/site-location";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/states";

/** Re-checks the coordinates against the chosen state and district shortly after any of them change. */
export function useSiteLocationCheck({ stateId, districtId, latitude, longitude }: { stateId: string; districtId: string; latitude: string; longitude: string }) {
  const [check, setCheck] = React.useState<SiteLocationCheck | null>(null);
  const [checking, setChecking] = React.useState(false);
  const lat = Number(latitude);
  const lng = Number(longitude);
  const ready = !!stateId && latitude.trim() !== "" && longitude.trim() !== "" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  React.useEffect(() => {
    setCheck(null);
    if (!ready) {
      setChecking(false);
      return;
    }
    setChecking(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ stateId, lat: String(lat), lng: String(lng), ...(districtId ? { districtId } : {}) });
        const res = await api<{ data: SiteLocationCheck }>(`/api/geography/site-check?${qs}`, { signal: ctrl.signal });
        if (!ctrl.signal.aborted) setCheck(res.data);
      } catch {
        // Advisory only: the save request runs the same check and reports a mismatch itself.
      } finally {
        if (!ctrl.signal.aborted) setChecking(false);
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [ready, stateId, districtId, lat, lng]);

  return { check, checking, setCheck };
}

export function SiteLocationAlert({
  check,
  checking,
  chosenState,
  districtId,
  stateLabel,
  districtLabel,
  onSwitchState,
  onSwitchDistrict,
}: {
  check: SiteLocationCheck | null;
  checking: boolean;
  chosenState: string;
  districtId: string;
  /** Localised name for a state/district id; the check's own (English) name is used when this returns nothing. */
  stateLabel: (id: string | null) => string | undefined;
  districtLabel: (id: string | null) => string | undefined;
  /** Omitted where the state can't be changed (editing an existing instrument). */
  onSwitchState?: (stateId: string, districtId: string | null) => void;
  onSwitchDistrict: (districtId: string) => void;
}) {
  const t = useTranslations("siteCheck");
  if (!check) {
    return checking ? (
      <p className="flex items-center gap-1.5 text-caption text-fg-subtle">
        <Loader2 className="size-3.5 animate-spin" /> {t("checking")}
      </p>
    ) : null;
  }
  if (check.state === "unknown") return null;

  const detectedState = check.detectedState ? stateLabel(check.detectedState.id) ?? check.detectedState.name : null;
  const detectedDistrict = check.detectedDistrict ? districtLabel(check.detectedDistrict.id) ?? check.detectedDistrict.name : null;

  if (check.state === "outside") {
    return (
      <InlineAlert tone="danger" icon={<MapPinOff />} title={t("stateMismatchTitle")}>
        <p>
          {detectedState
            ? t("stateMismatchBody", { detected: detectedState, chosen: chosenState, km: check.distanceKm })
            : t("stateOutsideBody", { chosen: chosenState, km: check.distanceKm })}
        </p>
        {onSwitchState && check.detectedState?.id ? (
          <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => onSwitchState(check.detectedState!.id!, check.detectedDistrict?.id ?? null)}>
            {t("switchState", { state: detectedState ?? "" })}
          </Button>
        ) : (
          <p className="mt-1">{onSwitchState ? t("fixCoordinates") : t("stateLocked")}</p>
        )}
      </InlineAlert>
    );
  }

  const chosenDistrict = districtLabel(districtId || null);
  if (check.district === "different" && check.detectedDistrict?.id) {
    return (
      <InlineAlert tone="warning" icon={<TriangleAlert />} title={t("districtMismatchTitle")}>
        <p>{t("districtMismatchBody", { detected: detectedDistrict ?? "", chosen: chosenDistrict ?? "" })}</p>
        <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => onSwitchDistrict(check.detectedDistrict!.id!)}>
          {t("switchDistrict", { district: detectedDistrict ?? "" })}
        </Button>
      </InlineAlert>
    );
  }
  if (!districtId && check.detectedDistrict?.id) {
    return (
      <InlineAlert tone="info" icon={<CircleCheck />} title={t("districtSuggestTitle", { district: detectedDistrict ?? "" })}>
        <Button type="button" size="sm" variant="secondary" className="mt-1" onClick={() => onSwitchDistrict(check.detectedDistrict!.id!)}>
          {t("useDistrict", { district: detectedDistrict ?? "" })}
        </Button>
      </InlineAlert>
    );
  }

  const place = check.district === "same" && chosenDistrict ? `${chosenDistrict}, ${chosenState}` : chosenState;
  return (
    <p className="flex items-start gap-1.5 text-caption text-success-700">
      <CircleCheck className="mt-px size-3.5 shrink-0" />
      {check.state === "near" ? t("nearBorder", { place, km: check.distanceKm, max: STATE_BORDER_TOLERANCE_KM }) : t("matches", { place })}
    </p>
  );
}
