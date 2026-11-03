import type { ChargeLine, Db, PieceLine, Scope, Tariff } from "./types";
import { daysBetween, todayIso } from "./format";

/** Volumetric weight per the RFQ: L x W x H / 6000 (cm to kg). */
export function volumetricKg(lines: PieceLine[]) { return lines.reduce((s, l) => s + (l.lengthCm * l.widthCm * l.heightCm * l.pieces) / 6000, 0); }
export function grossKg(lines: PieceLine[]) { return lines.reduce((s, l) => s + l.weightKg, 0); }
export function pieceCount(lines: PieceLine[]) { return lines.reduce((s, l) => s + l.pieces, 0); }
/** Weights round up to the next half kilogram. */
export function roundUpHalf(n: number) { return Math.ceil(n * 2) / 2; }
export function chargeable(lines: PieceLine[]) { const gross = grossKg(lines); const vol = volumetricKg(lines); const higher = Math.max(gross, vol); return { gross, vol, higher, chargeable: roundUpHalf(higher), usesVolume: vol > gross }; }

export function isEffective(t: Tariff, on: string) { return t.status === "approved" && t.effectiveFrom <= on && (!t.effectiveTo || t.effectiveTo >= on); }
export function scopeOf(d: Db, origin: string, dest: string): Scope { const a = d.stations.find((s) => s.code === origin); const b = d.stations.find((s) => s.code === dest); return a?.scope === "international" || b?.scope === "international" ? "international" : "domestic"; }

/** The freight rate in force for a route; a special cargo code selects its special rate when one exists. */
export function findFreightRate(d: Db, origin: string, dest: string, shc: string[], on = todayIso()): Tariff | undefined {
  const live = d.tariffs.filter((t) => isEffective(t, on));
  const forRoute = (t: Tariff) => (t.origin === origin && t.dest === dest) || (t.origin === dest && t.dest === origin);
  const special = live.find((t) => t.category === "special" && t.shc && shc.includes(t.shc) && forRoute(t));
  return special ?? live.find((t) => t.category === "general" && forRoute(t));
}
export function serviceTariffs(d: Db, scope: Scope, on = todayIso()) { return d.tariffs.filter((t) => t.category === "service" && t.scope === scope && isEffective(t, on)); }

let seq = 0;
const lineId = () => `CL-${Date.now().toString(36)}-${seq++}`;
export function priceFreight(rate: Tariff, chargeableKg: number): ChargeLine {
  const amount = Math.max(rate.rate * chargeableKg, rate.minCharge);
  return { id: lineId(), tariffId: rate.id, code: rate.code, nameLo: rate.nameLo, nameEn: rate.nameEn, amount, currency: rate.currency, kind: "freight" };
}
export function priceService(t: Tariff, chargeableKg: number, freight: number): ChargeLine {
  const raw = t.basis === "percent" ? (freight * t.rate) / 100 : t.basis === "per_kg" ? t.rate * chargeableKg : t.rate;
  return { id: lineId(), tariffId: t.id, code: t.code, nameLo: t.nameLo, nameEn: t.nameEn, amount: Math.max(raw, t.minCharge), currency: t.currency, kind: "service" };
}

/** Storage fee: no charge for same-day pickup; otherwise chargeable kg x days beyond the free period. */
export function storageFee(d: Db, opts: { scope: Scope; chargeableKg: number; arrivedAt: string; on?: string; shc?: string[] }) {
  const on = opts.on ?? todayIso();
  const days = Math.max(0, daysBetween(opts.arrivedAt, on));
  const t = d.tariffs.find((x) => x.category === "storage" && x.scope === opts.scope && isEffective(x, on));
  if (!t) return { days, billableDays: 0, fee: 0, currency: "LAK", tariff: undefined as Tariff | undefined, sameDay: days === 0 };
  if (days === 0) return { days, billableDays: 0, fee: 0, currency: t.currency, tariff: t, sameDay: true };
  const billableDays = Math.max(0, days - (t.freeDays ?? 0));
  const fee = billableDays > 0 ? Math.max(t.rate * opts.chargeableKg * billableDays, t.minCharge) : 0;
  return { days, billableDays, fee, currency: t.currency, tariff: t, sameDay: false };
}

/** Exchange rate approved and in force on the date (LAK per 1 unit). */
export function rateToLak(d: Db, currency: string, on = todayIso()) {
  if (currency === "LAK") return 1;
  const r = d.rates.filter((x) => x.currency === currency && x.status === "approved" && x.effectiveFrom <= on).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  return r?.toLak ?? 0;
}
export function agingBand(days: number) { return days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 85 ? "61-85" : days <= 90 ? "86-90" : "90+"; }
export const AGING_BANDS = ["0-30", "31-60", "61-85", "86-90", "90+"] as const;
/** AWB serial: 7 digits plus a modulo-7 check digit. */
export function withCheckDigit(seven: number) { const s = String(seven).padStart(7, "0"); return s + String(seven % 7); }
export const awbNo = (prefix: string, serial: string) => `${prefix}-${serial.slice(0, 4)} ${serial.slice(4)}`;
export const STAGES = ["BKD", "RCS", "SCR", "MAN", "DEP", "ARR", "RCF", "NFD", "CUS", "DLV"] as const;
