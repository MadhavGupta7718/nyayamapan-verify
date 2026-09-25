import * as React from "react";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "@/lib/status";
import { integerTicks } from "@/lib/chart-scale";

/**
 * Lightweight SVG/CSS charts rendered on the server (no client JS, no chart library),
 * so dashboards stream quickly and stay accessible (every chart has a data table fallback).
 */

export function ColumnChart({
  data,
  height = 180,
  valueLabel,
  className,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  height?: number;
  valueLabel: string;
  className?: string;
}) {
  const ticks = integerTicks(Math.max(0, ...data.map((d) => d.value)));
  const top = ticks[ticks.length - 1];
  const pct = (v: number) => (v / top) * 100;
  const crowded = data.length > 8;
  return (
    <figure className={cn("w-full", className)}>
      <div className="flex gap-2 pt-5">
        <div className="relative w-7 shrink-0 text-right text-caption text-fg-faint tabular" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: `${pct(t)}%` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative flex gap-1 border-b border-line sm:gap-2" style={{ height }}>
            {ticks.slice(1).map((t) => (
              <div key={t} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${pct(t)}%` }} aria-hidden />
            ))}
            {data.map((d, i) => (
              <div key={i} className="group relative h-full min-w-0 flex-1" title={`${d.label}: ${d.value}`}>
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 mx-auto max-w-[2.5rem] origin-bottom animate-fade-up transition-colors",
                    d.value === 0 ? "h-0.5 rounded-sm bg-ink-200" : "rounded-t-md",
                    d.value > 0 && (d.highlight ? "bg-brand-700" : "bg-brand-200 group-hover:bg-brand-400")
                  )}
                  style={d.value > 0 ? { height: `${Math.max(1.5, pct(d.value))}%` } : undefined}
                />
                <span
                  className={cn("absolute inset-x-0 text-center text-[0.6875rem] font-medium leading-none tabular", d.value === 0 ? "text-fg-faint" : "text-fg-muted", crowded && "max-sm:hidden")}
                  style={{ bottom: `calc(${d.value > 0 ? Math.max(1.5, pct(d.value)) : 0}% + 0.25rem)` }}
                >
                  {d.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1 sm:gap-2" aria-hidden>
            {data.map((d, i) => (
              <span key={i} className={cn("min-w-0 flex-1 truncate text-center text-caption text-fg-subtle", crowded && i % 2 === 1 && "max-sm:invisible")}>
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>{valueLabel}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th>{d.label}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function BarList({
  data,
  className,
  formatValue,
}: {
  data: { label: React.ReactNode; value: number; tone?: Tone; hint?: React.ReactNode; key?: string }[];
  className?: string;
  formatValue?: (v: number) => React.ReactNode;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className={cn("space-y-3", className)}>
      {data.map((d, i) => (
        <li key={d.key ?? i}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-body-sm">
            <span className="min-w-0 truncate text-fg">{d.label}</span>
            <span className="shrink-0 font-semibold text-fg tabular">{formatValue ? formatValue(d.value) : d.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink-100">
            <div
              className={cn("h-full rounded-full transition-[width] duration-700 ease-out", TONE_CLASSES[d.tone ?? "brand"].dot)}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          {d.hint ? <p className="mt-1 text-caption text-fg-subtle">{d.hint}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/** Stage funnel: each row width relative to the first stage. */
export function Funnel({
  stages,
  className,
}: {
  stages: { label: React.ReactNode; value: number; key: string }[];
  className?: string;
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <ol className={cn("space-y-1.5", className)}>
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100;
        return (
          <li key={s.key} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3 text-body-sm sm:grid-cols-[10rem_1fr_3rem]">
            <span className="truncate text-fg-muted">{s.label}</span>
            <div className="h-7 rounded-md bg-ink-50">
              <div
                className="flex h-full items-center rounded-md bg-gradient-to-r from-brand-700 to-brand-500 transition-[width] duration-700 ease-out"
                style={{ width: `${Math.max(pct, s.value ? 4 : 0)}%`, opacity: 1 - i * 0.07 }}
              />
            </div>
            <span className="text-right font-semibold text-fg tabular">{s.value}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Donut({
  segments,
  size = 128,
  thickness = 16,
  centerLabel,
  centerValue,
}: {
  segments: { label: React.ReactNode; value: number; tone: Tone; key: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: React.ReactNode;
  centerValue?: React.ReactNode;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const stroke: Record<Tone, string> = {
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    info: "#3b82f6",
    neutral: "#9aa3b0",
    brand: "#375296",
  };
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f3" strokeWidth={thickness} />
          {segments.map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={stroke[s.tone]}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-h2 leading-none text-fg tabular">{centerValue}</p>
            {centerLabel ? <p className="mt-1 text-caption text-fg-subtle">{centerLabel}</p> : null}
          </div>
        </div>
      </div>
      <ul className="min-w-[9rem] flex-1 space-y-1.5">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3 text-body-sm">
            <span className="flex items-center gap-2 text-fg-muted">
              <span className={cn("size-2.5 rounded-sm", TONE_CLASSES[s.tone].dot)} aria-hidden />
              {s.label}
            </span>
            <span className="font-semibold text-fg tabular">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
