import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronRight, PackageX, Banknote, ShieldCheck, Stamp, Hourglass, type LucideIcon } from "lucide-react";
import { useDb } from "@/lib/store";
import { useLang, useName, useT } from "@/lib/i18n";
import { Badge, BarMeter, Col, DataTable, Empty, MonoCode, PageHeader, Panel, Select, StatRow, cx } from "@/ui/kit";
import { FlightStatusBadge, Route, stageName } from "@/ui/cargo";
import { STAGES } from "@/lib/pricing";
import { zoneLoad } from "@/lib/mock/ops";
import { daysBetween, num, todayIso } from "@/lib/format";
import { historyRouteKg, monthLabel, monthlyHistory } from "@/lib/history";
import type { Db, Flight, StageCode, Station } from "@/lib/types";
import { abbrLak, DOMESTIC, fullKg, fullLak, GroupedColumns, HorizontalBars, INTERNATIONAL, tons } from "./charts";
import { awbStation, dayOf, liveMetrics, periodMetrics, periodStart, shiftDiff, type Period } from "./metrics";

const STAGE_LINK: Record<StageCode, string> = { BKD: "/export/awb", RCS: "/export/screening", SCR: "/export/dispatch", MAN: "/export/dispatch", DEP: "/export/dispatch", ARR: "/import/arrivals", RCF: "/wms/storage", NFD: "/import/arrivals", CUS: "/import/customs", DLV: "/import/delivery" };

function warehouseUse(d: Db, station?: string) {
  const zones = d.zones.filter((z) => z.active && (!station || z.station === station)).map((z) => ({ z, kg: zoneLoad(d, z.id).kg }));
  const used = zones.reduce((s, x) => s + x.kg, 0); const cap = zones.reduce((s, x) => s + x.z.capacityKg, 0);
  return { zones, used, cap, pct: cap ? (used / cap) * 100 : 0 };
}
/** Open problems, each counted where staff can act on them. */
function exceptionCounts(d: Db, station?: string) {
  const today = todayIso(); const active = d.awbs.filter((a) => a.status === "active" && (!station || awbStation(a) === station));
  const offloads = active.filter((a) => a.offloadedPieces > 0 && !["DEP", "ARR", "RCF", "NFD", "CUS", "DLV"].includes(a.stage));
  const damage = d.irregularities.filter((r) => r.status !== "closed" && (!station || r.station === station));
  const over90 = active.filter((a) => a.direction === "import" && a.stage !== "DLV" && a.arrivedAt && daysBetween(a.arrivedAt, today) > 90);
  const cash = d.shifts.filter((s) => s.status !== "open" && (!station || s.station === station) && shiftDiff(s)?.any && s.status !== "handed_over");
  const rates = d.rates.filter((r) => r.status === "pending").length; const tariffs = d.tariffs.filter((r) => r.status === "pending").length;
  const bookings = d.bookings.filter((b) => b.status === "requested" && (!station || b.origin === station)).length; const handovers = d.shifts.filter((s) => s.status === "closed" && s.handedTo && (!station || s.station === station)).length;
  const xray = active.filter((a) => a.direction === "export" && a.stage === "RCS");
  return { offloads: offloads.length, damage: damage.length, over90: over90.length, cash: cash.length, approvals: rates + tariffs + bookings + handovers, rates, tariffs, bookings, handovers, xray: xray.length };
}
const pctChange = (now: number, before: number) => (before ? ((now - before) / before) * 100 : 0);
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function ExceptionRow({ icon: Icon, label, detail, count, to, tone }: { icon: LucideIcon; label: string; detail?: React.ReactNode; count: number; to: string; tone: "bad" | "warn" }) {
  const t = useT(); const clear = count === 0;
  return <li className="flex items-center gap-2.5 border-b border-line px-4 py-2 last:border-0">
    <Icon size={16} aria-hidden className={clear ? "shrink-0 text-ink-3" : tone === "bad" ? "shrink-0 text-bad" : "shrink-0 text-warn"} />
    <div className="min-w-0 flex-1"><Link to={to} className="text-sm font-medium hover:text-brand hover:underline">{label}</Link>{detail && <div className="text-xs text-ink-2">{detail}</div>}</div>
    {clear ? <Badge tone="ok">{t("ບໍ່ມີ", "None")}</Badge> : <Badge tone={tone}><span className="tnum">{count}</span></Badge>}
    <Link to={to} aria-label={label} className="text-ink-3 hover:text-brand"><ChevronRight size={16} aria-hidden /></Link>
  </li>;
}

export default function Dashboard() {
  const d = useDb(); const t = useT(); const name = useName(); const lang = useLang();
  const [period, setPeriod] = useState<Period>("7d"); const [station, setStation] = useState("");
  const st = station || undefined; const today = todayIso();
  const m = useMemo(() => periodMetrics(d, period, st), [d, period, st]);
  const wh = useMemo(() => warehouseUse(d, st), [d, st]);
  const ex = useMemo(() => exceptionCounts(d, st), [d, st]);
  const history = useMemo(() => monthlyHistory({ station: st }), [st]);
  const openProblems = ex.offloads + ex.damage + ex.over90 + ex.cash + ex.approvals + ex.xray;
  const rev = m.domLak + m.intLak; const weight = m.domKg + m.intKg;

  // Last 11 completed months plus the current month to date from live records.
  const thisMonth = useMemo(() => liveMetrics(d, periodStart("month"), st), [d, st]);
  const months = [...history.slice(-11).map((p) => ({ key: p.ym, label: monthLabel(p.ym), values: [p.domesticLak, p.internationalLak] })), { key: today.slice(0, 7), label: `${monthLabel(today.slice(0, 7))}*`, fullLabel: `${monthLabel(today.slice(0, 7))} ${t("ຮອດມື້ນີ້", "to date")}`, values: [thisMonth.domLak, thisMonth.intLak] }];
  const lastFull = history[history.length - 1]; const prevFull = history[history.length - 2]; const yearAgo = history[history.length - 13];
  const total = (p: typeof lastFull) => p.domesticLak + p.internationalLak;

  const routes = useMemo(() => {
    const out: Record<string, number> = {}; const from = periodStart(period);
    d.awbs.forEach((a) => { const day = dayOf(a.issuedAt); if (a.status === "voided" || day < from || (st && awbStation(a) !== st)) return; const k = `${a.origin}-${a.dest}`; out[k] = (out[k] ?? 0) + a.chargeableKg; });
    if (period === "year") { const year = new Date().getFullYear(); Object.entries(historyRouteKg(history.filter((p) => p.year === year), st)).forEach(([k, v]) => { out[k] = (out[k] ?? 0) + v; }); }
    return Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, value]) => ({ key: k, label: k.replace("-", " → "), value }));
  }, [d.awbs, period, st, history]);

  const statusCount = STAGES.map((s) => ({ s, n: d.awbs.filter((a) => a.status === "active" && a.stage === s && (!st || awbStation(a) === st)).length }));
  const periodName = { today: t("ມື້ນີ້", "Today"), "7d": t("7 ວັນ", "7 days"), month: t("ເດືອນນີ້", "This month"), year: t("ປີນີ້", "This year") };

  const stationRows = useMemo(() => d.stations.filter((s) => s.active).map((s) => { const x = periodMetrics(d, period, s.code); const w = warehouseUse(d, s.code); const e = exceptionCounts(d, s.code); return { s, rev: x.domLak + x.intLak, kg: x.domKg + x.intKg, wh: w, problems: e.offloads + e.damage + e.over90 + e.cash + e.bookings + e.handovers + e.xray }; }), [d, period]);
  type SRow = (typeof stationRows)[number];
  const stationCols: Col<SRow>[] = [
    { key: "code", header: t("ສະຖານີ", "Station"), render: (r) => <span className="whitespace-nowrap"><MonoCode className="font-semibold">{r.s.code}</MonoCode> <span className="text-ink-2">{name(r.s as Station)}</span></span>, sort: (r) => r.s.code },
    { key: "rev", header: t("ລາຍຮັບ", "Revenue"), align: "right", render: (r) => <span className="whitespace-nowrap">{abbrLak(r.rev)}</span>, sort: (r) => r.rev },
    { key: "kg", header: t("ນໍ້າໜັກ", "Weight"), align: "right", render: (r) => <span className="whitespace-nowrap">{tons(r.kg)}</span>, sort: (r) => r.kg },
    { key: "wh", header: t("ໃຊ້ສາງ", "Warehouse"), align: "right", render: (r) => r.wh.cap ? `${Math.round(r.wh.pct)}%` : <span className="text-ink-3">—</span>, sort: (r) => r.wh.pct },
    { key: "problems", header: t("ບັນຫາ", "Problems"), align: "right", render: (r) => r.problems ? <Badge tone="warn"><span className="tnum">{r.problems}</span></Badge> : <span className="text-ink-3">0</span>, sort: (r) => r.problems },
  ];
  const flightLoad = (f: Flight) => { const list = d.loads.filter((l) => l.flightId === f.id && l.status !== "offloaded"); return { kg: list.reduce((s, l) => s + l.weightKg, 0), awbs: list.length, cap: d.aircraft.find((a) => a.code === f.aircraft)?.maxCargoKg ?? 0 }; };
  const todayFlights = d.flights.filter((f) => f.date === today && f.status !== "cancelled" && (!st || f.origin === st || f.dest === st));
  const flightCols: Col<Flight>[] = [
    { key: "no", header: t("ຖ້ຽວບິນ", "Flight"), render: (f) => <span className="block leading-5"><Link to={`/export/dispatch/${f.id}`} className="font-mono text-[13px] font-semibold text-brand hover:underline">{f.no}</Link><span className="block text-xs text-ink-2 tnum">STD {f.std}</span></span>, sort: (f) => f.std },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (f) => <Route from={f.origin} to={f.dest} /> },
    { key: "load", header: t("ໂຫຼດ / ຄວາມຈຸ", "Load / capacity"), render: (f) => { const l = flightLoad(f); return <div className="min-w-[130px]"><BarMeter value={l.kg} max={l.cap} label={t(`ໂຫຼດ ${Math.round((l.kg / (l.cap || 1)) * 100)}%`, `Load ${Math.round((l.kg / (l.cap || 1)) * 100)}%`)} /><div className="mt-0.5 text-xs text-ink-2 tnum">{num(l.kg)} / {num(l.cap)} kg · {l.awbs} AWB</div></div>; }, sort: (f) => flightLoad(f).kg },
    { key: "status", header: t("ສະຖານະ", "Status"), render: (f) => <FlightStatusBadge status={f.status} /> },
  ];
  const stationName = st ? name(d.stations.find((s) => s.code === st)) : t("ທຸກສະຖານີ", "All stations");
  return <>
    <PageHeader title={t("Dashboard ຜູ້ບໍລິຫານ", "Executive Dashboard")} subtitle={t(`ລາຍຮັບ, ນໍ້າໜັກ, ການໃຊ້ສາງ ແລະ ບັນຫາ · ${stationName}`, `Revenue, weight, warehouse use and problems · ${stationName}`)} actions={<>
      <div role="group" aria-label={t("ຊ່ວງເວລາ", "Period")} className="inline-flex rounded border border-line-strong bg-surface">
        {(["today", "7d", "month", "year"] as Period[]).map((p) => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={cx("h-9 border-r border-line-strong px-3 text-sm font-medium last:border-r-0 first:rounded-l last:rounded-r", period === p ? "bg-brand text-white" : "text-ink-2 hover:bg-surface-2")}>{periodName[p]}</button>)}
      </div>
      <Select aria-label={t("ສະຖານີ", "Station")} className="w-auto" value={station} onChange={(e) => setStation(e.target.value)} placeholder={t("ທຸກສະຖານີ", "All stations")} options={d.stations.filter((s) => s.active).map((s) => ({ value: s.code, label: `${s.code} ${name(s)}` }))} />
    </>} />
    <StatRow items={[
      { label: t(`ລາຍຮັບ (${periodName[period]})`, `Revenue (${periodName[period]})`), value: abbrLak(rev), sub: <><span className="whitespace-nowrap">{t("ພາຍໃນ", "Domestic")} {abbrLak(m.domLak)}</span> · <span className="whitespace-nowrap">{t("ຕ່າງປະເທດ", "International")} {abbrLak(m.intLak)}</span></>, to: "/reports" },
      { label: t(`ນໍ້າໜັກ (${periodName[period]})`, `Weight (${periodName[period]})`), value: tons(weight), sub: <><span className="whitespace-nowrap">{t("ພາຍໃນ", "Domestic")} {tons(m.domKg)}</span> · <span className="whitespace-nowrap">{t("ຕ່າງປະເທດ", "International")} {tons(m.intKg)}</span></>, to: "/reports" },
      { label: t("ການໃຊ້ສາງ", "Warehouse use"), value: wh.cap ? `${Math.round(wh.pct)}%` : "—", sub: wh.cap ? `${tons(wh.used)} / ${tons(wh.cap)}` : t("ສະຖານີນີ້ບໍ່ມີສາງ", "No warehouse at this station"), tone: wh.pct >= 95 ? "bad" : wh.pct >= 80 ? "warn" : undefined, to: "/wms/storage" },
      { label: t("ບັນຫາທີ່ຕ້ອງຈັດການ", "Open problems"), value: openProblems, sub: t("ລາຍລະອຽດຢູ່ລຸ່ມ", "Listed below"), tone: openProblems ? "bad" : "ok" },
    ]} />
    <Panel className="mb-4" flush title={t("ສິນຄ້າຕາມສະຖານະ ປັດຈຸບັນ", "Cargo by status, right now")}>
      <ol className="grid grid-cols-5 lg:grid-cols-10">{statusCount.map(({ s, n }) => <li key={s} className="border-b border-r border-line last:border-r-0 lg:border-b-0"><Link to={STAGE_LINK[s]} className="block px-2 py-2 hover:bg-brand-soft/60" title={stageName(t, s)}><div className="font-mono text-xs font-semibold text-ink-2">{s}</div><div className="tnum text-xl font-semibold leading-7">{n}</div><div className="truncate text-xs text-ink-2">{stageName(t, s)}</div></Link></li>)}</ol>
    </Panel>
    <div className="mb-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <Panel title={t("ລາຍຮັບລາຍເດືອນ 12 ເດືອນຫຼ້າສຸດ", "Revenue by month, last 12 months")}>
        <GroupedColumns title={t("ລາຍຮັບລາຍເດືອນ ພາຍໃນ ແລະ ຕ່າງປະເທດ", "Monthly revenue, domestic and international")} data={months} series={[{ name: t("ພາຍໃນ", "Domestic"), color: DOMESTIC }, { name: t("ຕ່າງປະເທດ", "International"), color: INTERNATIONAL }]} axisFmt={abbrLak} fullFmt={fullLak} footnote={t(`* ເດືອນນີ້ຮອດມື້ນີ້. ${monthLabel(lastFull.ym)} ທຽບເດືອນກ່ອນ ${signed(pctChange(total(lastFull), total(prevFull)))}, ທຽບປີກ່ອນ ${signed(pctChange(total(lastFull), total(yearAgo)))}.`, `* This month to date. ${monthLabel(lastFull.ym)} against the month before ${signed(pctChange(total(lastFull), total(prevFull)))}, against a year ago ${signed(pctChange(total(lastFull), total(yearAgo)))}.`)} />
      </Panel>
      <Panel flush title={t("ບັນຫາທີ່ຕ້ອງຈັດການ", "Open problems")}>
        <ul>
          <ExceptionRow icon={PackageX} tone="bad" label={t("ສິນຄ້າຖືກອ໋ອບໂຫຼດ", "Offloaded cargo")} detail={t("ລໍຖ້າຖ້ຽວບິນໃໝ່", "Waiting for a new flight")} count={ex.offloads} to="/export/dispatch" />
          <ExceptionRow icon={AlertTriangle} tone="bad" label={t("ເສຍຫາຍ ແລະ ຜິດປົກກະຕິ", "Damage and irregularities")} detail={t("ລາຍງານທີ່ຍັງບໍ່ປິດ", "Reports not yet closed")} count={ex.damage} to="/wms/irregularities" />
          <ExceptionRow icon={Hourglass} tone="bad" label={t("ສິນຄ້າຄ້າງສາງເກີນ 90 ວັນ", "Cargo over 90 days")} detail={t("ຍັງບໍ່ມີຄົນມາຮັບ", "Not yet collected")} count={ex.over90} to="/import/aging" />
          <ExceptionRow icon={Banknote} tone="bad" label={t("ເງິນສົດມີສ່ວນຕ່າງ", "Cash differences")} detail={t("ກະທີ່ຍັງບໍ່ໄດ້ມອບ", "Shifts not yet handed over")} count={ex.cash} to="/finance/cash" />
          <ExceptionRow icon={Stamp} tone="warn" label={t("ລໍຖ້າອະນຸມັດ", "Pending approvals")} count={ex.approvals} to={ex.rates ? "/master/currency" : ex.tariffs ? "/master/tariffs" : ex.bookings ? "/bookings" : "/finance/cash"} detail={<span className="inline-flex flex-wrap gap-x-2">
            {ex.rates > 0 && <Link className="hover:text-brand hover:underline" to="/master/currency">{t(`ອັດຕາແລກປ່ຽນ ${ex.rates}`, `Rates ${ex.rates}`)}</Link>}
            {ex.tariffs > 0 && <Link className="hover:text-brand hover:underline" to="/master/tariffs">{t(`ຄ່າບໍລິການ ${ex.tariffs}`, `Tariffs ${ex.tariffs}`)}</Link>}
            {ex.bookings > 0 && <Link className="hover:text-brand hover:underline" to="/bookings">{t(`ການຈອງ ${ex.bookings}`, `Bookings ${ex.bookings}`)}</Link>}
            {ex.handovers > 0 && <Link className="hover:text-brand hover:underline" to="/finance/cash">{t(`ມອບເງິນ ${ex.handovers}`, `Handovers ${ex.handovers}`)}</Link>}
          </span>} />
          <ExceptionRow icon={ShieldCheck} tone="warn" label={t("ລໍຖ້າກວດ X-Ray", "Waiting for X-Ray")} detail={t("ຮັບເຄື່ອງແລ້ວ ຍັງບໍ່ກວດ", "Accepted, not yet screened")} count={ex.xray} to="/export/screening" />
        </ul>
      </Panel>
    </div>
    <div className="mb-4 grid items-start gap-4 lg:grid-cols-2">
      <Panel title={t(`ນໍ້າໜັກຕາມເສັ້ນທາງ (${periodName[period]})`, `Tonnage by route (${periodName[period]})`)}>
        {routes.length ? <HorizontalBars data={routes} title={t("ນໍ້າໜັກຄິດເງິນ ຕາມເສັ້ນທາງ", "Chargeable weight by route")} labelHeader={t("ເສັ້ນທາງ", "Route")} axisFmt={tons} fullFmt={fullKg} /> : <Empty title={t("ບໍ່ມີສິນຄ້າໃນຊ່ວງນີ້", "No cargo in this period")}>{t("ເລືອກຊ່ວງເວລາທີ່ຍາວຂຶ້ນ ຫຼື ທຸກສະຖານີ.", "Choose a longer period or all stations.")}</Empty>}
      </Panel>
      <Panel flush title={t("ການໃຊ້ສາງຕາມໂຊນ", "Warehouse use by zone")} actions={<Link to="/wms/storage" className="text-sm text-brand hover:underline">{t("ເປີດໂຊນ", "Open zones")}</Link>}>
        {wh.zones.length ? <ul>{wh.zones.map(({ z, kg }) => { const pct = z.capacityKg ? (kg / z.capacityKg) * 100 : 0; return <li key={z.id} className="grid grid-cols-[minmax(0,1.5fr)_minmax(80px,1fr)_auto] items-center gap-3 border-b border-line px-4 py-1.5 last:border-0">
          <span className="min-w-0 truncate text-sm"><MonoCode className="font-semibold">{z.station} {z.code}</MonoCode> <span className="text-ink-2">{name(z)}</span></span>
          <BarMeter value={kg} max={z.capacityKg} label={t(`ໃຊ້ ${Math.round(pct)}%`, `${Math.round(pct)}% used`)} />
          <span className="flex w-[104px] items-center justify-end gap-1.5 text-xs tnum">{pct >= 95 ? <Badge tone="bad">{Math.round(pct)}%</Badge> : pct >= 80 ? <Badge tone="warn">{Math.round(pct)}%</Badge> : <span className="font-medium">{Math.round(pct)}%</span>}<span className="text-ink-2">{tons(kg)}</span></span>
        </li>; })}</ul> : <Empty title={t("ສະຖານີນີ້ບໍ່ມີໂຊນສາງ", "This station has no warehouse zones")}>{t("ເລືອກສະຖານີອື່ນ ຫຼື ທຸກສະຖານີ.", "Choose another station or all stations.")}</Empty>}
      </Panel>
    </div>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Panel flush title={t("ຕາມສະຖານີ", "By station")}>
        <DataTable rows={stationRows} columns={stationCols} rowKey={(r) => r.s.code} minWidth={480} pageSize={10} defaultSort={{ key: "rev", dir: "desc" }} onRowClick={(r) => setStation(r.s.code === station ? "" : r.s.code)} />
      </Panel>
      <Panel flush title={t("ຖ້ຽວບິນມື້ນີ້", "Today's flights")} actions={<Link to="/export/dispatch" className="text-sm text-brand hover:underline">{t("ເປີດຖ້ຽວບິນ", "Open flights")}</Link>}>
        <DataTable key={lang} rows={todayFlights} columns={flightCols} rowKey={(f) => f.id} minWidth={460} pageSize={7} defaultSort={{ key: "no", dir: "asc" }} empty={<Empty icon={CheckCircle2} title={t("ມື້ນີ້ບໍ່ມີຖ້ຽວບິນຂອງສະຖານີນີ້", "No flights at this station today")}>{t("ເລືອກທຸກສະຖານີ ເພື່ອເບິ່ງຖ້ຽວບິນທັງໝົດ.", "Choose all stations to see every flight.")}</Empty>} />
      </Panel>
    </div>
  </>;
}
