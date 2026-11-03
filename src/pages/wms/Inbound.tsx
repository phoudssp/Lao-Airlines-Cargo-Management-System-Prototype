import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PackageCheck, ScanLine } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { bi, useLang, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Col, cx, DataTable, Dialog, Dl, Empty, Field, Input, PageHeader, Panel, Select, StatRow, Textarea, toast } from "@/ui/kit";
import { AwbLink, AwbStrip, customerName, flightLabel, Route, ShcTags, userName } from "@/ui/cargo";
import type { Awb, AwbEvent, Condition, Db, ZoneType } from "@/lib/types";
import { fmtDateTime, kg, num, todayIso } from "@/lib/format";
import { awbsToReceive, findAwbByCode, hasReceipt, receiveCargo, zoneLoad } from "@/lib/mock/ops";

const CONDITIONS: { key: Condition; lo: string; en: string }[] = [{ key: "good", lo: "ປົກກະຕິ", en: "Good" }, { key: "damage", lo: "ເສຍຫາຍ", en: "Damage" }, { key: "wet", lo: "ປຽກນໍ້າ", en: "Wet" }, { key: "broken", lo: "ແຕກຫັກ", en: "Broken" }];
const flightNoOf = (d: Db, a: Awb) => a.flightId ? flightLabel(d, a.flightId) : [...a.events].reverse().find((e) => e.flightNo)?.flightNo ?? "—";

function suggestZone(d: Db, station: string, a: Awb) {
  const want: ZoneType = a.shc.includes("PER") || a.shc.includes("PHA") ? "cold" : a.shc.includes("VAL") ? "valuable" : a.shc.includes("DGR") ? "dg" : a.direction === "transit" ? "transit" : "general";
  const free = (id: string, cap: number) => cap - zoneLoad(d, id).kg;
  const zones = d.zones.filter((z) => z.station === station && z.active);
  const best = (list: typeof zones) => [...list].sort((x, y) => free(y.id, y.capacityKg) - free(x.id, x.capacityKg))[0];
  return best(zones.filter((z) => z.type === want)) ?? best(zones.filter((z) => z.type === "general")) ?? zones[0];
}

export default function Inbound() {
  const d = useDb(); const t = useT(); const can = useCan(); const lang = useLang(); const st = d.session.station; const canOp = can("wms.operate");
  const comm = (a: Awb) => a.commodity.split(" / ")[t("0", "1") === "0" ? 0 : 1] ?? a.commodity;
  const pending = useMemo(() => awbsToReceive(d, st), [d, st]);
  const [flight, setFlight] = useState(""); const [scan, setScan] = useState(""); const [scanError, setScanError] = useState(""); const [receiving, setReceiving] = useState<string | null>(null); const [notice, setNotice] = useState<{ no: string; faults: string[] } | null>(null);
  const rows = pending.filter((a) => !flight || flightNoOf(d, a) === flight);
  const flights = [...new Set(pending.map((a) => flightNoOf(d, a)))].sort();
  const receipts = useMemo(() => d.awbs.flatMap((a) => { const e = [...a.events].reverse().find((x) => x.code === "RCF" && x.station === st); return e ? [{ a, e }] : []; }), [d.awbs, st]);
  const today = receipts.filter((r) => r.e.ts.slice(0, 10) === todayIso());
  const openIrr = d.irregularities.filter((r) => r.station === st && r.status !== "closed").length;
  const samples = [...pending.slice(0, 5).map((a) => ({ a, hint: "" })), ...receipts.slice(0, 1).map((r) => ({ a: r.a, hint: t("ຮັບແລ້ວ", "Already received") }))];

  function onScan(code: string) {
    setScan(""); const a = findAwbByCode(d, code);
    if (!a) return setScanError(t(`ບໍ່ພົບ AWB ${code}. ກວດເລກ ແລ້ວສະແກນອີກຄັ້ງ.`, `No AWB matches ${code}. Check the number and scan again.`));
    if (a.status === "voided") return setScanError(t(`AWB ${a.no} ຖືກຍົກເລີກແລ້ວ. ກັນສິນຄ້າໄວ້ ແລະ ແຈ້ງຫົວໜ້າ.`, `AWB ${a.no} is void. Set the cargo aside and tell your supervisor.`));
    if (a.dest !== st) return setScanError(t(`AWB ${a.no} ມີປາຍທາງ ${a.dest} ບໍ່ແມ່ນ ${st}. ບັນທຶກເປັນ "ສົ່ງຜິດເສັ້ນທາງ" ຖ້າສິນຄ້າມາຮອດທີ່ນີ້ແທ້.`, `AWB ${a.no} is bound for ${a.dest}, not ${st}. Record it as misrouted if the cargo really is here.`));
    if (hasReceipt(a)) return setScanError(t(`AWB ${a.no} ຮັບເຂົ້າສາງແລ້ວ. ບໍ່ຕ້ອງຮັບຊໍ້າ.`, `AWB ${a.no} is already in the warehouse. No second receipt is needed.`));
    if (!pending.some((x) => x.id === a.id)) return setScanError(t(`AWB ${a.no} ຍັງບໍ່ໄດ້ອອກບິນມາ ${st}.`, `AWB ${a.no} has not yet departed for ${st}.`));
    if (!canOp) return setScanError(t("ບົດບາດຂອງທ່ານບໍ່ມີສິດຮັບເຄື່ອງເຂົ້າສາງ.", "Your role cannot receive cargo into the warehouse."));
    setScanError(""); setReceiving(a.id);
  }

  const cols: Col<Awb>[] = [
    { key: "no", header: t("ເລກ AWB", "AWB number"), render: (a) => <AwbLink awb={a} />, sort: (a) => a.no },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (a) => <Route from={a.origin} to={a.dest} /> },
    { key: "flight", header: t("ຖ້ຽວບິນ", "Flight"), render: (a) => <span className="font-mono text-[13px] whitespace-nowrap">{flightNoOf(d, a)}</span>, sort: (a) => flightNoOf(d, a) },
    { key: "co", header: t("ຜູ້ຮັບ", "Consignee"), render: (a) => <span className="line-clamp-1">{customerName(d, a.consigneeId)}</span> },
    { key: "comm", header: t("ສິນຄ້າ", "Commodity"), render: (a) => <span className="inline-flex items-center gap-1.5"><span className="line-clamp-1">{comm(a)}</span><ShcTags codes={a.shc} /></span> },
    { key: "pcs", header: t("ກ່ອງຕາມ Manifest", "Manifest pcs"), align: "right", render: (a) => a.pieces, sort: (a) => a.pieces },
    { key: "kg", header: t("ນໍ້າໜັກ", "Gross"), align: "right", render: (a) => kg(a.grossKg), sort: (a) => a.grossKg },
    { key: "stage", header: t("ສະຖານະ", "Status"), render: (a) => <AwbStrip awb={a} /> },
    { key: "act", header: "", align: "right", render: (a) => <Button size="sm" variant="primary" icon={PackageCheck} disabled={!canOp} onClick={() => setReceiving(a.id)}>{t("ຮັບເຂົ້າສາງ", "Receive")}</Button> },
  ];
  const recCols: Col<{ a: Awb; e: AwbEvent }>[] = [
    { key: "ts", header: t("ເວລາຮັບ", "Received at"), render: (r) => <span className="tnum whitespace-nowrap">{fmtDateTime(r.e.ts)}</span>, sort: (r) => r.e.ts },
    { key: "no", header: t("ເລກ AWB", "AWB number"), render: (r) => <AwbLink awb={r.a} /> },
    { key: "flight", header: t("ຖ້ຽວບິນ", "Flight"), render: (r) => <span className="font-mono text-[13px] whitespace-nowrap">{flightNoOf(d, r.a)}</span> },
    { key: "pcs", header: t("ຮັບ / Manifest", "Received / manifest"), align: "right", render: (r) => { const got = r.e.pieces ?? r.a.receivedPieces; return <span className={cx(got !== r.a.pieces && "font-semibold text-bad")}>{got} / {r.a.pieces}</span>; } },
    { key: "cond", header: t("ສະພາບ", "Condition"), render: (r) => { const c = CONDITIONS.find((x) => x.key === r.a.condition)!; return <Badge tone={r.a.condition === "good" ? "ok" : "bad"}>{t(c.lo, c.en)}</Badge>; } },
    { key: "zone", header: t("ໂຊນ", "Zone"), render: (r) => <span className="font-mono text-[13px]">{d.zones.find((z) => z.id === r.a.zoneId)?.code ?? "—"}</span> },
    { key: "by", header: t("ຜູ້ຮັບເຄື່ອງ", "Received by"), render: (r) => userName(d, r.e.userId, lang) },
  ];
  const current = d.awbs.find((a) => a.id === receiving);
  return <>
    <PageHeader title={t("ຮັບເຄື່ອງເຂົ້າສາງ", "Warehouse goods receipt")} subtitle={t(`ຮັບສິນຄ້າທຽບກັບ Manifest ທີ່ສະຖານີ ${st} ພ້ອມກວດສະພາບທຸກ AWB`, `Receive cargo against the Manifest at ${st}, with a condition check on every AWB`)} />
    <StatRow items={[
      { label: t("ລໍຖ້າຮັບເຂົ້າສາງ", "Waiting for receipt"), value: pending.length, sub: kg(pending.reduce((s, a) => s + a.grossKg, 0)), tone: pending.length ? "warn" : undefined },
      { label: t("ຮັບແລ້ວມື້ນີ້", "Received today"), value: today.length, sub: t(`${num(today.reduce((s, r) => s + r.a.pieces, 0))} ກ່ອງ`, `${num(today.reduce((s, r) => s + r.a.pieces, 0))} pieces`) },
      { label: t("ຄວາມຜິດປົກກະຕິທີ່ຍັງເປີດ", "Open irregularities"), value: openIrr, to: "/wms/irregularities", tone: openIrr ? "bad" : undefined },
    ]} />
    {!canOp && <div className="mb-4"><Callout tone="warn" title={t("ເບິ່ງໄດ້ຢ່າງດຽວ", "View only")}>{t("ບົດບາດຂອງທ່ານບໍ່ມີສິດຮັບເຄື່ອງເຂົ້າສາງ. ກະລຸນາໃຫ້ພະນັກງານສາງເປັນຜູ້ບັນທຶກ.", "Your role cannot receive cargo. A warehouse officer needs to record the receipt.")}</Callout></div>}
    {notice && <div className="mb-4"><Callout tone={notice.faults.length ? "warn" : "ok"} title={t(`ຮັບ ${notice.no} ເຂົ້າສາງແລ້ວ`, `${notice.no} received into the warehouse`)} action={<Button size="sm" variant="ghost" onClick={() => setNotice(null)}>{t("ປິດ", "Dismiss")}</Button>}>{notice.faults.length > 0 && <>{t(`ເປີດບັນທຶກຄວາມຜິດປົກກະຕິ ${notice.faults.length} ລາຍການ: `, `${notice.faults.length} irregularity record(s) opened: `)}{notice.faults.join(", ")}. <Link className="font-medium text-brand hover:underline" to="/wms/irregularities">{t("ເບິ່ງບັນທຶກ", "View records")}</Link></>}</Callout></div>}
    <Panel title={t("ສະແກນ AWB", "Scan an AWB")} className="mb-4">
      <form className="flex flex-wrap items-start gap-2" onSubmit={(e) => { e.preventDefault(); if (scan.trim()) onScan(scan.trim()); }}>
        <div className="relative min-w-[260px] flex-1 max-w-md"><ScanLine size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden /><Input autoFocus aria-label={t("ເລກ AWB", "AWB number")} className="pl-8 font-mono" placeholder={t("ສະແກນ ຫຼື ພິມເລກ AWB", "Scan or type the AWB number")} value={scan} onChange={(e) => setScan(e.target.value)} /></div>
        <Button type="submit" variant="primary" disabled={!scan.trim()}>{t("ຄົ້ນຫາ", "Look up")}</Button>
      </form>
      {scanError && <div className="mt-2"><Callout tone="bad">{scanError}</Callout></div>}
      {samples.length > 0 && <div className="mt-3"><div className="box-label mb-1">{t("ຈໍາລອງການສະແກນ", "Simulate a scan")}</div><div className="flex flex-wrap gap-1.5">{samples.map(({ a, hint }) => <Button key={a.id} size="sm" icon={ScanLine} onClick={() => onScan(a.prefix + a.serial)}><span className="font-mono text-[13px]">{a.no}</span>{hint && <span className="text-xs text-ink-2">{hint}</span>}</Button>)}</div></div>}
    </Panel>
    <Panel flush title={t("ສິນຄ້າທີ່ມາຮອດ ລໍຖ້າຮັບເຂົ້າສາງ", "Arrived cargo waiting for receipt")} className="mb-4">
      <DataTable rows={rows} columns={cols} rowKey={(a) => a.id} minWidth={1000} search={(a) => `${a.prefix}${a.serial} ${customerName(d, a.consigneeId)} ${a.commodity} ${a.origin}`}
        filters={<Select aria-label={t("ຖ້ຽວບິນ", "Flight")} className="w-auto" value={flight} onChange={(e) => setFlight(e.target.value)} placeholder={t("ທຸກຖ້ຽວບິນທີ່ມາຮອດ", "All arrived flights")} options={flights.map((f) => ({ value: f, label: `${f} · ${pending.filter((a) => flightNoOf(d, a) === f).length} AWB` }))} />}
        empty={<Empty icon={PackageCheck} title={t("ບໍ່ມີສິນຄ້າລໍຖ້າຮັບເຂົ້າສາງ", "No cargo is waiting for receipt")}>{t(`ສິນຄ້າຈະປາກົດຢູ່ນີ້ ເມື່ອຖ້ຽວບິນທີ່ມີປາຍທາງ ${st} ອອກບິນ ຫຼື ມາຮອດ.`, `Cargo appears here once a flight bound for ${st} has departed or arrived.`)}</Empty>} />
    </Panel>
    <Panel flush title={t("ການຮັບເຂົ້າສາງລ່າສຸດ", "Recent receipts")}>
      <DataTable rows={receipts} columns={recCols} rowKey={(r) => r.a.id} pageSize={8} minWidth={820} defaultSort={{ key: "ts", dir: "desc" }} empty={<Empty title={t("ຍັງບໍ່ມີການຮັບເຂົ້າສາງທີ່ສະຖານີນີ້", "No receipts at this station yet")}>{t("ຮັບ AWB ທໍາອິດຈາກລາຍການດ້ານເທິງ.", "Receive the first AWB from the list above.")}</Empty>} />
    </Panel>
    {current && <ReceiveDialog key={current.id} a={current} onClose={() => setReceiving(null)} onDone={(faults) => { setNotice({ no: current.no, faults }); setReceiving(null); toast(faults.length ? t(`ຮັບແລ້ວ. ເປີດບັນທຶກຄວາມຜິດປົກກະຕິ ${faults.length} ລາຍການ`, `Received. ${faults.length} irregularity record(s) opened`) : t("ຮັບເຂົ້າສາງແລ້ວ", "Received into the warehouse"), faults.length ? "warn" : "ok"); }} />}
  </>;
}

function ReceiveDialog({ a, onClose, onDone }: { a: Awb; onClose: () => void; onDone: (faults: string[]) => void }) {
  const d = useDb(); const t = useT(); const st = d.session.station;
  const zones = d.zones.filter((z) => z.station === st && z.active);
  const [pieces, setPieces] = useState(String(a.pieces)); const [condition, setCondition] = useState<Condition | "">(""); const [note, setNote] = useState(""); const [zoneId, setZoneId] = useState(suggestZone(d, st, a)?.id ?? ""); const [tried, setTried] = useState(false);
  const n = Number(pieces); const validPieces = Number.isInteger(n) && n >= 1; const noteNeeded = !!condition && condition !== "good"; const zone = d.zones.find((z) => z.id === zoneId);
  const load = zone ? zoneLoad(d, zone.id).kg : 0; const diff = validPieces ? n - a.pieces : 0;
  const errs = { pieces: !validPieces, condition: !condition, note: noteNeeded && !note.trim(), zone: zones.length > 0 && !zoneId };
  function submit() {
    setTried(true); if (Object.values(errs).some(Boolean) || !condition) return;
    receiveCargo(a.id, { pieces: n, condition, note: note.trim() || undefined, zoneId: zoneId || undefined });
    const faults: string[] = []; if (condition !== "good") { const c = CONDITIONS.find((x) => x.key === condition)!; faults.push(t(c.lo, c.en)); } if (diff < 0) faults.push(t(`ຂາດ ${-diff} ກ່ອງ`, `${-diff} piece(s) short`)); if (diff > 0) faults.push(t(`ເກີນ ${diff} ກ່ອງ`, `${diff} piece(s) over`));
    onDone(faults);
  }
  return <Dialog open onClose={onClose} title={t(`ຮັບ ${a.no} ເຂົ້າສາງ`, `Receive ${a.no}`)} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" icon={PackageCheck} onClick={submit}>{t("ຢືນຢັນຮັບເຂົ້າສາງ", "Confirm receipt")}</Button></>}>
    <div className="grid gap-4">
      <Dl cols={3} items={[{ label: t("ຕາມ Manifest", "On the Manifest"), value: <b className="tnum">{t(`${a.pieces} ກ່ອງ`, `${a.pieces} pieces`)}</b> }, { label: t("ນໍ້າໜັກ", "Gross weight"), value: kg(a.grossKg) }, { label: t("ສິນຄ້າ", "Commodity"), value: <span className="inline-flex flex-wrap items-center gap-1.5">{bi(t, a.commodity)}<ShcTags codes={a.shc} /></span> }]} />
      <Field label={t("ຈໍານວນກ່ອງທີ່ຮັບຕົວຈິງ", "Pieces actually received")} required error={tried && errs.pieces ? t("ໃສ່ຈໍານວນກ່ອງທີ່ຮັບໄດ້ ຢ່າງໜ້ອຍ 1. ຖ້າບໍ່ໄດ້ຮັບເລີຍ ໃຫ້ບັນທຶກເປັນສິນຄ້າເສຍ.", "Enter at least 1 piece. If nothing arrived, record the AWB as lost.") : undefined}><Input type="number" min={1} className="w-32" value={pieces} onChange={(e) => setPieces(e.target.value)} /></Field>
      {diff !== 0 && <Callout tone="warn" title={diff < 0 ? t(`ຂາດ ${-diff} ກ່ອງ ທຽບກັບ Manifest`, `${-diff} piece(s) short against the Manifest`) : t(`ເກີນ ${diff} ກ່ອງ ທຽບກັບ Manifest`, `${diff} piece(s) over the Manifest`)}>{t("ລະບົບຈະເປີດບັນທຶກຄວາມຜິດປົກກະຕິໃຫ້ອັດຕະໂນມັດ.", "An irregularity record opens automatically when you confirm.")}</Callout>}
      <div role="radiogroup" aria-label={t("ກວດສະພາບສິນຄ້າ", "Condition check")}>
        <span className="box-label mb-1 block">{t("ກວດສະພາບສິນຄ້າ", "Condition check")}<span className="text-bad"> *</span></span>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">{CONDITIONS.map((c) => <button key={c.key} type="button" role="radio" aria-checked={condition === c.key} onClick={() => setCondition(c.key)} className={cx("h-10 rounded border text-sm font-medium transition-colors", condition === c.key ? (c.key === "good" ? "border-ok bg-ok text-white" : "border-bad bg-bad text-white") : "border-line-strong bg-surface hover:bg-surface-2")}>{t(c.lo, c.en)}</button>)}</div>
        {tried && errs.condition && <span className="mt-1 block text-xs text-bad">{t("ຕ້ອງເລືອກສະພາບສິນຄ້າກ່ອນຮັບເຂົ້າສາງ.", "Choose the condition before receiving.")}</span>}
      </div>
      <Field label={noteNeeded ? t("ລາຍລະອຽດຄວາມເສຍຫາຍ", "Describe the fault") : t("ໝາຍເຫດ", "Note")} required={noteNeeded} error={tried && errs.note ? t("ອະທິບາຍສິ່ງທີ່ພົບ ເພື່ອໃຊ້ໃນບົດລາຍງານຄວາມເສຍຫາຍ.", "Describe what you found. It goes on the damage report.") : undefined}><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {noteNeeded && <Callout tone="warn">{t("ສະພາບນີ້ຈະເປີດບັນທຶກຄວາມຜິດປົກກະຕິໃຫ້ອັດຕະໂນມັດ.", "This condition opens an irregularity record automatically.")}</Callout>}
      {zones.length > 0 ? <Field label={t("ຈັດເຂົ້າໂຊນ", "Assign to zone")} required error={tried && errs.zone ? t("ເລືອກໂຊນທີ່ຈະວາງສິນຄ້າ.", "Choose the zone the cargo goes to.") : undefined} hint={zone ? t(`ໃຊ້ແລ້ວ ${num(load)} ຈາກ ${num(zone.capacityKg)} kg`, `${num(load)} of ${num(zone.capacityKg)} kg in use`) : undefined}><Select value={zoneId} onChange={(e) => setZoneId(e.target.value)} placeholder={t("ເລືອກໂຊນ", "Choose a zone")} options={zones.map((z) => ({ value: z.id, label: `${z.code} · ${t(z.nameLo, z.nameEn)}` }))} /></Field> : <Callout tone="warn">{t("ສະຖານີນີ້ຍັງບໍ່ມີໂຊນ. ຮັບໄດ້ໂດຍບໍ່ກໍານົດໂຊນ ແລ້ວເພີ່ມໂຊນໃນໜ້າ ໂຊນ ແລະ ຕໍາແໜ່ງ.", "This station has no zones yet. You can receive without one, then add zones under Zones & storage.")}</Callout>}
      {zone && load + a.grossKg > zone.capacityKg && <Callout tone="warn">{t(`ໂຊນ ${zone.code} ຈະເກີນຄວາມຈຸ ຖ້າຮັບສິນຄ້ານີ້.`, `Zone ${zone.code} goes over capacity with this cargo.`)}</Callout>}
      {zone && a.shc.includes("PER") && zone.type !== "cold" && <Callout tone="bad">{t("ສິນຄ້ານີ້ເນົ່າເສຍງ່າຍ ຄວນເກັບໃນຫ້ອງເຢັນ.", "This cargo is perishable and belongs in a cold zone.")}</Callout>}
    </div>
  </Dialog>;
}
