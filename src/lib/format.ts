export const num = (n: number, d = 0) => (Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
export const kg = (n: number) => `${num(n, n % 1 ? 1 : 0)} kg`;
export function money(n: number, c = "LAK") { return c === "LAK" ? `${num(Math.round(n))} ₭` : c === "USD" ? `$${num(n, 2)}` : `${num(n, 2)} ${c}`; }
export const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => isoDate(new Date());
export function dateAdd(iso: string, days: number) { const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso); d.setDate(d.getDate() + days); return isoDate(d); }
export function fmtDate(iso?: string) { if (!iso) return "—"; const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }
export function fmtTime(iso?: string) { if (!iso) return "—"; const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function fmtDateTime(iso?: string) { return iso ? `${fmtDate(iso)} ${fmtTime(iso)}` : "—"; }
export function daysBetween(fromIso: string, toIso: string) { const a = new Date(fromIso.slice(0, 10) + "T00:00:00").getTime(); const b = new Date(toIso.slice(0, 10) + "T00:00:00").getTime(); return Math.round((b - a) / 86400000); }
