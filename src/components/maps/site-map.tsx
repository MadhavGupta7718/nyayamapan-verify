"use client";

import * as React from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { cn } from "@/lib/utils";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "neutral";
  href?: string;
};

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * OpenStreetMap view. Leaflet is imported only in the browser after mount so it never enters the
 * server bundle; markers are lightweight divIcons styled by tone.
 */
export function SiteMap({ points, className, height = 420, emptyLabel }: { points: MapPoint[]; className?: string; height?: number; emptyLabel: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(ref.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([22.5, 79], 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapRef.current);
      }
      const map = mapRef.current;
      map.eachLayer((l) => {
        if ((l as unknown as { options?: { pane?: string } }).options?.pane === "markerPane") map.removeLayer(l);
      });
      const bounds: [number, number][] = [];
      for (const p of points) {
        const icon = L.divIcon({ className: "", html: `<span class="map-pin" data-tone="${p.tone ?? "brand"}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] });
        const html = `<strong>${escape(p.title)}</strong>${p.subtitle ? `<br/><span>${escape(p.subtitle)}</span>` : ""}${p.href ? `<br/><a href="${escape(p.href)}">→</a>` : ""}`;
        L.marker([p.lat, p.lng], { icon, title: p.title }).addTo(map).bindPopup(html);
        bounds.push([p.lat, p.lng]);
      }
      if (bounds.length === 1) map.setView(bounds[0], 13);
      else if (bounds.length > 1) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [points]);

  React.useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-line bg-surface-sunken", className)} style={{ height }}>
      <div ref={ref} className="absolute inset-0 z-0" aria-label={emptyLabel} role="region" />
      {!ready ? <div className="skeleton absolute inset-0" aria-hidden /> : null}
      {ready && points.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-[500] mx-auto w-fit rounded-full bg-surface px-3 py-1 text-caption text-fg-muted shadow-sm">{emptyLabel}</div>
      ) : null}
    </div>
  );
}
