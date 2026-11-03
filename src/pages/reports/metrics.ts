import type { Awb, CashShift, Db, MailBag } from "@/lib/types";
import { dateAdd, isoDate, todayIso } from "@/lib/format";
import { rateToLak, scopeOf } from "@/lib/pricing";
import { monthlyHistory } from "@/lib/history";

/** Local calendar day of a timestamp. */
export const dayOf = (iso: string) => (iso.length === 10 ? iso : isoDate(new Date(iso)));
export const lakOf = (d: Db, amount: number, currency: string) => amount * rateToLak(d, currency);
/** The station that owns an AWB's revenue and workload. */
export const awbStation = (a: Awb) => (a.direction === "export" ? a.origin : a.direction === "import" ? a.dest : a.station);
export const mailStation = (m: MailBag) => (m.direction === "outbound" ? m.origin : m.dest);
export const commodityOf = (a: Awb, lang: "lo" | "en") => a.commodity.split(" / ")[lang === "lo" ? 0 : 1] ?? a.commodity;

/** Counted minus expected, rounded to what a cashier can count. Null until the shift is counted. */
export function shiftDiff(s: CashShift) {
  if (s.countedLak == null || s.expectedLak == null) return null;
  const lak = Math.round(s.countedLak - s.expectedLak); const usd = Math.round(((s.countedUsd ?? 0) - (s.expectedUsd ?? 0)) * 100) / 100;
  return { lak, usd, any: lak !== 0 || usd !== 0 };
}

export type Period = "today" | "7d" | "month" | "year";
export interface Metrics { domLak: number; intLak: number; domKg: number; intKg: number }
const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;
export const periodStart = (p: Period) => { const today = todayIso(); return p === "today" ? today : p === "7d" ? dateAdd(today, -6) : firstOfMonth(today); };

/** Figures recorded in the system from a date on, including mail fees. */
export function liveMetrics(d: Db, from: string, station?: string, to = todayIso()): Metrics {
  const m: Metrics = { domLak: 0, intLak: 0, domKg: 0, intKg: 0 };
  d.awbs.forEach((a) => { const day = dayOf(a.issuedAt); if (a.status === "voided" || day < from || day > to || (station && awbStation(a) !== station)) return; const dom = scopeOf(d, a.origin, a.dest) === "domestic"; const lak = lakOf(d, a.total, a.currency); if (dom) { m.domLak += lak; m.domKg += a.chargeableKg; } else { m.intLak += lak; m.intKg += a.chargeableKg; } });
  d.mail.forEach((x) => { const day = dayOf(x.receivedAt); if (day < from || day > to || (station && mailStation(x) !== station)) return; const lak = lakOf(d, x.fee, x.currency); if (x.scope === "domestic") { m.domLak += lak; m.domKg += x.weightKg; } else { m.intLak += lak; m.intKg += x.weightKg; } });
  return m;
}
/** Figures for a Dashboard period. This year adds the completed months from history to the live current month. */
export function periodMetrics(d: Db, p: Period, station?: string): Metrics {
  const live = liveMetrics(d, periodStart(p), station);
  if (p !== "year") return live;
  const year = new Date().getFullYear();
  monthlyHistory({ station }).filter((x) => x.year === year).forEach((x) => { live.domLak += x.domesticLak; live.intLak += x.internationalLak; live.domKg += x.domesticKg; live.intKg += x.internationalKg; });
  return live;
}
