"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Crosshair, MapPinned, Save } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Field, Input, Select } from "@/components/ui/input";

type Location = { locationLabel: string; address: string; districtId: string; latitude: string; longitude: string };

/** Lets the applicant correct the instrument's site, district and coordinates while its application is still with them. */
export function LocationEditDrawer({
  instrumentId,
  districts,
  initial,
  defaultOpen,
}: {
  instrumentId: string;
  districts: { id: string; label: string }[];
  initial: Location;
  defaultOpen?: boolean;
}) {
  const t = useTranslations("instruments.locationEdit");
  const tf = useTranslations("instrumentForm");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [open, setOpen] = React.useState(!!defaultOpen);
  const [v, setV] = React.useState<Location>(initial);
  const [locating, setLocating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const set = (k: keyof Location) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  const lat = Number(v.latitude);
  const lng = Number(v.longitude);
  const coordsOk = v.latitude.trim() !== "" && v.longitude.trim() !== "" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !Number.isNaN(lat) && !Number.isNaN(lng);
  const valid = !!v.districtId && coordsOk;

  function locate() {
    if (!navigator.geolocation) return toast.error(tf("gpsUnavailable"));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setV((p) => ({ ...p, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setLocating(false);
        toast.success(tf("gpsCaptured", { accuracy: Math.round(pos.coords.accuracy) }));
      },
      () => {
        setLocating(false);
        toast.error(tf("gpsDenied"));
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  async function save() {
    setSaving(true);
    try {
      await api(`/api/instruments/${instrumentId}`, {
        method: "PATCH",
        body: { locationLabel: v.locationLabel.trim() || undefined, address: v.address.trim() || undefined, districtId: v.districtId, latitude: lat, longitude: lng },
      });
      toast.success(t("saved"));
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e, te));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !saving && setOpen(o)}
      title={t("title")}
      description={t("desc")}
      trigger={
        <Button variant="secondary" size="sm">
          <MapPinned /> {t("action")}
        </Button>
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
            {tf("cancel")}
          </Button>
          <Button onClick={save} loading={saving} disabled={!valid}>
            <Save /> {t("save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="le-district" label={tf("fields.district")} required>
          <Select value={v.districtId} onChange={set("districtId")}>
            <option value="">{tf("select")}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="le-site" label={tf("fields.site")} hint={tf("fields.siteHint")}>
          <Input value={v.locationLabel} onChange={set("locationLabel")} maxLength={120} />
        </Field>
        <Field id="le-address" label={tf("fields.address")}>
          <Input value={v.address} onChange={set("address")} maxLength={300} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="le-lat" label={tf("fields.latitude")} required error={v.latitude && !coordsOk ? tf("errors.coord") : undefined}>
            <Input value={v.latitude} onChange={set("latitude")} inputMode="decimal" className="font-mono" />
          </Field>
          <Field id="le-lng" label={tf("fields.longitude")} required>
            <Input value={v.longitude} onChange={set("longitude")} inputMode="decimal" className="font-mono" />
          </Field>
        </div>
        <div>
          <Button type="button" variant="secondary" size="sm" onClick={locate} loading={locating}>
            <Crosshair /> {tf("useLocation")}
          </Button>
          <p className="mt-1.5 text-caption text-fg-subtle">{tf("locationHint")}</p>
        </div>
      </div>
    </Drawer>
  );
}
