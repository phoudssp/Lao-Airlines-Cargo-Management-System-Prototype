import { useEffect, useRef, useState, type ReactNode } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { Button } from "@/ui/kit";
import { useT } from "@/lib/i18n";
import { num } from "@/lib/format";

// Categorical colours in fixed order. The orange is under 3:1 against the surface, so every value is also in the table view.
export const DOMESTIC = "#0F5596";
export const INTERNATIONAL = "#D9822B";

export function abbrLak(n: number) { const a = Math.abs(n); if (a === 0) return "0"; if (a >= 1e9) return `${trim(n / 1e9)}B ₭`; if (a >= 1e6) return `${trim(n / 1e6)}M ₭`; if (a >= 1e3) return `${trim(n / 1e3)}K ₭`; return `${Math.round(n)} ₭`; }
export function tons(kg: number) { if (kg === 0) return "0"; if (Math.abs(kg) < 1000) return `${Math.round(kg)} kg`; return `${trim(kg / 1000)} t`; }
function trim(n: number) { const a = Math.abs(n); return a >= 100 ? String(Math.round(n)) : String(Math.round(n * 10) / 10); }

function useWidth() {
  const ref = useRef<HTMLDivElement>(null); const [w, setW] = useState(640);
  useEffect(() => { const el = ref.current; if (!el) return; const measure = () => { if (el.clientWidth) setW(el.clientWidth); }; measure(); if (typeof ResizeObserver === "undefined") return; const o = new ResizeObserver(measure); o.observe(el); return () => o.disconnect(); }, []);
  return [ref, w] as const;
}
function niceTicks(max: number, n = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / n; const mag = 10 ** Math.floor(Math.log10(raw)); const norm = raw / mag; const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const out = [0]; while (out[out.length - 1] < max) out.push(out[out.length - 1] + step); return out;
}
/** Bar path: small rounded data-end, square at the baseline. */
const columnPath = (x: number, y: number, w: number, base: number) => { const r = Math.min(3, w / 2, base - y); return `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${base}Z`; };
const barPath = (x: number, y: number, len: number, h: number) => { const r = Math.min(3, h / 2, len); return `M${x} ${y}H${x + len - r}Q${x + len} ${y} ${x + len} ${y + r}V${y + h - r}Q${x + len} ${y + h} ${x + len - r} ${y + h}H${x}Z`; };

function Tip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const half = 88; const left = Math.max(half, Math.min(width - half, x));
  return <div className="pointer-events-none absolute top-0 z-10 w-[176px] -translate-x-1/2 rounded border border-line bg-surface px-2.5 py-1.5 text-xs shadow-pop" style={{ left }}>{children}</div>;
}
function ViewToggle({ table, onChange }: { table: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  return <Button size="sm" variant="ghost" icon={table ? BarChart3 : Table2} aria-pressed={table} onClick={() => onChange(!table)}>{table ? t("ເບິ່ງກຣາບ", "Show chart") : t("ເບິ່ງຕາຕະລາງ", "Show table")}</Button>;
}
const swatch = (color: string) => <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />;

export interface Series { name: string; color: string }
export interface ColumnDatum { key: string; label: string; fullLabel?: string; values: number[] }
/** Grouped thin columns on one axis, with a legend, per-mark tooltip and a table view. */
export function GroupedColumns({ data, series, axisFmt, fullFmt, title, height = 240, footnote }: { data: ColumnDatum[]; series: Series[]; axisFmt: (n: number) => string; fullFmt: (n: number) => string; title: string; height?: number; footnote?: string }) {
  const t = useT(); const [ref, width] = useWidth(); const [table, setTable] = useState(false); const [hover, setHover] = useState<{ group: number; s: number } | null>(null);
  const multi = series.length > 1;
  const max = Math.max(0, ...data.flatMap((x) => x.values)); const tk = niceTicks(max); const top = tk[tk.length - 1];
  const pad = { l: 58, r: 6, t: 20, b: 24 }; const plotW = Math.max(40, width - pad.l - pad.r); const plotH = height - pad.t - pad.b; const base = pad.t + plotH;
  const y = (v: number) => base - (v / top) * plotH; const band = plotW / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(12, (band * 0.72 - (series.length - 1) * 2) / series.length)); const groupW = barW * series.length + 2 * (series.length - 1);
  const barX = (g: number, s: number) => pad.l + band * g + (band - groupW) / 2 + s * (barW + 2);
  // Direct labels only on the key values: each series' peak, when no taller neighbouring bar runs through the label.
  const labels: { g: number; s: number; v: number }[] = [];
  series.forEach((_, s) => {
    let g = -1, v = 0; data.forEach((x, i) => { if (x.values[s] > v) { v = x.values[s]; g = i; } }); if (g < 0) return;
    const cx = barX(g, s) + barW / 2; const blocked = data.some((x, i) => x.values.some((w, k) => { const near = Math.abs(barX(i, k) + barW / 2 - cx) < 30; return near && (i !== g || k !== s) && y(w) < y(v) + 2; }));
    if (!blocked && !labels.some((l) => Math.abs(barX(l.g, l.s) - cx) < 60 && Math.abs(y(l.v) - y(v)) < 14)) labels.push({ g, s, v });
  });
  const every = Math.max(1, Math.ceil(38 / band));
  return <figure className="m-0">
    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
      <figcaption className="flex flex-wrap items-center gap-x-3 text-xs text-ink-2">{multi ? series.map((s) => <span key={s.name} className="inline-flex items-center gap-1.5">{swatch(s.color)}{s.name}</span>) : title}</figcaption>
      <ViewToggle table={table} onChange={setTable} />
    </div>
    {table ? <div className="overflow-x-auto" style={{ maxHeight: height + 20 }}><table className="w-full min-w-[360px] text-sm"><caption className="sr-only">{title}</caption><thead><tr className="border-b border-line-strong bg-surface-2 text-left text-xs text-ink-2"><th scope="col" className="px-2 py-1.5 font-semibold">{t("ເດືອນ", "Month")}</th>{series.map((s) => <th key={s.name} scope="col" className="px-2 py-1.5 text-right font-semibold">{s.name}</th>)}{multi && <th scope="col" className="px-2 py-1.5 text-right font-semibold">{t("ລວມ", "Total")}</th>}</tr></thead><tbody>{data.map((x) => <tr key={x.key} className="border-b border-line last:border-0"><th scope="row" className="px-2 py-1 text-left font-normal tnum">{x.fullLabel ?? x.label}</th>{x.values.map((v, i) => <td key={i} className="px-2 py-1 text-right tnum whitespace-nowrap">{fullFmt(v)}</td>)}{multi && <td className="px-2 py-1 text-right font-medium tnum whitespace-nowrap">{fullFmt(x.values.reduce((a, b) => a + b, 0))}</td>}</tr>)}</tbody></table></div>
    : <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label={`${title}. ${t("ກົດ ເບິ່ງຕາຕະລາງ ເພື່ອອ່ານຕົວເລກ", "Use Show table to read every value")}`} className="block max-w-full">
        {tk.map((v) => <g key={v}><line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--line-strong)" : "var(--line)"} /><text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--ink-2)" className="tnum">{axisFmt(v)}</text></g>)}
        {data.map((x, g) => <g key={x.key}>
          {x.values.map((v, s) => { if (v <= 0) return null; const top_ = Math.min(y(v), base - 1.5); return <path key={s} d={columnPath(barX(g, s), top_, barW, base)} fill={series[s].color} opacity={hover && !(hover.group === g && hover.s === s) ? 0.5 : 1} />; })}
          {g % every === 0 && <text x={pad.l + band * g + band / 2} y={height - 7} textAnchor="middle" fontSize={11} fill="var(--ink-2)" className="tnum">{x.label}</text>}
        </g>)}
        {labels.map((l) => <text key={`${l.g}-${l.s}`} x={Math.max(pad.l + 22, Math.min(width - 26, barX(l.g, l.s) + barW / 2))} y={y(l.v) - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)" className="tnum">{axisFmt(l.v)}</text>)}
        {data.map((x, g) => series.map((sr, s) => <rect key={`${x.key}-${s}`} x={pad.l + band * g + (band / series.length) * s} y={pad.t} width={band / series.length} height={plotH} fill="transparent" tabIndex={0} aria-label={`${x.fullLabel ?? x.label}, ${sr.name}: ${fullFmt(x.values[s])}`} onPointerEnter={() => setHover({ group: g, s })} onFocus={() => setHover({ group: g, s })} onBlur={() => setHover(null)} style={{ outline: "none" }} />))}
      </svg>
      {hover && data[hover.group] && <Tip x={pad.l + band * hover.group + band / 2} width={width}><div className="mb-0.5 text-ink-2 tnum">{data[hover.group].fullLabel ?? data[hover.group].label}</div>{series.map((s, i) => <div key={s.name} className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-0.5 w-3" style={{ background: s.color }} /><b className={i === hover.s ? "tnum font-semibold" : "tnum font-normal"}>{fullFmt(data[hover.group].values[i])}</b><span className="ml-auto text-ink-2">{s.name}</span></div>)}</Tip>}
    </div>}
    {footnote && <p className="mt-1 text-xs text-ink-2">{footnote}</p>}
  </figure>;
}

export interface BarDatum { key: string; label: string; value: number }
/** Ranked single-series horizontal bars. The largest values carry a direct label. */
export function HorizontalBars({ data, title, axisFmt, fullFmt, labelHeader, rowHeight = 26 }: { data: BarDatum[]; title: string; axisFmt: (n: number) => string; fullFmt: (n: number) => string; labelHeader: string; rowHeight?: number }) {
  const [ref, width] = useWidth(); const [table, setTable] = useState(false); const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((x) => x.value)); const tk = niceTicks(max, 3); const top = tk[tk.length - 1];
  const pad = { l: 78, r: 28, t: 2, b: 22 }; const plotW = Math.max(40, width - pad.l - pad.r); const height = pad.t + rowHeight * data.length + pad.b; const x = (v: number) => pad.l + (v / top) * plotW; const barH = 10;
  return <figure className="m-0">
    <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><figcaption className="text-xs text-ink-2">{title}</figcaption><ViewToggle table={table} onChange={setTable} /></div>
    {table ? <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">{title}</caption><thead><tr className="border-b border-line-strong bg-surface-2 text-left text-xs text-ink-2"><th scope="col" className="px-2 py-1.5 font-semibold">{labelHeader}</th><th scope="col" className="px-2 py-1.5 text-right font-semibold">{title}</th></tr></thead><tbody>{data.map((r) => <tr key={r.key} className="border-b border-line last:border-0"><th scope="row" className="px-2 py-1 text-left font-mono text-[13px] font-normal">{r.label}</th><td className="px-2 py-1 text-right tnum">{fullFmt(r.value)}</td></tr>)}</tbody></table></div>
    : <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label={title} className="block max-w-full">
        {tk.map((v) => <g key={v}><line x1={x(v)} x2={x(v)} y1={pad.t} y2={height - pad.b} stroke={v === 0 ? "var(--line-strong)" : "var(--line)"} /><text x={x(v)} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--ink-2)" className="tnum">{axisFmt(v)}</text></g>)}
        {data.map((r, i) => { const cy = pad.t + rowHeight * i + rowHeight / 2; const len = Math.max(r.value > 0 ? 1.5 : 0, x(r.value) - pad.l); const tipX = pad.l + len + 5; const fits = tipX + 44 < width; return <g key={r.key}>
          <text x={pad.l - 8} y={cy + 4} textAnchor="end" fontSize={12} fontFamily="var(--font-mono, 'Noto Sans Mono', monospace)" fill="var(--ink)">{r.label}</text>
          {len > 0 && <path d={barPath(pad.l, cy - barH / 2, len, barH)} fill={DOMESTIC} opacity={hover != null && hover !== i ? 0.5 : 1} />}
          {i < 3 && r.value > 0 && <text x={fits ? tipX : pad.l + len - 5} y={cy + 4} textAnchor={fits ? "start" : "end"} fontSize={11} fontWeight={600} fill={fits ? "var(--ink)" : "#fff"} className="tnum">{axisFmt(r.value)}</text>}
          <rect x={0} y={pad.t + rowHeight * i} width={width} height={rowHeight} fill="transparent" tabIndex={0} aria-label={`${r.label}: ${fullFmt(r.value)}`} onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} style={{ outline: "none" }} />
        </g>; })}
      </svg>
      {hover != null && data[hover] && <div className="pointer-events-none absolute z-10 rounded border border-line bg-surface px-2.5 py-1 text-xs shadow-pop" style={{ left: Math.min(width - 150, x(data[hover].value) + 8), top: Math.max(0, pad.t + rowHeight * hover - 28) }}><b className="tnum font-semibold">{fullFmt(data[hover].value)}</b><span className="ml-2 font-mono text-ink-2">{data[hover].label}</span></div>}
    </div>}
  </figure>;
}
export const fullLak = (n: number) => `${num(Math.round(n))} ₭`;
export const fullKg = (n: number) => `${num(Math.round(n))} kg`;
