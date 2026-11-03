import { useMemo, useState } from "react";
import { ScanLine, Truck } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { Badge, BarMeter, Button, Callout, Col, DataTable, Dialog, Dl, Empty, Field, Input, PageHeader, Panel, Select, StatRow, Tabs, toast } from "@/ui/kit";
import { AwbLink, flightLabel, Route, ShcTags, userName } from "@/ui/cargo";
import type { Awb, AwbEvent, Db } from "@/lib/types";
import { daysBetween, fmtDate, fmtDateTime, kg, num, todayIso } from "@/lib/format";
import { findAwbByCode, transferOnward } from "@/lib/mock/ops";
import { flightCapacity } from "@/lib/mock/booking";

const PARTNERS = [{ code: "TG", name: "Thai Airways" }, { code: "VN", name: "Vietnam Airlines" }, { code: "MU", name: "China Eastern" }, { code: "CZ", name: "China Southern" }, { code: "PG", name: "Bangkok Airways" }];
/** Where a transit shipment physically is: its warehouse zone when it has one, otherwise its recorded station. */
const isAt = (d: Db, a: Awb, st: string) => (d.zones.find((z) => z.id === a.zoneId)?.station ?? a.station) === st;
const onwardFlights = (d: Db, st: string, dest: string) => d.flights.filter((f) => f.origin === st && f.dest === dest && f.status === "open" && f.date >= todayIso()).sort((a, b) => (a.date + a.std).localeCompare(b.date + b.std));

export default function Transfer() {
  const d = useDb(); const t = useT(); const can = useCan(); const lang = useLang(); const st = d.session.station; const canOp = can("wms.operate");
  const comm = (a: Awb) => a.commodity.split(" / ")[t("0", "1") === "0" ? 0 : 1] ?? a.commodity;
  const [tab, setTab] = useState<"waiting" | "done">("waiting"); const [scan, setScan] = useState(""); const [err, setErr] = useState(""); const [working, setWorking] = useState<string | null>(null);
  const waiting = useMemo(() => d.awbs.filter((a) => a.direction === "transit" && a.status === "active" && isAt(d, a, st) && a.dest !== st && !["MAN", "DEP", "DLV"].includes(a.stage)), [d, st]);
  const done = useMemo(() => d.awbs.flatMap((a) => { const e = [...a.events].reverse().find((x) => x.code === "TFD" && x.station === st); return e ? [{ a, e }] : []; }), [d.awbs, st]);
  function onScan(code: string) {
    setScan(""); const a = findAwbByCode(d, code);
    if (!a) return setErr(t(`ບໍ່ພົບ AWB ${code}. ກວດເລກ ແລ້ວສະແກນອີກຄັ້ງ.`, `No AWB matches ${code}. Check the number and scan again.`));
    if (!waiting.some((x) => x.id === a.id)) return setErr(t(`AWB ${a.no} ບໍ່ແມ່ນສິນຄ້າຖ່າຍລໍາທີ່ລໍຖ້າຢູ່ ${st}.`, `AWB ${a.no} is not transit cargo waiting at ${st}.`));
    setErr(""); setWorking(a.id);
  }
  const cols: Col<Awb>[] = [
    { key: "no", header: t("ເລກ AWB", "AWB number"), render: (a) => <AwbLink awb={a} />, sort: (a) => a.no },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (a) => <Route from={a.origin} to={a.dest} /> },
    { key: "comm", header: t("ສິນຄ້າ", "Commodity"), render: (a) => <span className="inline-flex items-center gap-1.5"><span className="line-clamp-1">{comm(a)}</span><ShcTags codes={a.shc} /></span> },
    { key: "pcs", header: t("ກ່ອງ", "Pcs"), align: "right", render: (a) => a.pieces, sort: (a) => a.pieces },
    { key: "kg", header: t("ນໍ້າໜັກ", "Gross"), align: "right", render: (a) => kg(a.grossKg), sort: (a) => a.grossKg },
    { key: "zone", header: t("ໂຊນ", "Zone"), render: (a) => <span className="font-mono text-[13px]">{d.zones.find((z) => z.id === a.zoneId)?.code ?? "—"}</span> },
    { key: "wait", header: t("ລໍຖ້າ (ວັນ)", "Waiting (days)"), align: "right", render: (a) => a.arrivedAt ? Math.max(0, daysBetween(a.arrivedAt, todayIso())) : "—" },
    { key: "next", header: t("ຖ້ຽວຕໍ່ໄປທີ່ວາງແຜນ", "Planned onward flight"), render: (a) => <span className="font-mono text-[13px] whitespace-nowrap">{flightLabel(d, a.nextFlightId)}</span> },
    { key: "act", header: "", align: "right", render: (a) => <Button size="sm" variant="primary" icon={ScanLine} disabled={!canOp} onClick={() => setWorking(a.id)}>{t("ສະແກນອອກ", "Scan out")}</Button> },
  ];
  const doneCols: Col<{ a: Awb; e: AwbEvent }>[] = [
    { key: "ts", header: t("ເວລາ", "Time"), render: (r) => <span className="tnum whitespace-nowrap">{fmtDateTime(r.e.ts)}</span>, sort: (r) => r.e.ts },
    { key: "no", header: t("ເລກ AWB", "AWB number"), render: (r) => <AwbLink awb={r.a} /> },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (r) => <Route from={r.a.origin} to={r.a.dest} /> },
    { key: "flight", header: t("ຖ້ຽວບິນຕໍ່", "Onward flight"), render: (r) => <span className="font-mono text-[13px] whitespace-nowrap">{flightLabel(d, r.a.nextFlightId) === "—" ? r.e.flightNo : flightLabel(d, r.a.nextFlightId)}</span> },
    { key: "kind", header: t("ປະເພດ", "Type"), render: (r) => r.e.note ? <Badge tone="info" noIcon>Interline · {r.e.note}</Badge> : <Badge noIcon>{t("ຖ່າຍລໍາ", "Transshipment")}</Badge> },
    { key: "pcs", header: t("ກ່ອງ", "Pcs"), align: "right", render: (r) => r.e.pieces ?? r.a.pieces },
    { key: "kg", header: t("ນໍ້າໜັກ", "Gross"), align: "right", render: (r) => kg(r.a.grossKg) },
    { key: "by", header: t("ຜູ້ສະແກນ", "Scanned by"), render: (r) => userName(d, r.e.userId, lang) },
  ];
  const current = d.awbs.find((a) => a.id === working);
  return <>
    <PageHeader title={t("ຖ່າຍລໍາ ແລະ Interline", "Transshipment and interline")} subtitle={t(`ສິນຄ້າຜ່ານແດນທີ່ສະຖານີ ${st}: ເລືອກຖ້ຽວບິນຕໍ່ ແລະ ສະແກນອອກ`, `Transit cargo at ${st}: choose the onward flight and scan it out`)} />
    <StatRow items={[
      { label: t("ລໍຖ້າສົ່ງຕໍ່", "Waiting for onward flight"), value: waiting.length, sub: kg(waiting.reduce((s, a) => s + a.grossKg, 0)), tone: waiting.length ? "warn" : undefined },
      { label: t("ສົ່ງຕໍ່ແລ້ວ", "Transferred"), value: done.length },
      { label: "Interline", value: done.filter((r) => r.e.note).length },
    ]} />
    {!canOp && <div className="mb-4"><Callout tone="warn" title={t("ເບິ່ງໄດ້ຢ່າງດຽວ", "View only")}>{t("ບົດບາດຂອງທ່ານບໍ່ມີສິດສະແກນສິນຄ້າອອກ.", "Your role cannot scan cargo out.")}</Callout></div>}
    <Tabs value={tab} onChange={setTab} tabs={[{ key: "waiting", label: t("ລໍຖ້າສົ່ງຕໍ່", "Waiting"), count: waiting.length }, { key: "done", label: t("ສົ່ງຕໍ່ແລ້ວ", "Completed"), count: done.length }]} />
    {tab === "waiting" ? <>
      {canOp && <Panel className="mb-4"><form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (scan.trim()) onScan(scan.trim()); }}><div className="relative min-w-[260px] flex-1 max-w-md"><ScanLine size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden /><Input aria-label={t("ເລກ AWB", "AWB number")} className="pl-8 font-mono" placeholder={t("ສະແກນ ຫຼື ພິມເລກ AWB ຖ່າຍລໍາ", "Scan or type a transit AWB number")} value={scan} onChange={(e) => setScan(e.target.value)} /></div><Button type="submit" variant="primary" disabled={!scan.trim()}>{t("ຄົ້ນຫາ", "Look up")}</Button></form>{err && <div className="mt-2"><Callout tone="bad">{err}</Callout></div>}</Panel>}
      <Panel flush><DataTable rows={waiting} columns={cols} rowKey={(a) => a.id} minWidth={1000} search={(a) => `${a.prefix}${a.serial} ${a.commodity} ${a.origin} ${a.dest}`} empty={<Empty icon={Truck} title={t("ບໍ່ມີສິນຄ້າຖ່າຍລໍາລໍຖ້າຢູ່", "No transit cargo is waiting")}>{t(`ສິນຄ້າຜ່ານແດນຈະປາກົດຢູ່ນີ້ ເມື່ອຮັບເຂົ້າໂຊນຂອງສະຖານີ ${st}.`, `Transit cargo appears here once it is received into a zone at ${st}.`)}</Empty>} /></Panel>
    </> : <Panel flush><DataTable rows={done} columns={doneCols} rowKey={(r) => r.a.id} minWidth={940} defaultSort={{ key: "ts", dir: "desc" }} search={(r) => `${r.a.prefix}${r.a.serial} ${r.a.dest} ${r.e.note ?? ""} ${r.e.flightNo ?? ""}`} empty={<Empty title={t("ຍັງບໍ່ມີການສົ່ງຕໍ່", "Nothing transferred yet")}>{t("ສະແກນ AWB ຈາກແຖບ ລໍຖ້າສົ່ງຕໍ່ ເພື່ອສົ່ງຂຶ້ນຖ້ຽວບິນຕໍ່.", "Scan an AWB out from the Waiting tab to send it onward.")}</Empty>} /></Panel>}
    {current && <ScanOutDialog key={current.id} a={current} onClose={() => setWorking(null)} onDone={() => { setWorking(null); setTab("done"); }} />}
  </>;
}

function ScanOutDialog({ a, onClose, onDone }: { a: Awb; onClose: () => void; onDone: () => void }) {
  const d = useDb(); const t = useT(); const st = d.session.station;
  const flights = onwardFlights(d, st, a.dest); const planned = flights.find((f) => f.id === a.nextFlightId);
  const [flightId, setFlightId] = useState(planned?.id ?? flights[0]?.id ?? ""); const [partner, setPartner] = useState(""); const [ref, setRef] = useState(""); const [scan, setScan] = useState(""); const [tried, setTried] = useState(false);
  const cap = flightId ? flightCapacity(d, flightId) : undefined; const already = a.flightId === flightId; const noSpace = !!cap && !already && cap.remainingKg < a.grossKg;
  const code = a.prefix + a.serial; const scanned = scan.replace(/[\s-]/g, "") === code;
  function submit() { setTried(true); if (!flightId || noSpace || !scanned) return; const note = partner ? `${partner}${ref.trim() ? ` ${ref.trim()}` : ""}` : undefined; transferOnward(a.id, flightId, note); const f = d.flights.find((x) => x.id === flightId); toast(t(`ສົ່ງ ${a.no} ຂຶ້ນ ${f?.no} ແລ້ວ`, `${a.no} sent onward on ${f?.no}`)); onDone(); }
  return <Dialog open onClose={onClose} title={t(`ສະແກນອອກ ${a.no}`, `Scan out ${a.no}`)} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" icon={Truck} disabled={flights.length === 0} onClick={submit}>{t("ຢືນຢັນສົ່ງຕໍ່", "Confirm transfer")}</Button></>}>
    <div className="grid gap-4">
      <Dl cols={3} items={[{ label: t("ເສັ້ນທາງ", "Route"), value: <Route from={a.origin} to={a.dest} /> }, { label: t("ກ່ອງ", "Pieces"), value: <span className="tnum">{a.pieces}</span> }, { label: t("ນໍ້າໜັກ", "Gross weight"), value: kg(a.grossKg) }]} />
      {flights.length === 0 ? <Callout tone="bad" title={t(`ບໍ່ມີຖ້ຽວບິນເປີດຮັບຈາກ ${st} ໄປ ${a.dest}`, `No open flight from ${st} to ${a.dest}`)}>{t("ເພີ່ມຖ້ຽວບິນໃນຂໍ້ມູນພື້ນຖານ ຫຼື ລໍຖ້າຖ້ຽວຖັດໄປເປີດຮັບ.", "Add a flight in master data, or wait for the next flight to open.")}</Callout> : <>
        <Field label={t("ຖ້ຽວບິນຕໍ່", "Onward flight")} required><Select value={flightId} onChange={(e) => setFlightId(e.target.value)} options={flights.slice(0, 10).map((f) => ({ value: f.id, label: `${f.no} · ${fmtDate(f.date)} ${f.std}${f.id === a.nextFlightId ? t(" · ຕາມແຜນ", " · planned") : ""}` }))} /></Field>
        {cap && <div><div className="tnum mb-1 flex justify-between text-xs text-ink-2"><span>{cap.aircraft?.nameEn}</span><span>{t(`ໃຊ້ແລ້ວ ${num(cap.usedKg)} / ${num(cap.maxKg)} kg`, `${num(cap.usedKg)} of ${num(cap.maxKg)} kg used`)}</span></div><BarMeter value={cap.usedKg} max={cap.maxKg} label={t("ພື້ນທີ່ໃນຖ້ຽວບິນ", "Flight space")} /></div>}
        {noSpace && <Callout tone="bad">{t(`ຖ້ຽວບິນນີ້ເຫຼືອພຽງ ${num(cap!.remainingKg)} kg ແຕ່ AWB ນີ້ໜັກ ${kg(a.grossKg)}. ເລືອກຖ້ຽວອື່ນ.`, `This flight has only ${num(cap!.remainingKg)} kg left and this AWB weighs ${kg(a.grossKg)}. Choose another flight.`)}</Callout>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("ສາຍການບິນຄູ່ຮ່ວມ Interline (ຖ້າມີ)", "Interline partner carrier (optional)")}><Select value={partner} onChange={(e) => setPartner(e.target.value)} placeholder={t("ບໍ່ມີ: ສົ່ງຕໍ່ໂດຍ Lao Airlines", "None: onward with Lao Airlines")} options={PARTNERS.map((p) => ({ value: p.code, label: `${p.code} ${p.name}` }))} /></Field>
          {partner && <Field label={t("ເລກຖ້ຽວບິນ ຫຼື ເອກະສານຂອງຄູ່ຮ່ວມ", "Partner flight or transfer manifest no.")}><Input className="font-mono" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>}
        </div>
        <Field label={t("ສະແກນປ້າຍສິນຄ້າເພື່ອຢືນຢັນ", "Scan the cargo label to confirm")} required error={tried && !scanned ? t("ເລກທີ່ສະແກນບໍ່ກົງກັບ AWB ນີ້. ກວດປ້າຍ ແລ້ວສະແກນອີກຄັ້ງ.", "The scan does not match this AWB. Check the label and scan again.") : undefined}>
          <div className="flex gap-2"><Input className="font-mono" value={scan} onChange={(e) => setScan(e.target.value)} placeholder={code} /><Button icon={ScanLine} onClick={() => setScan(code)}>{t("ຈໍາລອງສະແກນ", "Simulate scan")}</Button></div>
        </Field>
        {scanned && <Badge tone="ok">{t("ປ້າຍກົງກັບ AWB", "Label matches the AWB")}</Badge>}
      </>}
    </div>
  </Dialog>;
}
