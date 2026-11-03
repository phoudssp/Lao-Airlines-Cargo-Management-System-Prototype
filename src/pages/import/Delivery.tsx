import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, CircleDashed, FileText, PackageOpen, Printer, ScanLine, Wallet, X, XCircle } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { bi, useLang, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Checkbox, Col, cx, DataTable, Dl, Empty, Field, Input, PageHeader, Panel, PrintSheet, StatRow, toast } from "@/ui/kit";
import { AwbLink, Barcode, customerName, flightLabel, Route, ShcTags, stageName, userName } from "@/ui/cargo";
import type { Awb } from "@/lib/types";
import { fmtDate, fmtDateTime, kg, money, num, todayIso } from "@/lib/format";
import { awbDocs, chargeStorage, customsDocList, deliverCargo, findAwbByCode, releaseCheck } from "@/lib/mock/ops";

type GateState = "ok" | "wait" | "block";
function Gate({ state, title, children, action }: { state: GateState; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  const I = state === "ok" ? CheckCircle2 : state === "block" ? XCircle : CircleDashed;
  return <li className="flex flex-wrap items-start gap-x-2.5 gap-y-1 px-4 py-2.5"><I size={18} aria-hidden className={cx("mt-0.5 shrink-0", state === "ok" ? "text-ok" : state === "block" ? "text-bad" : "text-warn")} /><div className="min-w-[180px] flex-1"><div className="text-sm font-medium">{title}</div>{children && <div className="text-sm text-ink-2">{children}</div>}</div>{action}</li>;
}

export default function Delivery() {
  const d = useDb(); const t = useT(); const can = useCan(); const st = d.session.station; const canOp = can("import.operate");
  const comm = (a: Awb) => a.commodity.split(" / ")[t("0", "1") === "0" ? 0 : 1] ?? a.commodity;
  const [params, setParams] = useSearchParams(); const selId = params.get("awb"); const [scan, setScan] = useState(""); const [err, setErr] = useState("");
  const select = (id: string | null) => { setParams(id ? { awb: id } : {}, { replace: true }); setErr(""); };
  const waiting = useMemo(() => d.awbs.filter((a) => a.status === "active" && a.dest === st && ["RCF", "NFD", "CUS"].includes(a.stage)), [d.awbs, st]);
  const delivered = useMemo(() => d.awbs.filter((a) => a.dest === st && a.stage === "DLV"), [d.awbs, st]);
  const ready = waiting.filter((a) => releaseCheck(d, a).ready); const atCashier = waiting.filter((a) => releaseCheck(d, a).storageState === "at_cashier");
  const a = d.awbs.find((x) => x.id === selId);
  function onScan(code: string) {
    setScan(""); const x = findAwbByCode(d, code);
    if (!x) return setErr(t(`ບໍ່ພົບ AWB ${code}. ກວດເລກ ແລ້ວສະແກນອີກຄັ້ງ.`, `No AWB matches ${code}. Check the number and scan again.`));
    if (x.dest !== st) return setErr(t(`AWB ${x.no} ມີປາຍທາງ ${x.dest}. ມອບສິນຄ້ານີ້ທີ່ ${st} ບໍ່ໄດ້.`, `AWB ${x.no} is bound for ${x.dest}, so it cannot be delivered at ${st}.`));
    select(x.id);
  }
  const statusCell = (x: Awb) => { const c = releaseCheck(d, x); if (c.ready) return <Badge tone="ok">{t("ພ້ອມມອບ", "Ready")}</Badge>; if (!c.customsOk) return <Badge tone="bad">{t("ຕິດພາສີ", "Customs")}</Badge>; if (c.storageState === "at_cashier") return <Badge tone="warn">{t("ລໍຖ້າຊໍາລະ", "At cashier")}</Badge>; if (c.storageState === "to_bill") return <Badge tone="warn">{t("ມີຄ່າຝາກສາງ", "Storage due")}</Badge>; if (!c.paidOk) return <Badge tone="warn">{t("ຍັງບໍ່ຊໍາລະ", "Unpaid")}</Badge>; return <Badge>{stageName(t, x.stage)}</Badge>; };
  const cols: Col<Awb>[] = [
    { key: "no", header: t("ເລກ AWB", "AWB number"), render: (x) => <span className="font-mono text-[13px] font-semibold text-brand whitespace-nowrap">{x.no}</span>, sort: (x) => x.no },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (x) => <Route from={x.origin} to={x.dest} /> },
    { key: "co", header: t("ຜູ້ຮັບ", "Consignee"), render: (x) => <span className="line-clamp-1">{customerName(d, x.consigneeId)}</span>, sort: (x) => customerName(d, x.consigneeId) },
    { key: "comm", header: t("ສິນຄ້າ", "Commodity"), render: (x) => <span className="inline-flex items-center gap-1.5"><span className="line-clamp-1">{comm(x)}</span><ShcTags codes={x.shc} /></span> },
    { key: "pcs", header: t("ກ່ອງ", "Pcs"), align: "right", render: (x) => x.pieces },
    { key: "zone", header: t("ໂຊນ", "Zone"), render: (x) => <span className="font-mono text-[13px]">{d.zones.find((z) => z.id === x.zoneId)?.code ?? "—"}</span> },
    { key: "days", header: t("ວັນໃນສາງ", "Days"), align: "right", render: (x) => releaseCheck(d, x).storage.days, sort: (x) => releaseCheck(d, x).storage.days },
    { key: "fee", header: t("ຄ່າຝາກສາງ", "Storage"), align: "right", render: (x) => { const s = releaseCheck(d, x).storage; return <span className="whitespace-nowrap">{s.fee ? money(s.fee, s.currency) : t("ບໍ່ມີຄ່າ", "No fee")}</span>; }, sort: (x) => releaseCheck(d, x).storage.fee },
    { key: "st", header: t("ສະຖານະ", "Status"), render: statusCell },
  ];
  const doneCols: Col<Awb>[] = [
    { key: "at", header: t("ມອບເມື່ອ", "Delivered at"), render: (x) => <span className="tnum whitespace-nowrap">{fmtDateTime(x.deliveredAt)}</span>, sort: (x) => x.deliveredAt ?? "" },
    { key: "no", header: t("ເລກ AWB", "AWB number"), render: (x) => <span className="font-mono text-[13px] font-semibold text-brand whitespace-nowrap">{x.no}</span> },
    { key: "co", header: t("ຜູ້ຮັບຕາມ AWB", "Consignee"), render: (x) => <span className="line-clamp-1">{customerName(d, x.consigneeId)}</span> },
    { key: "rec", header: t("ຜູ້ມາຮັບ", "Received by"), render: (x) => x.delivery?.receiverName ?? "—" },
    { key: "ph", header: t("ເບີໂທ", "Phone"), render: (x) => <span className="tnum whitespace-nowrap">{x.delivery?.receiverPhone ?? "—"}</span> },
    { key: "pcs", header: t("ກ່ອງ", "Pcs"), align: "right", render: (x) => x.pieces },
    { key: "fee", header: t("ຄ່າຝາກສາງ", "Storage"), align: "right", render: (x) => <span className="whitespace-nowrap">{x.delivery?.storageFee ? money(x.delivery.storageFee, x.delivery.currency) : t("ບໍ່ມີຄ່າ", "No fee")}</span> },
  ];
  return <>
    <PageHeader title={t("ມອບສິນຄ້າ", "Delivery and pickup")} subtitle={t(`ກວດເອກະສານ, ພາສີ ແລະ ຄ່າຝາກສາງ ກ່ອນມອບສິນຄ້າທີ່ສະຖານີ ${st}`, `Check documents, customs and storage before release at ${st}`)} />
    <StatRow items={[
      { label: t("ລໍຖ້າຜູ້ມາຮັບ", "Waiting for pickup"), value: waiting.length },
      { label: t("ພ້ອມມອບ", "Ready to release"), value: ready.length, tone: "ok" },
      { label: t("ລໍຖ້າຊໍາລະທີ່ແຄັດເຊຍ", "Waiting at the cashier"), value: atCashier.length, to: "/finance/cashier", tone: atCashier.length ? "warn" : undefined },
      { label: t("ມອບແລ້ວມື້ນີ້", "Delivered today"), value: delivered.filter((x) => x.deliveredAt?.slice(0, 10) === todayIso()).length },
    ]} />
    <Panel className="mb-4">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (scan.trim()) onScan(scan.trim()); }}>
        <div className="relative min-w-[260px] flex-1 max-w-md"><ScanLine size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden /><Input autoFocus aria-label={t("ເລກ AWB", "AWB number")} className="pl-8 font-mono" placeholder={t("ສະແກນ ຫຼື ພິມເລກ AWB", "Scan or type the AWB number")} value={scan} onChange={(e) => setScan(e.target.value)} /></div>
        <Button type="submit" variant="primary" disabled={!scan.trim()}>{t("ຄົ້ນຫາ", "Look up")}</Button>
      </form>
      {err && <div className="mt-2"><Callout tone="bad">{err}</Callout></div>}
    </Panel>
    {a && a.dest === st && <Release key={a.id} a={a} canOp={canOp} onClear={() => select(null)} />}
    <Panel flush title={t("ສິນຄ້າລໍຖ້າຜູ້ມາຮັບ", "Cargo waiting for pickup")} className="mb-4">
      <DataTable rows={waiting} columns={cols} rowKey={(x) => x.id} pageSize={8} minWidth={1020} defaultSort={{ key: "days", dir: "asc" }} onRowClick={(x) => { select(x.id); window.scrollTo({ top: 0 }); }} search={(x) => `${x.prefix}${x.serial} ${customerName(d, x.consigneeId)} ${x.commodity}`} empty={<Empty icon={PackageOpen} title={t("ບໍ່ມີສິນຄ້າລໍຖ້າຮັບ", "No cargo is waiting for pickup")}>{t("ສິນຄ້າຈະປາກົດຢູ່ນີ້ ຫຼັງຮັບເຂົ້າສາງ.", "Cargo shows here once it is received into the warehouse.")}</Empty>} />
    </Panel>
    <Panel flush title={t("ມອບແລ້ວລ່າສຸດ", "Recently delivered")}>
      <DataTable rows={delivered} columns={doneCols} rowKey={(x) => x.id} pageSize={8} minWidth={820} defaultSort={{ key: "at", dir: "desc" }} onRowClick={(x) => { select(x.id); window.scrollTo({ top: 0 }); }} empty={<Empty title={t("ຍັງບໍ່ມີການມອບສິນຄ້າ", "Nothing delivered yet")} />} />
    </Panel>
  </>;
}

function Release({ a, canOp, onClear }: { a: Awb; canOp: boolean; onClear: () => void }) {
  const d = useDb(); const t = useT(); const lang = useLang(); const c = releaseCheck(d, a); const delivered = c.delivered;
  const [docs, setDocs] = useState(false); const [receiver, setReceiver] = useState(""); const [phone, setPhone] = useState(""); const [idNo, setIdNo] = useState(""); const [tried, setTried] = useState(false); const [print, setPrint] = useState<null | "sheet" | "bill">(null);
  const fee = delivered ? a.delivery?.storageFee ?? 0 : c.storage.fee; const days = delivered ? a.delivery?.storageDays ?? 0 : c.storage.days; const currency = delivered ? a.delivery?.currency ?? "LAK" : c.storage.currency;
  const customsDocs = customsDocList(a); const docsGot = awbDocs(a); const docsDone = customsDocs.filter((x) => docsGot.includes(x.key)).length;
  const openIrr = d.irregularities.filter((r) => r.awbId === a.id && r.status !== "closed");
  const errs = { docs: !docs, name: !receiver.trim(), phone: !phone.trim(), id: !idNo.trim() }; const receipt = d.receipts.find((r) => r.id === a.receiptId);
  function release() {
    setTried(true); if (Object.values(errs).some(Boolean) || !c.ready) return;
    deliverCargo(a.id, { receiverName: receiver.trim(), receiverPhone: phone.trim(), idNo: idNo.trim(), documentsChecked: true, storageFee: c.storage.fee, storageDays: c.storage.days, currency: c.storage.currency });
    toast(t(`ມອບ ${a.no} ແລ້ວ`, `${a.no} delivered`)); setPrint("sheet");
  }
  const customsText: Record<string, [string, string]> = { pending: ["ຍັງບໍ່ຍື່ນໃບແຈ້ງພາສີ", "Declaration not yet submitted"], submitted: ["ຍື່ນແລ້ວ ລໍຖ້າພາສີອະນຸມັດ", "Submitted, waiting for Customs"], hold: ["ພາສີກັກສິນຄ້ານີ້ໄວ້", "Customs is holding this cargo"], cleared: ["ຜ່ານພາສີແລ້ວ", "Cleared by Customs"] };
  return <div className="mb-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
    <div className="space-y-4">
      <Panel title={<span className="font-mono">{a.no}</span>} actions={<><Button size="sm" icon={Printer} onClick={() => setPrint("sheet")}>{t("ພິມໃບມອບສິນຄ້າ", "Print delivery sheet")}</Button><Button size="sm" icon={FileText} onClick={() => setPrint("bill")}>{t("ພິມໃບຄ່າຝາກສາງ", "Print storage bill")}</Button><Button size="sm" variant="ghost" icon={X} onClick={onClear}>{t("ປິດ", "Close")}</Button></>}>
        <Dl cols={3} items={[
          { label: t("ເສັ້ນທາງ", "Route"), value: <Route from={a.origin} to={a.dest} /> },
          { label: t("ຖ້ຽວບິນ", "Flight"), value: <span className="font-mono text-[13px]">{a.flightId ? flightLabel(d, a.flightId) : [...a.events].reverse().find((e) => e.flightNo)?.flightNo ?? "—"}</span> },
          { label: t("ມາຮອດ", "Arrived"), value: <span className="tnum">{fmtDateTime(a.arrivedAt)}</span> },
          { label: t("ຜູ້ສົ່ງ", "Shipper"), value: customerName(d, a.shipperId) },
          { label: t("ຜູ້ຮັບ", "Consignee"), value: customerName(d, a.consigneeId) },
          { label: t("ເບີໂທຜູ້ຮັບ", "Consignee phone"), value: <span className="tnum">{d.customers.find((x) => x.id === a.consigneeId)?.phone ?? "—"}</span> },
          { label: t("ສິນຄ້າ", "Nature of goods"), value: <span className="inline-flex flex-wrap items-center gap-1.5">{bi(t, a.commodity)}<ShcTags codes={a.shc} /></span> },
          { label: t("ກ່ອງ ແລະ ນໍ້າໜັກ", "Pieces and weight"), value: <span className="tnum">{a.pieces} · {kg(a.grossKg)}</span> },
          { label: t("ໂຊນໃນສາງ", "Warehouse zone"), value: <span className="font-mono text-[13px]">{d.zones.find((z) => z.id === a.zoneId)?.code ?? "—"}</span> },
        ]} />
        {openIrr.length > 0 && <div className="mt-3"><Callout tone="warn" title={t(`ມີບັນທຶກຄວາມຜິດປົກກະຕິ ${openIrr.length} ລາຍການ`, `${openIrr.length} open irregularity record(s)`)}>{openIrr.map((r) => r.no).join(", ")}: {openIrr[0].note}. {t("ແຈ້ງຜູ້ຮັບກ່ອນມອບສິນຄ້າ.", "Tell the receiver before release.")} <Link className="font-medium text-brand hover:underline" to="/wms/irregularities">{t("ເບິ່ງບັນທຶກ", "View records")}</Link></Callout></div>}
      </Panel>
      {delivered ? <Callout tone="ok" title={t("ມອບສິນຄ້ານີ້ແລ້ວ", "This cargo has been delivered")}>{a.delivery ? <>{a.delivery.receiverName} · <span className="tnum">{a.delivery.receiverPhone}</span>{a.delivery.idNo && ` · ${a.delivery.idNo}`} · <span className="tnum">{fmtDateTime(a.delivery.signedAt)}</span> · {userName(d, a.delivery.by, lang)}</> : <span className="tnum">{fmtDateTime(a.deliveredAt)}</span>}</Callout> :
      <Panel flush title={t("ກວດກ່ອນມອບສິນຄ້າ", "Release checks")}><ul className="divide-y divide-line">
        <Gate state={c.received ? "ok" : "block"} title={t("ຮັບເຂົ້າສາງ", "Received into the warehouse")} action={!c.received && <Link to="/wms/inbound"><Button size="sm">{t("ໄປຮັບເຂົ້າສາງ", "Go to goods receipt")}</Button></Link>}>{c.received ? t(`${a.receivedPieces} ຈາກ ${a.pieces} ກ່ອງ`, `${a.receivedPieces} of ${a.pieces} pieces`) : t("ຕ້ອງຮັບເຂົ້າສາງກ່ອນມອບ.", "Receive the cargo before release.")}</Gate>
        <Gate state={docs ? "ok" : "wait"} title={t("ກວດເອກະສານ", "Documents check")}><span className="mt-1 block"><Checkbox label={t("ກວດ AWB ສະບັບຜູ້ຮັບ ແລະ ບັດປະຈໍາຕົວຂອງຜູ້ມາຮັບແລ້ວ", "AWB consignee copy and the receiver's ID are checked")} checked={docs} onChange={setDocs} /></span></Gate>
        {c.customsRequired ? <Gate state={c.customsOk ? "ok" : "block"} title={t("ພາສີ", "Customs")} action={!c.customsOk && <Link to="/import/customs"><Button size="sm">{t("ໄປໜ້າພາສີ", "Go to Customs")}</Button></Link>}>{t(customsText[c.customsStatus ?? "pending"][0], customsText[c.customsStatus ?? "pending"][1])}{a.customs?.declarationNo && <span className="font-mono text-[13px]"> · {a.customs.declarationNo}</span>} · {t(`ເອກະສານ ${docsDone}/${customsDocs.length}`, `Documents ${docsDone}/${customsDocs.length}`)}{a.customs?.note && ` · ${a.customs.note}`}{!c.customsOk && <span className="block font-medium text-bad">{t("ມອບບໍ່ໄດ້ຈົນກວ່າຈະຜ່ານພາສີ.", "Cannot be released until cleared.")}</span>}</Gate> : <Gate state="ok" title={t("ພາສີ", "Customs")}>{t("ສາຍພາຍໃນ ບໍ່ຕ້ອງຜ່ານພາສີ.", "Domestic cargo needs no customs clearance.")}</Gate>}
        <Gate state={c.storageOk ? "ok" : c.storageState === "to_bill" ? "block" : "wait"} title={t("ຄ່າຝາກສາງ", "Storage fee")} action={c.storageState === "to_bill" ? <Button size="sm" variant="primary" icon={Wallet} disabled={!canOp} onClick={() => { chargeStorage(a.id); toast(t("ສົ່ງຄ່າຝາກສາງໄປແຄັດເຊຍແລ້ວ", "Storage fee sent to the cashier")); }}>{t("ສົ່ງໄປແຄັດເຊຍ", "Send to cashier")}</Button> : c.storageState === "at_cashier" ? <Link to="/finance/cashier"><Button size="sm" icon={Wallet}>{t("ໄປແຄັດເຊຍ", "Go to cashier")}</Button></Link> : undefined}>
          {c.storageState === "none" ? (c.storage.sameDay ? <span className="font-medium text-ok">{t("ຮັບພາຍໃນມື້: ບໍ່ເສຍຄ່າ", "Same-day pickup: no fee")}</span> : t(`${days} ວັນ ຢູ່ໃນໄລຍະຟຣີ: ບໍ່ເສຍຄ່າ`, `${days} day(s) within the free period: no fee`)) : <><b className="tnum text-ink">{money(fee, currency)}</b> · {t(`${days} ວັນ`, `${days} day(s)`)} · {c.storage.tariff ? `${num(c.storage.tariff.rate)} ${c.storage.tariff.currency}/kg/${t("ວັນ", "day")} × ${kg(a.chargeableKg)}` : ""}{c.storageState === "at_cashier" && <span className="block font-medium text-warn">{t("ລໍຖ້າຊໍາລະທີ່ແຄັດເຊຍ. ມອບບໍ່ໄດ້ຈົນກວ່າຈະຊໍາລະ.", "Waiting at the cashier. Cannot be released until paid.")}</span>}{c.storageState === "paid" && <span className="block font-medium text-ok">{t("ຊໍາລະແລ້ວ", "Paid")}{receipt && ` · ${receipt.no}`}</span>}</>}
        </Gate>
        {!c.paidOk && c.storageState === "none" && <Gate state="block" title={t("ຄ່າຂົນສົ່ງຄ້າງຊໍາລະ", "Charges unpaid")} action={<Link to="/finance/cashier"><Button size="sm" icon={Wallet}>{t("ໄປແຄັດເຊຍ", "Go to cashier")}</Button></Link>}>{t("AWB ນີ້ຍັງມີຄ່າທີ່ຕ້ອງຊໍາລະ.", "This AWB still has charges to pay.")}</Gate>}
      </ul></Panel>}
    </div>
    {!delivered && <Panel title={t("ຂໍ້ມູນຜູ້ມາຮັບ", "Receiver")}>
      <div className="grid gap-3">
        <Field label={t("ຊື່ຜູ້ມາຮັບ", "Receiver name")} required error={tried && errs.name ? t("ໃສ່ຊື່ຜູ້ມາຮັບ.", "Enter the receiver's name.") : undefined}><Input value={receiver} onChange={(e) => setReceiver(e.target.value)} /></Field>
        <Field label={t("ເບີໂທ", "Phone number")} required error={tried && errs.phone ? t("ໃສ່ເບີໂທ.", "Enter the phone number.") : undefined}><Input className="tnum" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label={t("ເລກບັດປະຈໍາຕົວ", "ID number")} required error={tried && errs.id ? t("ໃສ່ເລກບັດປະຈໍາຕົວ ຫຼື ໜັງສືຜ່ານແດນ.", "Enter the ID card or passport number.") : undefined}><Input value={idNo} onChange={(e) => setIdNo(e.target.value)} /></Field>
        {tried && errs.docs && <Callout tone="bad">{t("ໝາຍຕິກກວດເອກະສານກ່ອນມອບສິນຄ້າ.", "Tick the documents check before release.")}</Callout>}
        {!canOp && <Callout tone="warn">{t("ບົດບາດຂອງທ່ານບໍ່ມີສິດມອບສິນຄ້າ.", "Your role cannot release cargo.")}</Callout>}
        {canOp && !c.ready && <p className="text-xs text-ink-2">{t("ປຸ່ມຈະໃຊ້ໄດ້ ເມື່ອຜ່ານການກວດທຸກຂໍ້.", "The button unlocks once every check has passed.")}</p>}
        <Button size="lg" variant="success" icon={PackageOpen} disabled={!canOp || !c.ready} onClick={release}>{t("ຢືນຢັນມອບສິນຄ້າ", "Confirm delivery")}</Button>
      </div>
    </Panel>}
    <PrintSheet open={print === "sheet"} onClose={() => setPrint(null)} title={t("ໃບມອບສິນຄ້າ", "Delivery sheet")}><Sheet a={a} /></PrintSheet>
    <PrintSheet open={print === "bill"} onClose={() => setPrint(null)} title={t("ໃບຄ່າຝາກສາງ", "Storage bill")}><Bill a={a} /></PrintSheet>
  </div>;
}

const Head = ({ title, no }: { title: string; no: string }) => <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-2"><div><div className="text-sm font-semibold">LAO AIRLINES CARGO · ການບິນລາວ ພະແນກຂົນສົ່ງສິນຄ້າ</div><div className="text-xl font-semibold">{title}</div></div><div className="text-right text-[12px]"><div>AWB</div><div className="font-mono text-lg font-semibold">{no}</div></div></div>;
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <tr><th className="w-[38%] border border-black p-1.5 text-left text-[11px] font-normal">{label}</th><td className="border border-black p-1.5 text-[13px]">{children}</td></tr>;

function Sheet({ a }: { a: Awb }) {
  const d = useDb(); const lang = useLang(); const co = d.customers.find((c) => c.id === a.consigneeId); const sh = d.customers.find((c) => c.id === a.shipperId); const del = a.delivery;
  const flight = a.flightId ? flightLabel(d, a.flightId) : [...a.events].reverse().find((e) => e.flightNo)?.flightNo ?? "—";
  return <div className="text-black" style={{ fontFamily: "Noto Sans, Noto Sans Lao, sans-serif" }}>
    <Head title="ໃບມອບສິນຄ້າ / Delivery sheet" no={a.no} />
    <div className="my-3"><Barcode value={`${a.prefix}${a.serial}`} height={38} /></div>
    <table className="w-full border-collapse"><tbody>
      <Row label="ຖ້ຽວບິນ / Flight">{flight} · <span className="font-mono">{a.origin} → {a.dest}</span></Row>
      <Row label="ມາຮອດ / Arrived">{fmtDateTime(a.arrivedAt)}</Row>
      <Row label="ຜູ້ສົ່ງ / Shipper">{sh?.nameEn ?? "—"}</Row>
      <Row label="ຜູ້ຮັບ / Consignee">{co?.nameEn ?? "—"}{co?.phone && ` · ${co.phone}`}</Row>
      <Row label="ຄ່າຝາກສາງ / Storage">{del ? (del.storageFee ? `${money(del.storageFee, del.currency)} · ${del.storageDays} days` : "ບໍ່ມີຄ່າ / No fee") : "ຕາມໃບຄ່າຝາກສາງ / See storage bill"}</Row>
    </tbody></table>
    <div className="mt-4 mb-1 text-[13px] font-semibold">ລາຍການສິນຄ້າ / List of goods</div>
    <table className="w-full border-collapse text-[12px]"><thead><tr>{["ລໍາດັບ / No.", "ລາຍການ / Description", "ກ່ອງ / Pieces", "ນໍ້າໜັກ / Weight (kg)", "ສະພາບ / Condition"].map((h) => <th key={h} className="border border-black p-1.5 text-left font-normal">{h}</th>)}</tr></thead><tbody>
      {a.houses.length > 0 ? a.houses.map((h, i) => <tr key={h.id}><td className="border border-black p-1.5">{i + 1}</td><td className="border border-black p-1.5">{h.commodity} ({h.hawb})</td><td className="border border-black p-1.5">{h.pieces}</td><td className="border border-black p-1.5">{h.weightKg}</td><td className="border border-black p-1.5">{a.condition}</td></tr>) : <tr><td className="border border-black p-1.5">1</td><td className="border border-black p-1.5">{a.commodity}{a.shc.length > 0 && ` · ${a.shc.join(", ")}`}</td><td className="border border-black p-1.5">{a.pieces}</td><td className="border border-black p-1.5">{a.grossKg}</td><td className="border border-black p-1.5">{a.condition}{a.conditionNote && `: ${a.conditionNote}`}</td></tr>}
      <tr><td className="border border-black p-1.5 font-semibold" colSpan={2}>ລວມ / Total</td><td className="border border-black p-1.5 font-semibold">{a.pieces}</td><td className="border border-black p-1.5 font-semibold">{a.grossKg}</td><td className="border border-black p-1.5" /></tr>
    </tbody></table>
    <p className="mt-4 text-[12px]">ຂ້າພະເຈົ້າໄດ້ຮັບສິນຄ້າຕາມລາຍການຂ້າງເທິງຄົບຖ້ວນ ໃນສະພາບທີ່ລະບຸໄວ້. / I have received the goods listed above, complete and in the condition stated.</p>
    <div className="mt-8 grid grid-cols-2 gap-10 text-[13px]">
      <div><div className="font-semibold">ຜູ້ຮັບສິນຄ້າ / Receiver</div><div className="mt-10 border-b border-black" /><div className="mt-1 text-[11px]">ລາຍເຊັນ / Signature</div>
        <div className="mt-4 flex items-end gap-2"><span className="whitespace-nowrap text-[11px]">ຊື່ / Name</span><span className="flex-1 border-b border-black pb-0.5">{del?.receiverName ?? " "}</span></div>
        <div className="mt-4 flex items-end gap-2"><span className="whitespace-nowrap text-[11px]">ເບີໂທ / Phone number</span><span className="flex-1 border-b border-black pb-0.5">{del?.receiverPhone ?? " "}</span></div>
        <div className="mt-4 flex items-end gap-2"><span className="whitespace-nowrap text-[11px]">ບັດປະຈໍາຕົວ / ID</span><span className="flex-1 border-b border-black pb-0.5">{del?.idNo ?? " "}</span></div></div>
      <div><div className="font-semibold">ພະນັກງານສາງ / Warehouse officer</div><div className="mt-10 border-b border-black" /><div className="mt-1 text-[11px]">ລາຍເຊັນ / Signature</div>
        <div className="mt-4 flex items-end gap-2"><span className="whitespace-nowrap text-[11px]">ຊື່ / Name</span><span className="flex-1 border-b border-black pb-0.5">{del ? userName(d, del.by, lang) : " "}</span></div>
        <div className="mt-4 flex items-end gap-2"><span className="whitespace-nowrap text-[11px]">ວັນທີ / Date</span><span className="flex-1 border-b border-black pb-0.5">{del ? fmtDateTime(del.signedAt) : fmtDate(todayIso())}</span></div></div>
    </div>
  </div>;
}

function Bill({ a }: { a: Awb }) {
  const d = useDb(); const c = releaseCheck(d, a); const co = d.customers.find((x) => x.id === a.consigneeId); const line = a.charges.find((x) => x.kind === "storage"); const del = a.delivery; const receipt = d.receipts.find((r) => r.id === a.receiptId);
  const fee = del ? del.storageFee : c.storage.fee; const days = del ? del.storageDays : c.storage.days; const currency = del ? del.currency : c.storage.currency; const tariff = c.storage.tariff;
  const paidState = fee === 0 ? "ບໍ່ມີຄ່າ / No fee" : c.storageState === "paid" || (del && a.paid) ? `ຊໍາລະແລ້ວ / Paid${receipt ? ` · ${receipt.no}` : ""}` : c.storageState === "at_cashier" ? "ລໍຖ້າຊໍາລະທີ່ແຄັດເຊຍ / Waiting at the cashier" : "ຍັງບໍ່ຊໍາລະ / Not yet billed";
  return <div className="text-black" style={{ fontFamily: "Noto Sans, Noto Sans Lao, sans-serif" }}>
    <Head title="ໃບຄ່າຝາກສາງ / Storage bill" no={a.no} />
    <table className="mt-4 w-full border-collapse"><tbody>
      <Row label="ຜູ້ຮັບ / Consignee">{co?.nameEn ?? "—"}{co?.phone && ` · ${co.phone}`}</Row>
      <Row label="ສິນຄ້າ / Nature of goods">{a.commodity} · {a.pieces} PCS</Row>
      <Row label="ນໍ້າໜັກຄິດເງິນ / Chargeable weight">{kg(a.chargeableKg)}</Row>
      <Row label="ມາຮອດ / Arrived">{fmtDateTime(a.arrivedAt)}</Row>
      <Row label="ວັນທີຄິດເງິນ / Billed on">{del ? fmtDateTime(del.signedAt) : fmtDate(todayIso())}</Row>
      <Row label="ຈໍານວນວັນ / Days in store">{days}</Row>
      <Row label="ອັດຕາ / Rate">{tariff ? `${tariff.code}: ${num(tariff.rate)} ${tariff.currency}/kg/day · min ${money(tariff.minCharge, tariff.currency)}` : "—"}</Row>
      <Row label="ຄ່າຝາກສາງ / Storage fee"><b className="text-[15px]">{fee ? money(fee, currency) : "0"}</b>{!fee && " · ຮັບພາຍໃນມື້ ບໍ່ເສຍຄ່າ / Same-day pickup: no fee"}</Row>
      <Row label="ການຊໍາລະ / Payment">{paidState}</Row>
      {line && <Row label="ລາຍການໃນ AWB / Charge line">{line.code} · {line.nameEn}</Row>}
    </tbody></table>
    <div className="mt-10 grid grid-cols-2 gap-10 text-[12px]">{["ຜູ້ຊໍາລະ / Payer", "ແຄັດເຊຍ / Cashier"].map((x) => <div key={x}><div className="h-14 border-b border-black" /><div className="mt-1">{x}</div></div>)}</div>
  </div>;
}
