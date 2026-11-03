import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckSquare, FileDown, History, PackageOpen, Send } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Badge, Button, Callout, Col, Confirm, cx, DataTable, Empty, IconButton, PageHeader, Panel, toast } from "@/ui/kit";
import { AwbLink, customerName, Route, ShcTags } from "@/ui/cargo";
import type { Awb } from "@/lib/types";
import { daysBetween, fmtDate, fmtDateTime, kg, money, num, todayIso } from "@/lib/format";
import { AGING_BANDS, agingBand, scopeOf, storageFee } from "@/lib/pricing";
import { notifyAging } from "@/lib/mock/ops";
import { exportExcel } from "@/lib/export";

const bandLabel = (b: string) => b === "90+" ? "> 90" : b;

export default function Aging() {
  const d = useDb(); const t = useT(); const can = useCan(); const st = d.session.station; const canOp = can("import.operate");
  const comm = (a: Awb) => a.commodity.split(" / ")[t("0", "1") === "0" ? 0 : 1] ?? a.commodity;
  const [band, setBand] = useState(""); const [sel, setSel] = useState<Set<string>>(new Set()); const [ask, setAsk] = useState<string[] | null>(null);
  const all = useMemo(() => d.awbs.filter((a) => a.direction === "import" && a.status === "active" && a.dest === st && a.stage !== "DLV" && a.arrivedAt).map((a) => {
    const days = Math.max(0, daysBetween(a.arrivedAt!, todayIso())); const s = storageFee(d, { scope: scopeOf(d, a.origin, a.dest), chargeableKg: a.chargeableKg, arrivedAt: a.arrivedAt! });
    const last = d.notifications.filter((n) => n.awbId === a.id).sort((x, y) => y.ts.localeCompare(x.ts))[0];
    return { a, days, band: agingBand(days), fee: s.fee, currency: s.currency, last };
  }), [d, st]);
  type Row = (typeof all)[number];
  const rows = all.filter((r) => !band || r.band === band);
  const selected = [...sel].filter((id) => rows.some((r) => r.a.id === id));
  const toggle = (id: string, on: boolean) => setSel((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const cols: Col<Row>[] = [
    { key: "sel", header: "", width: "36px", render: (r) => <><input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" aria-label={t(`ເລືອກ ${r.a.no}`, `Select ${r.a.no}`)} checked={sel.has(r.a.id)} disabled={!canOp} onChange={(e) => toggle(r.a.id, e.target.checked)} />{r.days > 90 && <span className="unclaimed" />}</> },
    { key: "no", header: t("ເລກ AWB", "AWB number"), render: (r) => <AwbLink awb={r.a} />, sort: (r) => r.a.no },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (r) => <Route from={r.a.origin} to={r.a.dest} /> },
    { key: "co", header: t("ຜູ້ຮັບ", "Consignee"), render: (r) => <span className="line-clamp-1">{customerName(d, r.a.consigneeId)}</span>, sort: (r) => customerName(d, r.a.consigneeId) },
    { key: "comm", header: t("ສິນຄ້າ", "Commodity"), render: (r) => <span className="inline-flex items-center gap-1.5"><span className="line-clamp-1">{comm(r.a)}</span><ShcTags codes={r.a.shc} /></span> },
    { key: "kg", header: t("ນໍ້າໜັກຄິດເງິນ", "Chargeable"), align: "right", render: (r) => kg(r.a.chargeableKg), sort: (r) => r.a.chargeableKg },
    { key: "arr", header: t("ມາຮອດ", "Arrived"), render: (r) => <span className="tnum whitespace-nowrap">{fmtDate(r.a.arrivedAt)}</span> },
    { key: "days", header: t("ວັນ", "Days"), align: "right", render: (r) => <span className={cx("font-semibold", r.days > 90 ? "text-bad" : r.days > 85 ? "text-warn" : "text-ink")}>{r.days}</span>, sort: (r) => r.days },
    { key: "band", header: t("ຊ່ວງ", "Band"), render: (r) => r.days > 90 ? <Badge tone="bad">{t("ບໍ່ມີຜູ້ມາຮັບ", "Unclaimed")}</Badge> : <span className="tnum whitespace-nowrap">{r.band}</span> },
    { key: "fee", header: t("ຄ່າຝາກສາງເຖິງມື້ນີ້", "Storage so far"), align: "right", render: (r) => <span className="whitespace-nowrap">{r.fee ? money(r.fee, r.currency) : t("ບໍ່ມີຄ່າ", "No fee")}</span>, sort: (r) => r.fee },
    { key: "last", header: t("ແຈ້ງຫຼ້າສຸດ", "Last notice"), render: (r) => r.last ? <span className="block whitespace-nowrap text-xs"><span className="tnum">{fmtDateTime(r.last.ts)}</span><span className="block text-ink-2">{r.last.channel === "whatsapp" ? "WhatsApp" : t("ໃຫ້ພະນັກງານໂທ", "Staff to call")}</span></span> : <span className="text-xs text-ink-3">{t("ຍັງບໍ່ແຈ້ງ", "None yet")}</span>, sort: (r) => r.last?.ts ?? "" },
    { key: "act", header: "", align: "right", render: (r) => <span className="inline-flex items-center gap-0.5 whitespace-nowrap"><Button size="sm" icon={Bell} disabled={!canOp} onClick={() => setAsk([r.a.id])}>{t("ເຕືອນ", "Remind")}</Button><Link to={`/import/delivery?awb=${r.a.id}`}><IconButton icon={PackageOpen} label={t("ເປີດໜ້າມອບສິນຄ້າ", "Open in delivery")} /></Link></span> },
  ];
  const askList = (ask ?? []).map((id) => d.awbs.find((a) => a.id === id)!).filter(Boolean);
  const askCalls = askList.filter((a) => !d.customers.find((c) => c.id === a.consigneeId)?.whatsapp).length;
  return <>
    <PageHeader title={t("ສິນຄ້າຄ້າງສາງ", "Aging cargo")} subtitle={t(`ສິນຄ້າຂາເຂົ້າທີ່ຍັງບໍ່ມີຜູ້ມາຮັບ ທີ່ສະຖານີ ${st}, ແບ່ງຕາມຈໍານວນວັນ`, `Import cargo not yet collected at ${st}, by days in store`)} actions={<Button icon={FileDown} onClick={() => exportExcel(t("ສິນຄ້າຄ້າງສາງ", "Aging cargo"), `Aging-${st}-${todayIso()}`, [{ header: "AWB", value: (r: Row) => r.a.no }, { header: "Origin", value: (r) => r.a.origin }, { header: "Consignee", value: (r) => customerName(d, r.a.consigneeId) }, { header: "Commodity", value: (r) => r.a.commodity }, { header: "Chargeable kg", value: (r) => r.a.chargeableKg }, { header: "Arrived", value: (r) => fmtDate(r.a.arrivedAt) }, { header: "Days", value: (r) => r.days }, { header: "Band", value: (r) => r.band }, { header: "Storage fee", value: (r) => r.fee }, { header: "Currency", value: (r) => r.currency }, { header: "Last notice", value: (r) => r.last ? fmtDateTime(r.last.ts) : "" }, { header: "Status", value: (r) => r.days > 90 ? "Unclaimed" : r.a.stage }], rows, `${st}${band ? ` ${band}` : ""}`)}>{t("Export Excel", "Export Excel")}</Button>} />
    <div className="mb-4 grid grid-cols-2 divide-line rounded-md border border-line bg-surface sm:grid-cols-5 sm:divide-x" role="group" aria-label={t("ກອງຕາມຊ່ວງວັນ", "Filter by aging band")}>
      {AGING_BANDS.map((b) => { const list = all.filter((r) => r.band === b); const on = band === b; const fees = list.reduce((s, r) => s + r.fee, 0); return <button key={b} aria-pressed={on} onClick={() => { setBand(on ? "" : b); setSel(new Set()); }} className={cx("px-4 py-3 text-left transition-colors", on ? "bg-brand-soft" : "hover:bg-surface-2")}>
        <span className="box-label block">{t(`${bandLabel(b)} ວັນ`, `${bandLabel(b)} days`)}{b === "90+" && ` · ${t("ບໍ່ມີຜູ້ມາຮັບ", "Unclaimed")}`}</span>
        <span className={cx("tnum mt-0.5 block text-2xl font-semibold leading-8", b === "90+" && list.length ? "text-bad" : b === "86-90" && list.length ? "text-warn" : "text-ink")}>{list.length}</span>
        <span className="tnum block text-xs text-ink-2">{money(fees)}</span>
      </button>; })}
    </div>
    {!canOp && <div className="mb-4"><Callout tone="warn" title={t("ເບິ່ງໄດ້ຢ່າງດຽວ", "View only")}>{t("ບົດບາດຂອງທ່ານບໍ່ມີສິດສົ່ງແຈ້ງເຕືອນ.", "Your role cannot send reminders.")}</Callout></div>}
    <Panel flush><div className="[&_tr:has(.unclaimed)]:bg-bad-soft"><DataTable rows={rows} columns={cols} rowKey={(r) => r.a.id} minWidth={1120} pageSize={15} defaultSort={{ key: "days", dir: "desc" }} search={(r) => `${r.a.prefix}${r.a.serial} ${customerName(d, r.a.consigneeId)} ${r.a.commodity} ${r.a.origin}`}
      toolbar={canOp && rows.length > 0 ? <><Button size="sm" icon={CheckSquare} onClick={() => setSel(selected.length === rows.length ? new Set() : new Set(rows.map((r) => r.a.id)))}>{selected.length === rows.length ? t("ຍົກເລີກການເລືອກ", "Clear selection") : t(`ເລືອກທັງໝົດ ${rows.length}`, `Select all ${rows.length}`)}</Button><Button size="sm" variant="primary" icon={Send} disabled={selected.length === 0} onClick={() => setAsk(selected)}>{t(`ເຕືອນທີ່ເລືອກ (${selected.length})`, `Remind selected (${selected.length})`)}</Button></> : undefined}
      empty={<Empty icon={History} title={band ? t(`ບໍ່ມີສິນຄ້າໃນຊ່ວງ ${bandLabel(band)} ວັນ`, `No cargo in the ${bandLabel(band)} day band`) : t("ບໍ່ມີສິນຄ້າຄ້າງສາງ", "No cargo waiting in store")}>{band ? t("ກົດຊ່ວງອື່ນດ້ານເທິງ ເພື່ອເບິ່ງລາຍການອື່ນ.", "Choose another band above to see other cargo.") : t("ສິນຄ້າຂາເຂົ້າທີ່ມາຮອດແລ້ວ ຈະປາກົດຢູ່ນີ້ ຈົນກວ່າຈະມອບໃຫ້ຜູ້ຮັບ.", "Arrived import cargo shows here until it is delivered.")}</Empty>} /></div></Panel>
    <Confirm open={!!ask} onClose={() => setAsk(null)} title={t(`ສົ່ງການເຕືອນ ${askList.length} ລາຍການ?`, `Send ${askList.length} reminder(s)?`)} body={<>{t(`WhatsApp ${askList.length - askCalls} ລາຍການ, ໃຫ້ພະນັກງານໂທ ${askCalls} ລາຍການ. ຂໍ້ຄວາມບອກຈໍານວນວັນ ແລະ ຄ່າຝາກສາງປະຈຸບັນ.`, `${askList.length - askCalls} by WhatsApp, ${askCalls} for staff to call. The message states the days in store and the storage fee to date.`)}</>} confirmLabel={t("ສົ່ງການເຕືອນ", "Send reminders")} onConfirm={() => { askList.forEach((a) => notifyAging(a.id)); setSel(new Set()); toast(t(`ສົ່ງ WhatsApp ${num(askList.length - askCalls)} ລາຍການ, ໃຫ້ພະນັກງານໂທ ${num(askCalls)} ລາຍການ`, `${num(askList.length - askCalls)} sent by WhatsApp, ${num(askCalls)} added for staff to call`)); }} />
  </>;
}
