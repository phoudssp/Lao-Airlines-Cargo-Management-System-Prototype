// Monthly history behind the Dashboard and the comparison reports.
// Pure and deterministic: the same month and station always give the same figures.

export interface MonthPoint { ym: string; year: number; month: number; domesticLak: number; internationalLak: number; domesticKg: number; internationalKg: number }

// Rainy season dips, with peaks around Lao New Year in April and the year-end trade.
const SEASON = [0.97, 1.0, 1.04, 1.12, 0.98, 0.93, 0.88, 0.86, 0.92, 1.0, 1.06, 1.2];
const DOMESTIC_SHARE: Record<string, number> = { VTE: 0.58, LPQ: 0.17, PKZ: 0.13, ZVK: 0.07, XKH: 0.03, ODY: 0.02 };
const INTERNATIONAL_SHARE: Record<string, number> = { VTE: 0.74, PKZ: 0.08, BKK: 0.07, HAN: 0.05, KMG: 0.04, SGN: 0.02 };
const ROUTE_SHARE: { route: string; scope: "domestic" | "international"; share: number }[] = [
  { route: "VTE-LPQ", scope: "domestic", share: 0.22 }, { route: "LPQ-VTE", scope: "domestic", share: 0.14 }, { route: "VTE-PKZ", scope: "domestic", share: 0.2 }, { route: "PKZ-VTE", scope: "domestic", share: 0.14 },
  { route: "VTE-ZVK", scope: "domestic", share: 0.12 }, { route: "ZVK-VTE", scope: "domestic", share: 0.08 }, { route: "VTE-XKH", scope: "domestic", share: 0.06 }, { route: "XKH-VTE", scope: "domestic", share: 0.04 },
  { route: "VTE-BKK", scope: "international", share: 0.26 }, { route: "BKK-VTE", scope: "international", share: 0.24 }, { route: "VTE-HAN", scope: "international", share: 0.12 }, { route: "HAN-VTE", scope: "international", share: 0.12 },
  { route: "VTE-KMG", scope: "international", share: 0.1 }, { route: "KMG-VTE", scope: "international", share: 0.11 }, { route: "PKZ-SGN", scope: "international", share: 0.03 }, { route: "SGN-PKZ", scope: "international", share: 0.02 },
];

/** Stable noise in the range -1..1 for a month and a series. */
function noise(index: number, salt: number) { const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; }
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** The last 24 completed months, oldest first. Without a station the figures cover the whole network. */
export function monthlyHistory(opts: { station?: string; now?: Date } = {}): MonthPoint[] {
  const now = opts.now ?? new Date();
  const domShare = opts.station ? DOMESTIC_SHARE[opts.station] ?? 0 : 1; const intShare = opts.station ? INTERNATIONAL_SHARE[opts.station] ?? 0 : 1;
  const out: MonthPoint[] = [];
  for (let back = 24; back >= 1; back--) {
    const when = new Date(now.getFullYear(), now.getMonth() - back, 1); const year = when.getFullYear(); const month = when.getMonth() + 1;
    const index = (year - 2020) * 12 + month - 1; const growth = 1 + (index - 48) * 0.006; const season = SEASON[month - 1];
    const domKg = 24000 * growth * season * (1 + noise(index, 1) * 0.07); const intKg = 30000 * growth * season * (1 + noise(index, 2) * 0.09);
    const domYield = 16000 * (1 + noise(index, 3) * 0.03); const intYield = 33000 * (1 + noise(index, 4) * 0.04);
    out.push({ ym: `${year}-${String(month).padStart(2, "0")}`, year, month, domesticLak: roundTo(domKg * domYield * domShare, 10000), internationalLak: roundTo(intKg * intYield * intShare, 10000), domesticKg: roundTo(domKg * domShare, 10), internationalKg: roundTo(intKg * intShare, 10) });
  }
  return out;
}
/** Short month label such as 10/26. */
export const monthLabel = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(2, 4)}`;
/** Spread monthly weight over the route network; with a station, only the routes touching it. */
export function historyRouteKg(points: MonthPoint[], station?: string): Record<string, number> {
  const out: Record<string, number> = {};
  (["domestic", "international"] as const).forEach((scope) => {
    const routes = ROUTE_SHARE.filter((r) => r.scope === scope && (!station || r.route.split("-").includes(station)));
    const whole = routes.reduce((s, r) => s + r.share, 0); if (!whole) return;
    const kg = points.reduce((s, p) => s + (scope === "domestic" ? p.domesticKg : p.internationalKg), 0);
    routes.forEach((r) => { out[r.route] = (out[r.route] ?? 0) + (kg * r.share) / whole; });
  });
  return out;
}
