import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileDown, PlaneTakeoff } from "lucide-react";
import { useDb } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { BarMeter, Button, Col, DataTable, Empty, IconButton, Input, PageHeader, Panel, Select, StatRow } from "@/ui/kit";
import { FlightStatusBadge, Route } from "@/ui/cargo";
import type { Flight, FlightStatus } from "@/lib/types";
import { dateAdd, fmtDate, kg, num, todayIso } from "@/lib/format";
import { flightCapacity } from "@/lib/mock/booking";
import { exportExcel } from "@/lib/export";

export default function Dispatch() {
  const d = useDb(); const t = useT(); const nav = useNavigate(); const st = d.session.station;
  const [date, setDate] = useState(todayIso()); const [status, setStatus] = useState("");
  const day = useMemo(() => d.flights.filter((f) => f.origin === st && f.date === date), [d.flights, st, date]);
  const rows = day.filter((f) => !status || f.status === status);
  const active = (id: string) => d.loads.filter((l) => l.flightId === id && l.status !== "offloaded");
  const totalKg = day.reduce((s, f) => s + flightCapacity(d, f.id).usedKg, 0);
  const tight = day.filter((f) => f.status === "open" && flightCapacity(d, f.id).pct >= 0.8).length;
  const statuses: [FlightStatus, string, string][] = [["open", "ເປີດຮັບ", "Open"], ["closed", "ປິດຮັບ", "Closed"], ["departed", "ອອກບິນແລ້ວ", "Departed"], ["arrived", "ມາຮອດແລ້ວ", "Arrived"], ["cancelled", "ຍົກເລີກ", "Cancelled"]];
  const cols: Col<Flight>[] = [
    { key: "no", header: t("ຖ້ຽວບິນ", "Flight"), mono: true, render: (f) => <span className="font-semibold text-brand">{f.no}</span>, sort: (f) => f.no },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (f) => <Route from={f.origin} to={f.dest} />, sort: (f) => f.dest },
    { key: "ac", header: t("ເຮືອບິນ", "Aircraft"), render: (f) => <span className="whitespace-nowrap">{d.aircraft.find((a) => a.code === f.aircraft)?.nameEn ?? f.aircraft}</span> },
    { key: "std", header: "STD", mono: true, render: (f) => f.std, sort: (f) => f.std },
    { key: "sta", header: "STA", mono: true, render: (f) => f.sta },
    { key: "load", header: t("ນໍ້າໜັກ / ຄວາມຈຸ", "Load / capacity"), width: "240px", render: (f) => { const c = flightCapacity(d, f.id); return <div className="min-w-[180px]"><div className="tnum mb-1 flex justify-between gap-2 text-xs"><span className={c.usedKg > c.maxKg ? "font-semibold text-bad" : ""}>{num(c.usedKg)} / {num(c.maxKg)} kg</span><span className="text-ink-2">{Math.round(c.pct * 100)}%</span></div><BarMeter value={c.usedKg} max={c.maxKg} label={t("ນໍ້າໜັກເທິງຖ້ຽວບິນ", "Flight load")} /></div>; }, sort: (f) => flightCapacity(d, f.id).pct },
    { key: "awbs", header: "AWB", align: "right", render: (f) => active(f.id).length, sort: (f) => active(f.id).length },
    { key: "loaded", header: t("ສະແກນແລ້ວ", "Scanned"), align: "right", render: (f) => { const a = active(f.id); return `${a.filter((l) => l.status === "loaded").length}/${a.length}`; } },
    { key: "mail", header: t("ຖົງເມ", "Mail"), align: "right", render: (f) => { const m = d.mail.filter((x) => x.flightId === f.id).reduce((s, x) => s + x.bags, 0); return m || ""; } },
    { key: "status", header: t("ສະຖານະ", "Status"), render: (f) => <FlightStatusBadge status={f.status} />, sort: (f) => f.status },
  ];
  return <>
    <PageHeader title={t("ຖ້ຽວບິນ ແລະ Manifest", "Flights & manifest")} subtitle={t(`ຖ້ຽວບິນອອກຈາກ ${st} ວັນທີ ${fmtDate(date)}`, `Flights leaving ${st} on ${fmtDate(date)}`)} actions={<Button icon={FileDown} disabled={!rows.length} onClick={() => exportExcel(t("ຖ້ຽວບິນປະຈໍາວັນ", "Daily flights"), `Flights-${st}-${date}`, [{ header: "Flight", value: (f: Flight) => f.no }, { header: "Route", value: (f) => `${f.origin}-${f.dest}` }, { header: "Aircraft", value: (f) => f.aircraft }, { header: "STD", value: (f) => f.std }, { header: "STA", value: (f) => f.sta }, { header: "Committed kg", value: (f) => flightCapacity(d, f.id).usedKg }, { header: "Capacity kg", value: (f) => flightCapacity(d, f.id).maxKg }, { header: "AWBs", value: (f) => active(f.id).length }, { header: "Status", value: (f) => f.status }], rows, `${st} ${date}`)}>{t("Export Excel", "Export Excel")}</Button>} />
    <StatRow items={[
      { label: t("ຖ້ຽວບິນ", "Flights"), value: day.length, sub: t(`${day.filter((f) => f.status === "open").length} ເປີດຮັບ`, `${day.filter((f) => f.status === "open").length} open`) },
      { label: t("ນໍ້າໜັກລວມ", "Total load"), value: kg(totalKg) },
      { label: t("ຖ້ຽວທີ່ໃກ້ເຕັມ", "Flights near full"), value: tight, sub: t("ເກີນ 80% ຂອງຄວາມຈຸ", "Over 80% of capacity"), tone: tight ? "warn" : undefined },
      { label: t("AWB ຍັງບໍ່ສະແກນ", "AWBs not yet scanned"), value: day.reduce((s, f) => s + active(f.id).filter((l) => l.status === "planned").length, 0) },
    ]} />
    <Panel flush>
      <DataTable rows={rows} columns={cols} rowKey={(f) => f.id} minWidth={1000} pageSize={20} defaultSort={{ key: "std", dir: "asc" }} onRowClick={(f) => nav(`/export/dispatch/${f.id}`)} search={(f) => `${f.no} ${f.dest}`}
        filters={<>
          <span className="flex items-center gap-1"><IconButton icon={ChevronLeft} label={t("ມື້ກ່ອນ", "Previous day")} onClick={() => setDate(dateAdd(date, -1))} /><Input type="date" aria-label={t("ວັນທີ", "Date")} className="w-[150px]" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /><IconButton icon={ChevronRight} label={t("ມື້ຖັດໄປ", "Next day")} onClick={() => setDate(dateAdd(date, 1))} /></span>
          {date !== todayIso() && <Button size="sm" onClick={() => setDate(todayIso())}>{t("ມື້ນີ້", "Today")}</Button>}
          <Select aria-label={t("ສະຖານະ", "Status")} className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t("ທຸກສະຖານະ", "All statuses")} options={statuses.map(([k, lo, en]) => ({ value: k, label: t(lo, en) }))} />
        </>}
        empty={<Empty icon={PlaneTakeoff} title={t(`ບໍ່ມີຖ້ຽວບິນຈາກ ${st} ໃນວັນທີນີ້`, `No flights from ${st} on this date`)}>{t("ເລືອກວັນທີອື່ນ ຫຼື ປ່ຽນສະຖານີດ້ານເທິງ. ເພີ່ມຖ້ຽວບິນໄດ້ໃນຂໍ້ມູນພື້ນຖານ.", "Pick another date or change the station at the top. Flights are added in master data.")}</Empty>} />
    </Panel>
  </>;
}
