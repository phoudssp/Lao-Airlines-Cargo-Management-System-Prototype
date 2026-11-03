import { ButtonHTMLAttributes, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, Info, Inbox, Search, X, XCircle, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

// ---------- Buttons ----------
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "success"; size?: "sm" | "md" | "lg"; icon?: LucideIcon };
export function Button({ variant = "secondary", size = "md", icon: Icon, className, children, type = "button", ...p }: BtnProps) {
  const v = { primary: "bg-brand text-white hover:bg-brand-hover border-brand", secondary: "bg-surface text-ink border-line-strong hover:bg-surface-2", ghost: "bg-transparent text-ink-2 border-transparent hover:bg-brand-soft hover:text-brand", danger: "bg-surface text-bad border-bad/50 hover:bg-bad-soft", success: "bg-ok text-white border-ok hover:brightness-95" }[variant];
  const s = { sm: "h-8 px-2.5 text-sm gap-1.5", md: "h-9 px-3.5 text-sm gap-2", lg: "h-11 px-5 text-base gap-2" }[size];
  return <button type={type} className={cx("inline-flex items-center justify-center whitespace-nowrap rounded border font-medium transition-colors disabled:opacity-45 disabled:cursor-not-allowed", v, s, className)} {...p}>{Icon && <Icon size={size === "sm" ? 15 : 16} aria-hidden />}{children}</button>;
}
export function IconButton({ icon: Icon, label, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return <button type="button" aria-label={label} title={label} className={cx("inline-grid place-items-center h-8 w-8 rounded text-ink-2 hover:bg-brand-soft hover:text-brand disabled:opacity-40 disabled:cursor-not-allowed transition-colors", className)} {...p}><Icon size={16} aria-hidden /></button>;
}

// ---------- Form ----------
const fullUnlessSized = (c?: string) => (c && /(^|\s)w-/.test(c) ? "" : "w-full");
const ctl = "h-9 rounded border border-line-strong bg-surface px-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-surface-2 disabled:text-ink-2";
export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...p} className={cx(ctl, fullUnlessSized(p.className), p.type === "number" && "tnum", p.className)} />; }
export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea rows={3} {...p} className={cx(ctl, "w-full h-auto py-2", p.className)} />; }
export function Select({ options, placeholder, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return <select {...p} className={cx(ctl, fullUnlessSized(p.className), "pr-7", p.className)}>{placeholder !== undefined && <option value="">{placeholder}</option>}{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
}
export function Field({ label, hint, error, required, children, className }: { label: string; hint?: string; error?: string; required?: boolean; children: ReactNode; className?: string }) {
  return <label className={cx("block", className)}><span className="box-label block mb-1">{label}{required && <span className="text-bad"> *</span>}</span>{children}{error ? <span className="mt-1 block text-xs text-bad">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-3">{hint}</span> : null}</label>;
}
export function Checkbox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <label className={cx("inline-flex items-center gap-2 text-sm", disabled && "opacity-50")}><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}

// ---------- Status ----------
export type Tone = "ok" | "warn" | "bad" | "info" | "neutral";
const toneCls: Record<Tone, string> = { ok: "bg-ok-soft text-ok", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad", info: "bg-info-soft text-info", neutral: "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line" };
const toneIcon: Record<Tone, LucideIcon | null> = { ok: CheckCircle2, warn: AlertTriangle, bad: XCircle, info: Info, neutral: null };
export function Badge({ tone = "neutral", children, noIcon }: { tone?: Tone; children: ReactNode; noIcon?: boolean }) {
  const I = noIcon ? null : toneIcon[tone];
  return <span className={cx("inline-flex items-center gap-1 rounded px-1.5 py-0 text-xs font-medium whitespace-nowrap leading-[22px]", toneCls[tone])}>{I && <I size={12} aria-hidden />}{children}</span>;
}
export function Callout({ tone = "info", title, children, action }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode }) {
  const I = toneIcon[tone] ?? Info;
  return <div className={cx("flex gap-2.5 rounded px-3 py-2.5 text-sm", toneCls[tone])} role={tone === "bad" ? "alert" : "status"}><I size={17} className="mt-0.5 shrink-0" aria-hidden /><div className="min-w-0 flex-1">{title && <div className="font-semibold">{title}</div>}{children && <div className="text-ink">{children}</div>}</div>{action}</div>;
}

// ---------- Page structure ----------
export function PageHeader({ title, subtitle, crumbs, actions }: { title: string; subtitle?: string; crumbs?: { label: string; to?: string }[]; actions?: ReactNode }) {
  return <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
    <div className="min-w-0">
      {crumbs && <nav className="mb-0.5 flex flex-wrap items-center gap-1 text-xs text-ink-2">{crumbs.map((c, i) => <span key={i} className="flex items-center gap-1">{i > 0 && <ChevronRight size={12} aria-hidden />}{c.to ? <Link className="hover:text-brand hover:underline" to={c.to}>{c.label}</Link> : c.label}</span>)}</nav>}
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      {subtitle && <p className="text-sm text-ink-2 max-w-[80ch]">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
  </header>;
}
export function Panel({ title, actions, children, className, flush }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return <section className={cx("rounded-md border border-line bg-surface", className)}>
    {(title || actions) && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5"><h2 className="text-base font-semibold">{title}</h2>{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}</div>}
    <div className={flush ? "" : "p-4"}>{children}</div>
  </section>;
}
/** A compact row of measurements. Not a set of decorated cards. */
export function StatRow({ items }: { items: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; to?: string }[] }) {
  return <dl className="mb-4 grid rounded-md border border-line bg-surface sm:divide-x divide-line" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))` }}>
    {items.map((s, i) => { const body = <><dt className="box-label">{s.label}</dt><dd className={cx("tnum mt-0.5 text-2xl font-semibold leading-8", s.tone === "bad" ? "text-bad" : s.tone === "warn" ? "text-warn" : s.tone === "ok" ? "text-ok" : "text-ink")}>{s.value}</dd>{s.sub && <dd className="text-xs text-ink-2">{s.sub}</dd>}</>; return s.to ? <Link key={i} to={s.to} className="block px-4 py-3 hover:bg-surface-2">{body}</Link> : <div key={i} className="px-4 py-3">{body}</div>; })}
  </dl>;
}
export function Dl({ items, cols = 2 }: { items: { label: string; value: ReactNode }[]; cols?: number }) {
  return <dl className="grid gap-x-6 gap-y-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${cols >= 3 ? 150 : 200}px, 1fr))` }}>{items.map((x, i) => <div key={i} className="min-w-0"><dt className="box-label">{x.label}</dt><dd className="text-sm break-words">{x.value ?? "—"}</dd></div>)}</dl>;
}
export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void }) {
  return <div role="tablist" className="mb-3 flex flex-wrap gap-x-1 border-b border-line">{tabs.map((t) => <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)} className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors", value === t.key ? "border-brand text-brand" : "border-transparent text-ink-2 hover:text-ink")}>{t.label}{t.count != null && <span className="tnum ml-1.5 rounded bg-surface-2 px-1.5 text-xs text-ink-2 ring-1 ring-inset ring-line">{t.count}</span>}</button>)}</div>;
}
export function Empty({ title, children, action, icon: I = Inbox }: { title: string; children?: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return <div className="px-6 py-10 text-center"><I size={26} className="mx-auto mb-2 text-ink-3" aria-hidden /><div className="font-medium">{title}</div>{children && <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">{children}</p>}{action && <div className="mt-3 inline-flex">{action}</div>}</div>;
}

// ---------- Data table: search, sort, filter slot, pagination ----------
export interface Col<R> { key: string; header: string; render: (r: R) => ReactNode; sort?: (r: R) => string | number; align?: "left" | "right" | "center"; width?: string; mono?: boolean }
export function DataTable<R>({ rows, columns, rowKey, search, filters, pageSize = 12, empty, onRowClick, toolbar, defaultSort, minWidth = 720 }: { rows: R[]; columns: Col<R>[]; rowKey: (r: R) => string; search?: (r: R) => string; filters?: ReactNode; pageSize?: number; empty?: ReactNode; onRowClick?: (r: R) => void; toolbar?: ReactNode; defaultSort?: { key: string; dir: "asc" | "desc" }; minWidth?: number }) {
  const t = useT(); const [q, setQ] = useState(""); const [sort, setSort] = useState(defaultSort); const [page, setPage] = useState(0);
  const shown = useMemo(() => {
    let out = rows; if (search && q.trim()) { const s = q.trim().toLowerCase().replace(/[\s-]/g, ""); out = out.filter((r) => search(r).toLowerCase().replace(/[\s-]/g, "").includes(s)); }
    if (sort) { const c = columns.find((x) => x.key === sort.key); if (c?.sort) { const f = c.sort; out = [...out].sort((a, b) => { const x = f(a), y = f(b); const n = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y)); return sort.dir === "asc" ? n : -n; }); } }
    return out;
  }, [rows, q, sort, columns, search]);
  useEffect(() => setPage(0), [q, rows.length]);
  const pages = Math.max(1, Math.ceil(shown.length / pageSize)); const cur = Math.min(page, pages - 1); const slice = shown.slice(cur * pageSize, cur * pageSize + pageSize);
  return <div>
    {(search || filters || toolbar) && <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
      {search && <div className="relative min-w-[220px] flex-1 max-w-sm"><Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden /><Input aria-label={t("ຄົ້ນຫາ", "Search")} placeholder={t("ຄົ້ນຫາ...", "Search...")} value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" /></div>}
      {filters}<div className="ml-auto flex items-center gap-2">{toolbar}</div>
    </div>}
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead><tr className="border-b border-line-strong bg-surface-2 text-left">{columns.map((c) => <th key={c.key} scope="col" style={{ width: c.width }} className={cx("whitespace-nowrap px-3 py-2 text-xs font-semibold text-ink-2", c === columns[columns.length - 1] && !c.header && "sticky right-0 bg-surface-2", c.align === "right" && "text-right", c.align === "center" && "text-center")}>{c.sort ? <button className="inline-flex items-center gap-1 hover:text-brand" onClick={() => setSort((s) => s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "asc" })}>{c.header}{sort?.key === c.key && (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</button> : c.header}</th>)}</tr></thead>
        <tbody>{slice.map((r) => <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cx("border-b border-line last:border-0", onRowClick ? "cursor-pointer hover:bg-brand-soft/50" : "hover:bg-surface-2/60")}>{columns.map((c) => <td key={c.key} className={cx("px-3 py-2 align-middle", c === columns[columns.length - 1] && !c.header && "sticky right-0 bg-surface shadow-[-8px_0_8px_-8px_rgb(11_42_74/.2)]", c.align === "right" && "text-right tnum", c.align === "center" && "text-center", c.mono && "font-mono text-[13px] whitespace-nowrap")}>{c.render(r)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    {slice.length === 0 && (empty ?? <Empty title={q ? t("ບໍ່ພົບລາຍການທີ່ຄົ້ນຫາ", "Nothing matches your search") : t("ຍັງບໍ່ມີລາຍການ", "Nothing here yet")} />)}
    {shown.length > pageSize && <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-ink-2 no-print"><span className="tnum">{t(`${cur * pageSize + 1}–${Math.min(shown.length, (cur + 1) * pageSize)} ຈາກ ${shown.length}`, `${cur * pageSize + 1}–${Math.min(shown.length, (cur + 1) * pageSize)} of ${shown.length}`)}</span><span className="flex items-center gap-1"><IconButton icon={ChevronLeft} label={t("ກ່ອນໜ້າ", "Previous")} disabled={cur === 0} onClick={() => setPage(cur - 1)} /><span className="tnum px-1">{cur + 1}/{pages}</span><IconButton icon={ChevronRight} label={t("ຖັດໄປ", "Next")} disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} /></span></div>}
  </div>;
}

// ---------- Dialog, built on the native element ----------
export function Dialog({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const ref = useRef<HTMLDialogElement>(null); const t = useT();
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  if (!open) return null;
  const w = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return createPortal(<dialog ref={ref} onCancel={(e) => { e.preventDefault(); onClose(); }} className={cx("w-[calc(100vw-24px)] rounded-lg bg-surface p-0 text-ink shadow-pop", w)}>
    <div className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="text-lg font-semibold">{title}</h2><IconButton icon={X} label={t("ປິດ", "Close")} onClick={onClose} /></div>
    <div className="max-h-[72vh] overflow-y-auto px-5 py-4">{children}</div>
    {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">{footer}</div>}
  </dialog>, document.body);
}
/** Confirm a consequential action, optionally requiring a reason that goes on the audit record. */
export function Confirm({ open, onClose, onConfirm, title, body, confirmLabel, danger, reasonLabel }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void; title: string; body?: ReactNode; confirmLabel: string; danger?: boolean; reasonLabel?: string }) {
  const t = useT(); const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  return <Dialog open={open} onClose={onClose} title={title} size="sm" footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant={danger ? "danger" : "primary"} disabled={!!reasonLabel && !reason.trim()} onClick={() => { onConfirm(reason.trim()); onClose(); }}>{confirmLabel}</Button></>}>
    {body && <div className="mb-3 text-sm">{body}</div>}
    {reasonLabel && <Field label={reasonLabel} required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
  </Dialog>;
}

// ---------- Toast ----------
type ToastItem = { id: number; tone: Tone; text: string };
let pushToast: (t: ToastItem) => void = () => {};
let tid = 0;
export function toast(text: string, tone: Tone = "ok") { pushToast({ id: ++tid, tone, text }); }
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => { pushToast = (x) => { setItems((s) => [...s, x]); setTimeout(() => setItems((s) => s.filter((y) => y.id !== x.id)), 4200); }; }, []);
  return <div aria-live="polite" className="no-print pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-2">{items.map((x) => <div key={x.id} className="pointer-events-auto rounded-md border border-line bg-surface shadow-pop"><Callout tone={x.tone}>{x.text}</Callout></div>)}</div>;
}

// ---------- Print sheet: a preview on screen; only this content reaches paper ----------
export function PrintSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useT();
  useEffect(() => { if (open) document.body.classList.add("printing"); return () => document.body.classList.remove("printing"); }, [open]);
  if (!open) return null;
  return createPortal(<>
    <div className="print-root">{children}</div>
    <div className="no-print fixed inset-0 z-50 flex flex-col bg-navy/70">
      <div className="flex items-center justify-between gap-3 bg-navy px-5 py-2.5 text-white"><div className="font-medium">{title}</div><div className="flex gap-2"><Button variant="primary" onClick={() => window.print()}>{t("ພິມ / ບັນທຶກ PDF", "Print / Save PDF")}</Button><Button onClick={onClose}>{t("ປິດ", "Close")}</Button></div></div>
      <div className="flex-1 overflow-auto p-6"><div className="mx-auto w-[210mm] max-w-full bg-white p-[10mm] text-black shadow-pop">{children}</div></div>
    </div>
  </>, document.body);
}
export function MonoCode({ children, className }: { children: ReactNode; className?: string }) { return <span className={cx("font-mono text-[13px] whitespace-nowrap", className)}>{children}</span>; }
export function BarMeter({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0; const over = max && value > max; const tone = over || pct >= 95 ? "bg-bad" : pct >= 80 ? "bg-[var(--warn)]" : "bg-brand";
  return <div aria-label={label} role="img"><div className="h-2 w-full overflow-hidden rounded-sm bg-[var(--line)]"><div className={cx("h-full rounded-sm", tone)} style={{ width: `${pct}%` }} /></div></div>;
}
