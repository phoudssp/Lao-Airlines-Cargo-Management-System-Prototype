import { customerName } from "@/ui/cargo";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ban, Bell, Pencil, Printer, ShieldCheck, Tag, Wallet } from "lucide-react";
import { useDb, useCan } from "@/lib/store";
import { bi, useLang, useName, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Confirm, Dialog, Dl, Empty, Field, Input, PageHeader, Panel, PrintSheet, Select, Textarea, toast } from "@/ui/kit";
import { AwbStrip, Barcode, flightLabel, Route, ShcTags, stageName, STAGE_NAMES, userName } from "@/ui/cargo";
import type { Awb, AwbEvent, Db, StageCode } from "@/lib/types";
import { fmtDate, fmtDateTime, kg, money, num, todayIso } from "@/lib/format";
import { correctAwb, voidAwb } from "@/lib/mock/awb";
import { notifyArrival } from "@/lib/mock/ops";

const EXTRA: Record<string, [string, string]> = { OFLD: ["ອ໋ອບໂຫຼດ", "Offloaded"], TFD: ["ຖ່າຍລໍາ", "Transferred"], DIS: ["ຜິດປົກກະຕິ", "Irregularity"], VOID: ["ຍົກເລີກ AWB", "AWB voided"], EDIT: ["ແກ້ໄຂ AWB", "AWB corrected"], RBK: ["ຈອງຖ້ຽວໃໝ່", "Rebooked"], PAY: ["ຊໍາລະເງິນ", "Payment taken"] };

export default function AwbDetail() {
  const { id } = useParams(); const d = useDb(); const t = useT(); const name = useName(); const lang = useLang(); const can = useCan(); const nav = useNavigate();
  const a = d.awbs.find((x) => x.id === id);
  const [print, setPrint] = useState<null | "awb" | "label">(null); const [askVoid, setAskVoid] = useState(false); const [edit, setEdit] = useState(false);
  if (!a) return <Empty title={t("ບໍ່ພົບ AWB ນີ້", "AWB not found")} action={<Link to="/export/awb"><Button>{t("ກັບໄປລາຍການ", "Back to the list")}</Button></Link>} />;
  const sh = d.customers.find((c) => c.id === a.shipperId); const co = d.customers.find((c) => c.id === a.consigneeId); const f = d.flights.find((x) => x.id === a.flightId);
  const voided = a.status === "voided"; const notDeparted = ["BKD", "RCS", "SCR", "MAN"].includes(a.stage);
  const evName = (e: AwbEvent) => { if (e.code in STAGE_NAMES) return stageName(t, e.code as StageCode); const x = EXTRA[e.code]; return x ? t(x[0], x[1]) : e.code; };
  return <>
    <PageHeader crumbs={[{ label: t("ໃບຂົນສົ່ງ AWB", "Air waybills"), to: "/export/awb" }, { label: a.no }]} title={a.no} subtitle={`${a.origin} → ${a.dest}${f ? ` · ${f.no} ${fmtDate(f.date)} ${f.std}` : ""}`} actions={<>
      {a.direction === "import" && !voided && a.stage !== "DLV" && <Button icon={Bell} onClick={() => { notifyArrival(a.id); toast(t("ສົ່ງແຈ້ງເຕືອນແລ້ວ", "Notice sent")); }}>{t("ແຈ້ງລູກຄ້າ", "Notify customer")}</Button>}
      {!a.paid && !voided && a.payMode === "cash" && <Link to="/finance/cashier"><Button icon={Wallet}>{t("ໄປຊໍາລະ", "Go to cashier")}</Button></Link>}
      {!voided && a.stage === "RCS" && <Link to="/export/screening"><Button icon={ShieldCheck}>{t("ບັນທຶກ X-Ray", "Record X-Ray")}</Button></Link>}
      <Button icon={Tag} onClick={() => setPrint("label")}>{t("ພິມປ້າຍ", "Print labels")}</Button>
      <Button icon={Printer} onClick={() => setPrint("awb")}>{t("ພິມ AWB", "Print AWB")}</Button>
      {!voided && notDeparted && can("awb.issue") && <Button icon={Pencil} onClick={() => setEdit(true)}>{t("ແກ້ໄຂ", "Correct")}</Button>}
      {!voided && notDeparted && can("awb.void") && <Button variant="danger" icon={Ban} onClick={() => setAskVoid(true)}>{t("ຍົກເລີກ AWB", "Void AWB")}</Button>}
    </>} />
    {voided && <div className="mb-4"><Callout tone="bad" title={t("AWB ນີ້ຖືກຍົກເລີກແລ້ວ", "This AWB is void")}>{a.voidReason}</Callout></div>}
    {a.offloadReason && !voided && <div className="mb-4"><Callout tone="warn" title={t("ສິນຄ້ານີ້ເຄີຍຖືກອ໋ອບໂຫຼດ", "This cargo was offloaded")}>{a.offloadReason}</Callout></div>}
    {a.staffNote && <div className="mb-4"><Callout tone="warn" title={t("ໝາຍເຫດສໍາລັບພະນັກງານ", "Note for staff")}>{a.staffNote}</Callout></div>}
    <div className="mb-4 rounded-md border border-line bg-surface p-3"><AwbStrip awb={a} size="lg" /></div>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Panel title={t("ລາຍລະອຽດສິນຄ້າ", "Shipment details")}><Dl cols={3} items={[
          { label: t("ຜູ້ສົ່ງ", "Shipper"), value: sh ? <Link className="text-brand hover:underline" to={`/crm/${sh.id}`}>{sh.name}</Link> : "—" },
          { label: t("ຜູ້ຮັບ", "Consignee"), value: co ? <Link className="text-brand hover:underline" to={`/crm/${co.id}`}>{co.name}</Link> : "—" },
          { label: t("ເສັ້ນທາງ", "Route"), value: <Route from={a.origin} to={a.dest} /> },
          { label: t("ສິນຄ້າ", "Nature of goods"), value: <span className="inline-flex flex-wrap items-center gap-1.5">{bi(t, a.commodity)}<ShcTags codes={a.shc} /></span> },
          { label: t("ຈໍານວນກ່ອງ", "Pieces"), value: <span className="tnum">{a.pieces}</span> },
          { label: t("ນໍ້າໜັກຕົວຈິງ", "Gross weight"), value: kg(a.grossKg) },
          { label: t("ນໍ້າໜັກບໍລິມາດ", "Volumetric weight"), value: kg(a.volumeKg) },
          { label: t("ນໍ້າໜັກຄິດເງິນ", "Chargeable weight"), value: <b className="tnum">{kg(a.chargeableKg)}</b> },
          { label: t("ສະພາບສິນຄ້າ", "Condition"), value: a.condition === "good" ? <Badge tone="ok">{t("ປົກກະຕິ", "Good")}</Badge> : <Badge tone="bad">{a.condition} {a.conditionNote && `· ${a.conditionNote}`}</Badge> },
          { label: t("ໂຊນໃນສາງ", "Warehouse zone"), value: d.zones.find((z) => z.id === a.zoneId)?.code ?? "—" },
          { label: t("ຜູ້ອອກ AWB", "Issued by"), value: `${userName(d, a.issuedBy, lang)} · ${fmtDateTime(a.issuedAt)}` },
          { label: t("ຜົນ X-Ray", "X-Ray result"), value: a.screening ? (a.screening.result === "pass" ? <Badge tone="ok">{t("ຜ່ານ", "Pass")} · {a.screening.machine}</Badge> : <Badge tone="bad">{t("ບໍ່ຜ່ານ", "Fail")}</Badge>) : <Badge>{t("ຍັງບໍ່ກວດ", "Not screened")}</Badge> },
        ]} /></Panel>
        <Panel title={t("ຂະໜາດສິນຄ້າ", "Dimensions")} flush><div className="overflow-x-auto"><table className="w-full min-w-[440px] text-sm"><thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-ink-2"><th className="px-3 py-2 font-semibold">{t("ກ່ອງ", "Pcs")}</th><th className="px-3 py-2 font-semibold">L x W x H (cm)</th><th className="px-3 py-2 text-right font-semibold">{t("ນໍ້າໜັກ", "Gross")}</th><th className="px-3 py-2 text-right font-semibold">{t("ບໍລິມາດ", "Volumetric")}</th></tr></thead><tbody>{a.lines.map((l) => <tr key={l.id} className="border-b border-line last:border-0"><td className="tnum px-3 py-2">{l.pieces}</td><td className="tnum px-3 py-2">{l.lengthCm} x {l.widthCm} x {l.heightCm}</td><td className="tnum px-3 py-2 text-right">{kg(l.weightKg)}</td><td className="tnum px-3 py-2 text-right">{num((l.lengthCm * l.widthCm * l.heightCm * l.pieces) / 6000, 1)} kg</td></tr>)}</tbody></table></div></Panel>
        {a.houses.length > 0 && <Panel title="HAWB" flush><table className="w-full text-sm"><thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-ink-2"><th className="px-3 py-2">HAWB</th><th className="px-3 py-2">{t("ຜູ້ສົ່ງ", "Shipper")}</th><th className="px-3 py-2">{t("ຜູ້ຮັບ", "Consignee")}</th><th className="px-3 py-2 text-right">{t("ກ່ອງ", "Pcs")}</th><th className="px-3 py-2 text-right">kg</th></tr></thead><tbody>{a.houses.map((h) => <tr key={h.id} className="border-b border-line last:border-0"><td className="px-3 py-2 font-mono text-[13px]">{h.hawb}</td><td className="px-3 py-2">{h.shipper}</td><td className="px-3 py-2">{h.consignee}</td><td className="tnum px-3 py-2 text-right">{h.pieces}</td><td className="tnum px-3 py-2 text-right">{h.weightKg}</td></tr>)}</tbody></table></Panel>}
        <Panel title={t("ປະຫວັດສະຖານະ", "Status history")} flush><ol>{[...a.events].reverse().map((e) => <li key={e.id} className="flex flex-wrap gap-x-3 border-b border-line px-4 py-2 text-sm last:border-0"><span className="w-[52px] font-mono text-[13px] font-semibold">{e.code}</span><span className="min-w-[150px] flex-1"><span className="font-medium">{evName(e)}</span>{e.flightNo && <span className="ml-1.5 font-mono text-[13px]">{e.flightNo}</span>}{e.note && <span className="block text-xs text-ink-2">{e.note}</span>}</span><span className="text-xs text-ink-2">{e.station} · {userName(d, e.userId, lang)}</span><span className="tnum text-xs text-ink-2">{fmtDateTime(e.ts)}</span></li>)}</ol></Panel>
      </div>
      <aside className="space-y-4">
        <Panel title={t("ຄ່າບໍລິການ", "Charges")}>
          <ul className="space-y-1 text-sm">{a.charges.map((c) => <li key={c.id} className="flex justify-between gap-3"><span>{name(c)}</span><span className="tnum whitespace-nowrap">{money(c.amount, c.currency)}</span></li>)}</ul>
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3"><span className="text-sm font-medium">{t("ລວມ", "Total")}</span><span className="tnum text-xl font-semibold">{money(a.charges.reduce((s, c) => s + c.amount, 0), a.currency)}</span></div>
          <div className="mt-2">{a.payMode === "credit" ? <Badge tone="info" noIcon>{t("ຕິດໜີ້", "Credit account")}{a.invoiceId && ` · ${d.invoices.find((i) => i.id === a.invoiceId)?.no}`}</Badge> : a.paid ? <Badge tone="ok">{t("ຈ່າຍແລ້ວ", "Paid")}{a.receiptId && ` · ${d.receipts.find((r) => r.id === a.receiptId)?.no}`}</Badge> : <Badge tone="warn">{t("ຍັງບໍ່ຈ່າຍ", "Unpaid")}</Badge>}</div>
        </Panel>
        <Panel title={t("ແຈ້ງເຕືອນລູກຄ້າ", "Customer notices")}>
          {d.notifications.filter((n) => n.awbId === a.id).length === 0 ? <p className="text-sm text-ink-2">{t("ຍັງບໍ່ໄດ້ສົ່ງແຈ້ງເຕືອນ.", "No notices sent yet.")}</p> : <ul className="space-y-2">{d.notifications.filter((n) => n.awbId === a.id).map((n) => <li key={n.id} className="text-sm"><div className="flex items-center justify-between gap-2"><Badge tone={n.channel === "whatsapp" ? "ok" : "warn"} noIcon>{n.channel === "whatsapp" ? "WhatsApp" : t("ໃຫ້ພະນັກງານໂທ", "Staff to call")}</Badge><span className="tnum text-xs text-ink-2">{fmtDateTime(n.ts)}</span></div><p className="mt-1 text-xs text-ink-2">{n.body}</p></li>)}</ul>}
        </Panel>
      </aside>
    </div>
    <PrintSheet open={print === "awb"} onClose={() => setPrint(null)} title={t("ພິມ AWB", "Print AWB")}><AwbForm a={a} d={d} /></PrintSheet>
    <PrintSheet open={print === "label"} onClose={() => setPrint(null)} title={t("ພິມປ້າຍສິນຄ້າ", "Print cargo labels")}><Labels a={a} d={d} /></PrintSheet>
    <Confirm open={askVoid} onClose={() => setAskVoid(false)} title={t(`ຍົກເລີກ AWB ${a.no}?`, `Void AWB ${a.no}?`)} body={t("ເລກນີ້ຈະບໍ່ສາມາດໃຊ້ໄດ້ອີກ ແລະ ຖືກນັບເປັນເລກທີ່ຍົກເລີກໃນຊ່ວງເລກ AWB.", "This number can't be used again and counts as voided in the AWB range.")} reasonLabel={t("ເຫດຜົນ", "Reason")} confirmLabel={t("ຍົກເລີກ AWB", "Void AWB")} danger onConfirm={(r) => { voidAwb(a.id, r); toast(t("ຍົກເລີກ AWB ແລ້ວ", "AWB voided")); nav("/export/awb"); }} />
    {edit && <CorrectDialog a={a} onClose={() => setEdit(false)} />}
  </>;
}

function CorrectDialog({ a, onClose }: { a: Awb; onClose: () => void }) {
  const d = useDb(); const t = useT(); const [commodity, setC] = useState(a.commodity); const [consigneeId, setCo] = useState(a.consigneeId); const [flightId, setF] = useState(a.flightId ?? ""); const [reason, setR] = useState("");
  const flights = d.flights.filter((f) => f.origin === a.origin && f.dest === a.dest && f.status === "open" && f.date >= todayIso());
  return <Dialog open onClose={onClose} title={t(`ແກ້ໄຂ ${a.no}`, `Correct ${a.no}`)} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" disabled={!reason.trim()} onClick={() => { correctAwb(a.id, { commodity, consigneeId, flightId: flightId || undefined }, reason.trim()); toast(t("ບັນທຶກການແກ້ໄຂແລ້ວ", "Correction saved")); onClose(); }}>{t("ບັນທຶກ", "Save")}</Button></>}>
    <div className="grid gap-3"><Field label={t("ລາຍລະອຽດສິນຄ້າ", "Nature of goods")}><Input value={commodity} onChange={(e) => setC(e.target.value)} /></Field>
      <Field label={t("ຜູ້ຮັບ", "Consignee")}><Select value={consigneeId} onChange={(e) => setCo(e.target.value)} options={d.customers.map((c) => ({ value: c.id, label: customerName(d, c.id) }))} /></Field>
      <Field label={t("ຖ້ຽວບິນ", "Flight")}><Select value={flightId} onChange={(e) => setF(e.target.value)} placeholder={t("ກໍານົດພາຍຫຼັງ", "Assign later")} options={flights.map((f) => ({ value: f.id, label: `${f.no} ${fmtDate(f.date)} ${f.std}` }))} /></Field>
      <Field label={t("ເຫດຜົນການແກ້ໄຂ (ບັນທຶກໃນ Audit Trail)", "Reason for the correction (kept in the audit trail)")} required><Textarea value={reason} onChange={(e) => setR(e.target.value)} /></Field></div>
  </Dialog>;
}

const Box = ({ label, children, className = "" }: { label: string; children?: React.ReactNode; className?: string }) => <div className={`border border-black p-1 ${className}`}><div className="text-[9px] leading-3">{label}</div><div className="min-h-[18px] text-[12px] leading-4">{children}</div></div>;
function AwbForm({ a, d }: { a: Awb; d: Db }) {
  const sh = d.customers.find((c) => c.id === a.shipperId); const co = d.customers.find((c) => c.id === a.consigneeId); const f = d.flights.find((x) => x.id === a.flightId);
  return <div className="text-black" style={{ fontFamily: "Noto Sans, Noto Sans Lao, sans-serif" }}>
    <div className="mb-1 flex items-end justify-between"><div className="font-mono text-lg font-semibold">{a.prefix} {a.origin} {a.serial.slice(0, 4)} {a.serial.slice(4)}</div><Barcode value={`${a.prefix}${a.serial}`} height={34} width={1.3} /></div>
    <div className="grid grid-cols-2">
      <Box label="Shipper's Name and Address"><b>{sh?.nameEn}</b><br />{sh?.address}<br />{sh?.phone}</Box>
      <Box label="Not negotiable — Air Waybill. Issued by"><b>LAO AIRLINES STATE ENTERPRISE</b><br />Cargo Department, Wattay Airport, Vientiane. P.O. Box 6441<br />cargo@laoairlines.com</Box>
      <Box label="Consignee's Name and Address"><b>{co?.nameEn}</b><br />{co?.address}<br />{co?.phone}</Box>
      <Box label="Handling Information">{a.shc.length ? `SHC: ${a.shc.join(", ")}` : "—"}{a.houses.length > 0 && ` · ${a.houses.length} HAWB attached`}</Box>
      <Box label="Airport of Departure">{a.origin} {d.stations.find((s) => s.code === a.origin)?.nameEn}</Box>
      <Box label="Airport of Destination">{a.dest} {d.stations.find((s) => s.code === a.dest)?.nameEn}</Box>
      <Box label="Flight / Date">{f ? `${f.no} / ${fmtDate(f.date)}` : "—"}</Box>
      <Box label="Currency / Payment">{a.currency} · {a.payMode === "cash" ? "PP" : "CREDIT"}</Box>
    </div>
    <table className="mt-1 w-full border-collapse text-[11px]"><thead><tr>{["No. of Pieces", "Gross Weight (kg)", "Chargeable Weight (kg)", "Total", "Nature and Quantity of Goods (incl. Dimensions)"].map((h) => <th key={h} className="border border-black p-1 text-left font-normal">{h}</th>)}</tr></thead><tbody><tr><td className="border border-black p-1">{a.pieces}</td><td className="border border-black p-1">{a.grossKg}</td><td className="border border-black p-1">{a.chargeableKg}</td><td className="border border-black p-1">{money(a.charges[0]?.amount ?? 0, a.currency)}</td><td className="border border-black p-1">{a.commodity}<br />{a.lines.map((l) => `${l.pieces} x ${l.lengthCm}x${l.widthCm}x${l.heightCm} cm`).join("; ")}<br />Volumetric {a.volumeKg} kg</td></tr></tbody></table>
    <div className="mt-1 grid grid-cols-2"><div>{a.charges.map((c) => <Box key={c.id} label={c.nameEn}>{money(c.amount, c.currency)}</Box>)}<Box label="Total Prepaid / Collect"><b>{money(a.charges.reduce((s, c) => s + c.amount, 0), a.currency)}</b></Box></div>
      <div><Box label="Shipper certifies that the particulars on the face hereof are correct." className="h-[84px]">Signature of Shipper or his Agent</Box><Box label="Executed on (date) at (place)">{fmtDate(a.issuedAt)} at {a.station}</Box><Box label="Signature of Issuing Carrier or its Agent" className="h-[64px]">{d.users.find((u) => u.id === a.issuedBy)?.nameEn}</Box></div></div>
    <p className="mt-2 text-[10px]">Prototype layout for review. The final print layout will follow the airline's approved AWB form.</p>
  </div>;
}
function Labels({ a, d }: { a: Awb; d: Db }) {
  const f = d.flights.find((x) => x.id === a.flightId); const count = Math.min(a.pieces, 6);
  return <div className="grid grid-cols-2 gap-3 text-black">{Array.from({ length: count }).map((_, i) => <div key={i} className="break-inside-avoid border-2 border-black p-3">
    <div className="flex justify-between text-[11px]"><b>LAO AIRLINES CARGO</b><span>{i + 1} / {a.pieces}</span></div>
    <div className="mt-1 flex items-center justify-between font-mono"><span className="text-[42px] font-semibold leading-none">{a.dest}</span><span className="text-right text-[12px]">FROM {a.origin}<br />{f ? `${f.no} ${fmtDate(f.date)}` : ""}</span></div>
    <div className="mt-2"><Barcode value={`${a.prefix}${a.serial}`} height={46} /></div>
    <div className="mt-1 flex justify-between text-[11px]"><span>{a.pieces} PCS · {a.grossKg} KG</span><span className="font-mono font-semibold">{a.shc.join(" ")}</span></div>
  </div>)}{a.pieces > count && <p className="col-span-2 text-xs">Preview shows {count} of {a.pieces} labels.</p>}</div>;
}
