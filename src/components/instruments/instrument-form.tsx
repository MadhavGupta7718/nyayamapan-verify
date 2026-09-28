"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Crosshair, Save } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { FormSection } from "@/components/ui/form-section";
import { SiteLocationAlert, useSiteLocationCheck } from "@/components/instruments/site-location-check";
import { blocksSave, type SiteLocationCheck } from "@/lib/site-location";

type Opt = { id: string; label: string };
type Values = {
  organizationId: string;
  instrumentTypeId: string;
  manufacturer: string;
  modelName: string;
  serialNumber: string;
  capacity: string;
  accuracy: string;
  yearOfManufacture: string;
  locationLabel: string;
  address: string;
  stateId: string;
  districtId: string;
  latitude: string;
  longitude: string;
};

export function InstrumentForm({
  types,
  states,
  organizations,
  defaults,
}: {
  types: Opt[];
  states: (Opt & { districts: Opt[] })[];
  organizations: Opt[];
  defaults: { stateId: string; districtId: string; address: string };
}) {
  const t = useTranslations("instrumentForm");
  const te = useTranslations("apiErrors");
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<keyof Values, string>>>({});
  const [v, setV] = React.useState<Values>({
    organizationId: "",
    instrumentTypeId: "",
    manufacturer: "",
    modelName: "",
    serialNumber: "",
    capacity: "",
    accuracy: "",
    yearOfManufacture: "",
    locationLabel: "",
    address: defaults.address,
    stateId: defaults.stateId || (states.length === 1 ? states[0].id : ""),
    districtId: defaults.districtId,
    latitude: "",
    longitude: "",
  });
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setV((p) => ({ ...p, [k]: value, ...(k === "stateId" ? { districtId: "" } : {}) }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };
  const districts = states.find((s) => s.id === v.stateId)?.districts ?? [];
  const year = new Date().getFullYear();
  const site = useSiteLocationCheck(v);
  const siteBlocked = blocksSave(site.check);
  const stateLabel = (id: string | null) => states.find((s) => s.id === id)?.label;
  const districtLabel = (id: string | null) => states.flatMap((s) => s.districts).find((d) => d.id === id)?.label;

  function validate() {
    const e: typeof errors = {};
    if (organizations.length && !v.organizationId) e.organizationId = t("errors.required");
    if (!v.instrumentTypeId) e.instrumentTypeId = t("errors.required");
    if (v.manufacturer.trim().length < 2) e.manufacturer = t("errors.min", { n: 2 });
    if (!v.modelName.trim()) e.modelName = t("errors.required");
    if (v.serialNumber.trim().length < 2) e.serialNumber = t("errors.min", { n: 2 });
    if (v.yearOfManufacture && (Number(v.yearOfManufacture) < 1950 || Number(v.yearOfManufacture) > year)) e.yearOfManufacture = t("errors.year", { max: year });
    if (!v.stateId) e.stateId = t("errors.required");
    if (!v.districtId) e.districtId = t("errors.required");
    if (!v.latitude.trim() || Number.isNaN(Number(v.latitude)) || Math.abs(Number(v.latitude)) > 90) e.latitude = t("errors.coord");
    if (!v.longitude.trim() || Number.isNaN(Number(v.longitude)) || Math.abs(Number(v.longitude)) > 180) e.longitude = t("errors.coord");
    setErrors(e);
    if (Object.keys(e).length) {
      const first = Object.keys(e)[0];
      document.getElementById(`f-${first}`)?.focus();
    }
    return Object.keys(e).length === 0;
  }

  function locate() {
    if (!navigator.geolocation) return toast.error(t("gpsUnavailable"));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setV((p) => ({ ...p, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setLocating(false);
        toast.success(t("gpsCaptured", { accuracy: Math.round(pos.coords.accuracy) }));
      },
      () => {
        setLocating(false);
        toast.error(t("gpsDenied"));
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (siteBlocked) {
      document.getElementById("site-check")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return toast.error(te("LOCATION_STATE_MISMATCH"));
    }
    setSaving(true);
    try {
      const res = await api<{ data: { id: string; instrumentCode: string } }>("/api/instruments", {
        body: {
          organizationId: v.organizationId || undefined,
          instrumentTypeId: v.instrumentTypeId,
          manufacturer: v.manufacturer.trim(),
          modelName: v.modelName.trim(),
          serialNumber: v.serialNumber.trim(),
          capacity: v.capacity.trim() || undefined,
          accuracy: v.accuracy.trim() || undefined,
          yearOfManufacture: v.yearOfManufacture ? Number(v.yearOfManufacture) : undefined,
          locationLabel: v.locationLabel.trim() || undefined,
          address: v.address.trim() || undefined,
          stateId: v.stateId,
          districtId: v.districtId,
          latitude: Number(v.latitude),
          longitude: Number(v.longitude),
        },
      });
      toast.success(t("created", { code: res.data.instrumentCode }));
      router.push(`/instruments/${res.data.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "DUPLICATE_SERIAL") setErrors({ serialNumber: te("DUPLICATE_SERIAL") });
      if (err instanceof ApiError && err.code === "LOCATION_STATE_MISMATCH") site.setCheck((err.details as { check: SiteLocationCheck }).check);
      toast.error(errorMessage(err, te));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <Card>
        <div className="px-5 py-6 sm:px-6">
          <FormSection title={t("sections.identity")} description={t("sections.identityDesc")}>
            {organizations.length ? (
              <Field id="f-organizationId" label={t("fields.organization")} required error={errors.organizationId} className="sm:col-span-2">
                <Select value={v.organizationId} onChange={set("organizationId")}>
                  <option value="">{t("select")}</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field id="f-instrumentTypeId" label={t("fields.type")} required error={errors.instrumentTypeId} className="sm:col-span-2">
              <Select value={v.instrumentTypeId} onChange={set("instrumentTypeId")}>
                <option value="">{t("select")}</option>
                {types.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="f-manufacturer" label={t("fields.manufacturer")} required error={errors.manufacturer}>
              <Input value={v.manufacturer} onChange={set("manufacturer")} maxLength={120} autoComplete="off" />
            </Field>
            <Field id="f-modelName" label={t("fields.model")} required error={errors.modelName}>
              <Input value={v.modelName} onChange={set("modelName")} maxLength={120} autoComplete="off" />
            </Field>
            <Field id="f-serialNumber" label={t("fields.serial")} required hint={t("fields.serialHint")} error={errors.serialNumber}>
              <Input value={v.serialNumber} onChange={set("serialNumber")} maxLength={80} className="font-mono" autoComplete="off" />
            </Field>
            <Field id="f-yearOfManufacture" label={t("fields.year")} error={errors.yearOfManufacture}>
              <Input type="number" inputMode="numeric" min={1950} max={year} value={v.yearOfManufacture} onChange={set("yearOfManufacture")} />
            </Field>
          </FormSection>

          <FormSection title={t("sections.metrology")} description={t("sections.metrologyDesc")}>
            <Field id="f-capacity" label={t("fields.capacity")} hint={t("fields.capacityHint")}>
              <Input value={v.capacity} onChange={set("capacity")} maxLength={60} />
            </Field>
            <Field id="f-accuracy" label={t("fields.accuracy")} hint={t("fields.accuracyHint")}>
              <Input value={v.accuracy} onChange={set("accuracy")} maxLength={60} />
            </Field>
          </FormSection>

          <FormSection title={t("sections.location")} description={t("sections.locationDesc")}>
            <Field id="f-stateId" label={t("fields.state")} required error={errors.stateId}>
              <Select value={v.stateId} onChange={set("stateId")} disabled={states.length === 1}>
                <option value="">{t("select")}</option>
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="f-districtId" label={t("fields.district")} required error={errors.districtId}>
              <Select value={v.districtId} onChange={set("districtId")} disabled={!districts.length}>
                <option value="">{t("select")}</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="f-locationLabel" label={t("fields.site")} hint={t("fields.siteHint")}>
              <Input value={v.locationLabel} onChange={set("locationLabel")} maxLength={120} />
            </Field>
            <Field id="f-address" label={t("fields.address")}>
              <Input value={v.address} onChange={set("address")} maxLength={300} />
            </Field>
            <Field id="f-latitude" label={t("fields.latitude")} required error={errors.latitude}>
              <Input value={v.latitude} onChange={set("latitude")} inputMode="decimal" className="font-mono" />
            </Field>
            <Field id="f-longitude" label={t("fields.longitude")} required error={errors.longitude}>
              <Input value={v.longitude} onChange={set("longitude")} inputMode="decimal" className="font-mono" />
            </Field>
            <div className="sm:col-span-2">
              <Button type="button" variant="secondary" size="sm" onClick={locate} loading={locating}>
                <Crosshair /> {t("useLocation")}
              </Button>
              <p className="mt-1.5 text-caption text-fg-subtle">{t("locationHint")}</p>
            </div>
            <div id="site-check" className="sm:col-span-2 empty:hidden">
              <SiteLocationAlert
                check={site.check}
                checking={site.checking}
                chosenState={stateLabel(v.stateId) ?? ""}
                districtId={v.districtId}
                stateLabel={stateLabel}
                districtLabel={districtLabel}
                onSwitchState={
                  states.length > 1
                    ? (stateId, districtId) => {
                        setV((p) => ({ ...p, stateId, districtId: districtId ?? "" }));
                        setErrors((p) => ({ ...p, stateId: undefined, districtId: undefined }));
                      }
                    : undefined
                }
                onSwitchDistrict={(districtId) => {
                  setV((p) => ({ ...p, districtId }));
                  setErrors((p) => ({ ...p, districtId: undefined }));
                }}
              />
            </div>
          </FormSection>
        </div>
        <CardFooter>
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={saving} disabled={siteBlocked}>
            <Save /> {t("save")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
