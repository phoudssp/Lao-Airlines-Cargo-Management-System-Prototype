import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarPlus, Pencil } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { Badge, BarMeter, Button, Callout, Col, DataTable, Dl, Empty, PageHeader, Panel, Tabs, type Tone } from "@/ui/kit";
import { AwbLink, AwbStrip, flightLabel, Route, ShcTags } from "@/ui/cargo";
import type { Awb, Booking, BookingStatus, Invoice, InvoiceStatus, Lang, NotificationLog } from "@/lib/types";
import { fmtDate, fmtDateTime, kg, money, num, todayIso } from "@/lib/format";
import { customerHistory } from "@/lib/mock/booking";
import { creditUsed } from "@/lib/mock/finance";
import { CustomerDialog, CustomerTypeBadge } from "./Customers";

const part = (s: string, lang: Lang) => { const p = s.split(" / "); return lang === "lo" ? p[0] : p[p.length - 1]; };
const BK: Record<BookingStatus, [Tone, string, string]> = { requested: ["warn", "ລໍຖ້າອະນຸມັດ", "Requested"], confirmed: ["ok", "ຢືນຢັນແລ້ວ", "Confirmed"], waitlisted: ["info", "ລໍຖ້າພື້ນທີ່", "Waitlisted"], rejected: ["bad", "ປະຕິເສດ", "Rejected"], cancelled: ["neutral", "ຍົກເລີກ", "Cancelled"], converted: ["ok", "ອອກ AWB ແລ້ວ", "AWB issued"] };
const INV: Record<InvoiceStatus, [Tone, string, string]> = { draft: ["neutral", "ຮ່າງ", "Draft"], issued: ["warn", "ອອກແລ້ວ", "Issued"], partial: ["warn", "ຈ່າຍບາງສ່ວນ", "Part paid"], paid: ["ok", "ຈ່າຍແລ້ວ", "Paid"], cancelled: ["neutral", "ຍົກເລີກ", "Cancelled"] };

export default function CustomerDetail() {
  const { id } = useParams(); const d = useDb(); const t = useT(); const lang = useLang(); const can = useCan(); const nav = useNavigate();
  const [tab, setTab] = useState<"awbs" | "bookings" | "invoices" | "notices">("awbs"); const [edit, setEdit] = useState(false);
  const c = d.customers.find((x) => x.id === id);
  if (!c) return <Empty title={t("ບໍ່ພົບລູກຄ້ານີ້", "Customer not found")} action={<Link to="/crm"><Button>{t("ກັບໄປລາຍການ", "Back to the list")}</Button></Link>} />;
  const h = customerHistory(d, c.id); const used = creditUsed(d, c.id); const avail = c.creditLimit - used;
  const overdue = h.invoices.filter((i) => ["issued", "partial"].includes(i.status) && i.dueDate < todayIso());
  const ranges = d.awbStock.filter((s) => s.assigneeType === "agent" && s.assignee === c.id);
  const stationName = d.stations.find((s) => s.code === c.station);
  const roleOf = (a: Awb) => a.agentId === c.id ? t("ຕົວແທນ", "Agent") : a.shipperId === c.id ? t("ຜູ້ສົ່ງ", "Shipper") : t("ຜູ້ຮັບ", "Consignee");
  const awbCols: Col<Awb>[] = [
    { key: "no", header: t("ເລກ AWB", "AWB number"), render: (a) => <AwbLink awb={a} />, sort: (a) => a.issuedAt },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (a) => <Route from={a.origin} to={a.dest} /> },
    { key: "role", header: t("ບົດບາດ", "Role"), render: roleOf },
    { key: "comm", header: t("ສິນຄ້າ", "Commodity"), render: (a) => <span className="inline-flex items-center gap-1.5"><span className="line-clamp-1">{part(a.commodity, lang)}</span><ShcTags codes={a.shc} /></span> },
    { key: "pcs", header: t("ກ່ອງ", "Pcs"), align: "right", render: (a) => a.pieces },
    { key: "kg", header: t("ນໍ້າໜັກຄິດເງິນ", "Chargeable"), align: "right", render: (a) => kg(a.chargeableKg), sort: (a) => a.chargeableKg },
    { key: "total", header: t("ຄ່າຂົນສົ່ງ", "Charges"), align: "right", render: (a) => <span className="whitespace-nowrap">{money(a.total, a.currency)}</span> },
    { key: "date", header: t("ວັນທີອອກ", "Issued"), render: (a) => <span className="tnum whitespace-nowrap">{fmtDate(a.issuedAt)}</span>, sort: (a) => a.issuedAt },
    { key: "stage", header: t("ສະຖານະ", "Status"), render: (a) => <AwbStrip awb={a} /> },
  ];
  const bkCols: Col<Booking>[] = [
    { key: "no", header: t("ເລກການຈອງ", "Booking"), mono: true, render: (b) => <span className="font-semibold">{b.no}</span>, sort: (b) => b.createdAt },
    { key: "flight", header: t("ຖ້ຽວບິນ", "Flight"), mono: true, render: (b) => flightLabel(d, b.flightId) },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (b) => <Route from={b.origin} to={b.dest} /> },
    { key: "comm", header: t("ສິນຄ້າ", "Commodity"), render: (b) => <span className="inline-flex items-center gap-1.5"><span className="line-clamp-1">{part(b.commodity, lang)}</span><ShcTags codes={b.shc} /></span> },
    { key: "pcs", header: t("ກ່ອງ", "Pcs"), align: "right", render: (b) => b.pieces },
    { key: "kg", header: "kg", align: "right", render: (b) => num(b.weightKg) },
    { key: "st", header: t("ສະຖານະ", "Status"), render: (b) => <Badge tone={BK[b.status][0]}>{t(BK[b.status][1], BK[b.status][2])}</Badge> },
    { key: "reason", header: t("ເຫດຜົນ", "Reason"), render: (b) => <span className="text-xs text-ink-2">{b.reason ? part(b.reason, lang) : ""}</span> },
  ];
  const invCols: Col<Invoice>[] = [
    { key: "no", header: t("ເລກໃບເກັບເງິນ", "Invoice"), mono: true, render: (i) => <Link to="/finance/invoices" className="font-semibold text-brand hover:underline">{i.no}</Link>, sort: (i) => i.issueDate },
    { key: "issue", header: t("ວັນທີອອກ", "Issued"), render: (i) => <span className="tnum">{fmtDate(i.issueDate)}</span> },
    { key: "due", header: t("ຄົບກໍານົດ", "Due"), render: (i) => <span className={overdue.includes(i) ? "tnum font-semibold text-bad" : "tnum"}>{fmtDate(i.dueDate)}</span>, sort: (i) => i.dueDate },
    { key: "awbs", header: "AWB", align: "right", render: (i) => i.awbIds.length },
    { key: "amount", header: t("ຈໍານວນເງິນ", "Amount"), align: "right", render: (i) => <span className="whitespace-nowrap">{money(i.amount, i.currency)}</span>, sort: (i) => i.amount },
    { key: "paid", header: t("ຈ່າຍແລ້ວ", "Paid"), align: "right", render: (i) => <span className="whitespace-nowrap">{money(i.paidAmount, i.currency)}</span> },
    { key: "st", header: t("ສະຖານະ", "Status"), render: (i) => <Badge tone={INV[i.status][0]}>{t(INV[i.status][1], INV[i.status][2])}</Badge> },
  ];
  const ntCols: Col<NotificationLog>[] = [
    { key: "ts", header: t("ເວລາ", "Time"), render: (n) => <span className="tnum whitespace-nowrap">{fmtDateTime(n.ts)}</span>, sort: (n) => n.ts },
    { key: "ch", header: t("ຊ່ອງທາງ", "Channel"), render: (n) => <Badge tone={n.channel === "whatsapp" ? "ok" : "warn"} noIcon>{n.channel === "whatsapp" ? "WhatsApp" : t("ໃຫ້ພະນັກງານໂທ", "Staff to call")}</Badge> },
    { key: "awb", header: "AWB", render: (n) => { const a = d.awbs.find((x) => x.id === n.awbId); return a ? <AwbLink awb={a} /> : ""; } },
    { key: "body", header: t("ຂໍ້ຄວາມ", "Message"), render: (n) => <span className="text-xs text-ink-2">{n.body}</span> },
    { key: "st", header: t("ສະຖານະ", "Status"), render: (n) => n.status === "done" ? <Badge tone="ok">{t("ໂທແລ້ວ", "Called")}</Badge> : n.status === "staff_note" ? <Badge tone="warn">{t("ຍັງບໍ່ໄດ້ໂທ", "To call")}</Badge> : <Badge tone={n.status === "failed" ? "bad" : "ok"}>{n.status === "failed" ? t("ສົ່ງບໍ່ສໍາເລັດ", "Failed") : n.status === "read" ? t("ອ່ານແລ້ວ", "Read") : n.status === "delivered" ? t("ຮອດແລ້ວ", "Delivered") : t("ສົ່ງແລ້ວ", "Sent")}</Badge> },
  ];
  return <>
    <PageHeader crumbs={[{ label: t("ລູກຄ້າ ແລະ ຕົວແທນ", "Customers & agents"), to: "/crm" }, { label: c.code }]} title={t(c.name, c.nameEn)} subtitle={`${c.code} · ${t(c.nameEn, c.name)}`} actions={<>
      {can("booking.manage") && c.active && <Button icon={CalendarPlus} onClick={() => nav(`/bookings?new=1&customer=${c.id}`)}>{t("ຈອງພື້ນທີ່ໃໝ່", "New booking")}</Button>}
      {can("crm.manage") && <Button icon={Pencil} onClick={() => setEdit(true)}>{t("ແກ້ໄຂ", "Edit")}</Button>}
    </>} />
    {!c.active && <div className="mb-4"><Callout tone="warn" title={t("ລູກຄ້ານີ້ຖືກປິດໃຊ້ງານ", "This customer is inactive")}>{t("ເປີດໃຊ້ງານຄືນກ່ອນຮັບການຈອງໃໝ່.", "Reactivate them before taking a new booking.")}</Callout></div>}
    <div className="mb-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Panel title={t("ຂໍ້ມູນຕິດຕໍ່", "Contact and address")}><Dl cols={3} items={[
        { label: t("ປະເພດ", "Type"), value: <CustomerTypeBadge type={c.type} /> },
        { label: t("ຜູ້ຕິດຕໍ່", "Contact person"), value: c.contact },
        { label: t("ເບີໂທ", "Phone"), value: <span className="tnum">{c.phone}</span> },
        { label: "WhatsApp", value: c.whatsapp ? <span className="tnum">{c.whatsapp}</span> : <Badge tone="warn">{t("ບໍ່ມີ: ພະນັກງານຕ້ອງໂທແຈ້ງ", "None: staff must call")}</Badge> },
        { label: t("ອີເມວ", "Email"), value: c.email },
        { label: t("ສະຖານີຫຼັກ", "Home station"), value: <span><span className="font-mono text-[13px] font-semibold">{c.station}</span> {stationName && t(stationName.nameLo, stationName.nameEn)}</span> },
        { label: t("ທີ່ຢູ່", "Address"), value: c.address },
        { label: t("ຊື່ຜູ້ໃຊ້ Portal", "Portal user"), value: c.portalUser ? <span className="font-mono text-[13px]">{c.portalUser}</span> : t("ບໍ່ໄດ້ໃຊ້", "Not on the portal") },
        { label: t("ວັນທີສ້າງ", "Customer since"), value: <span className="tnum">{fmtDate(c.createdAt)}</span> },
        ...(c.note ? [{ label: t("ໝາຍເຫດ", "Note"), value: c.note }] : []),
      ]} /></Panel>
      <Panel title={t("ວົງເງິນສິນເຊື່ອ", "Credit account")}>
        {c.creditLimit > 0 ? <>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm"><span className="text-ink-2">{t("ໃຊ້ໄປ", "Used")}</span><span className="tnum"><b className="text-lg">{money(used)}</b> / {money(c.creditLimit)}</span></div>
          <BarMeter value={used} max={c.creditLimit} label={t("ວົງເງິນທີ່ໃຊ້", "Credit used")} />
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="box-label">{t("ຍັງເຫຼືອ", "Available")}</dt><dd className={avail < 0 ? "tnum font-semibold text-bad" : "tnum font-semibold"}>{money(avail)}</dd></div><div><dt className="box-label">{t("ໄລຍະສິນເຊື່ອ", "Credit days")}</dt><dd className="tnum">{t(`${c.creditDays} ວັນ`, `${c.creditDays} days`)}</dd></div></dl>
          {avail < 0 && <div className="mt-3"><Callout tone="bad" title={t("ເກີນວົງເງິນ", "Over the credit limit")}>{t("ເກັບເງິນໃບເກັບເງິນທີ່ຄ້າງກ່ອນອອກ AWB ແບບຕິດໜີ້ໃໝ່.", "Collect open invoices before issuing more AWBs on credit.")}</Callout></div>}
          {overdue.length > 0 && <div className="mt-3"><Callout tone="warn" title={t(`ໃບເກັບເງິນເກີນກໍານົດ ${overdue.length} ໃບ`, `${overdue.length} overdue invoice(s)`)} action={<Link to="/finance/invoices" className="text-sm font-medium text-brand hover:underline">{t("ເບິ່ງ", "View")}</Link>} /></div>}
        </> : <p className="text-sm text-ink-2">{t("ລູກຄ້ານີ້ຈ່າຍສົດ. ກໍານົດວົງເງິນໄດ້ໃນປຸ່ມແກ້ໄຂ.", "This customer pays cash. Set a credit limit with Edit.")}</p>}
      </Panel>
    </div>
    {c.type === "agent" && <Panel className="mb-4" title={t("ຊ່ວງເລກ AWB ຂອງຕົວແທນ", "AWB ranges held by this agent")} actions={<Link to="/master/awb-stock" className="text-sm font-medium text-brand hover:underline">{t("ຈັດການຊ່ວງເລກ", "Manage ranges")}</Link>} flush>
      {ranges.length === 0 ? <p className="p-4 text-sm text-ink-2">{t("ຍັງບໍ່ມີຊ່ວງເລກ. ຈັດສັນໄດ້ຢູ່ໜ້າຊ່ວງເລກ AWB.", "No range allocated yet. Allocate one on the AWB ranges page.")}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-ink-2"><th className="px-3 py-2 font-semibold">{t("ຊ່ວງເລກ", "Range")}</th><th className="px-3 py-2 text-right font-semibold">{t("ໃຊ້ແລ້ວ", "Used")}</th><th className="px-3 py-2 text-right font-semibold">{t("ຍົກເລີກ", "Voided")}</th><th className="px-3 py-2 text-right font-semibold">{t("ຍັງເຫຼືອ", "Remaining")}</th><th className="px-3 py-2 font-semibold">{t("ເລກຖັດໄປ", "Next number")}</th></tr></thead><tbody>{ranges.map((s) => <tr key={s.id} className="border-b border-line last:border-0"><td className="px-3 py-2 font-mono text-[13px]">{s.prefix} {s.from}–{s.to}</td><td className="tnum px-3 py-2 text-right">{num(s.nextSerial - s.from)}</td><td className="tnum px-3 py-2 text-right">{s.voided}</td><td className="tnum px-3 py-2 text-right">{num(s.to - s.nextSerial + 1)}</td><td className="px-3 py-2 font-mono text-[13px]">{s.nextSerial}</td></tr>)}</tbody></table></div>}
    </Panel>}
    <Tabs value={tab} onChange={setTab} tabs={[{ key: "awbs", label: "AWB", count: h.awbs.length }, { key: "bookings", label: t("ການຈອງ", "Bookings"), count: h.bookings.length }, { key: "invoices", label: t("ໃບເກັບເງິນ", "Invoices"), count: h.invoices.length }, { key: "notices", label: t("ແຈ້ງເຕືອນ", "Notices"), count: h.notifications.length }]} />
    <Panel flush>
      {tab === "awbs" && <DataTable rows={h.awbs} columns={awbCols} rowKey={(a) => a.id} minWidth={1000} pageSize={10} defaultSort={{ key: "no", dir: "desc" }} onRowClick={(a) => nav(`/export/awb/${a.id}`)} search={(a) => `${a.prefix}${a.serial} ${a.commodity} ${a.dest} ${a.origin}`} empty={<Empty title={t("ຍັງບໍ່ມີ AWB", "No AWBs yet")}>{t("AWB ທີ່ລູກຄ້ານີ້ເປັນຜູ້ສົ່ງ, ຜູ້ຮັບ ຫຼື ຕົວແທນ ຈະສະແດງຢູ່ນີ້.", "AWBs where this customer is shipper, consignee or agent appear here.")}</Empty>} />}
      {tab === "bookings" && <DataTable rows={h.bookings} columns={bkCols} rowKey={(b) => b.id} minWidth={860} pageSize={10} defaultSort={{ key: "no", dir: "desc" }} onRowClick={() => nav("/bookings")} empty={<Empty title={t("ຍັງບໍ່ມີການຈອງ", "No bookings yet")}>{t("ໃຊ້ປຸ່ມຈອງພື້ນທີ່ໃໝ່ເພື່ອສ້າງການຈອງໃຫ້ລູກຄ້ານີ້.", "Use New booking to reserve space for this customer.")}</Empty>} />}
      {tab === "invoices" && <DataTable rows={h.invoices} columns={invCols} rowKey={(i) => i.id} minWidth={760} pageSize={10} defaultSort={{ key: "no", dir: "desc" }} empty={<Empty title={t("ຍັງບໍ່ມີໃບເກັບເງິນ", "No invoices yet")}>{t("ໃບເກັບເງິນສໍາລັບລູກຄ້າຕິດໜີ້ຈະສະແດງຢູ່ນີ້.", "Invoices for credit customers appear here.")}</Empty>} />}
      {tab === "notices" && <DataTable rows={h.notifications} columns={ntCols} rowKey={(n) => n.id} minWidth={860} pageSize={10} defaultSort={{ key: "ts", dir: "desc" }} empty={<Empty title={t("ຍັງບໍ່ໄດ້ສົ່ງແຈ້ງເຕືອນ", "No notices sent yet")}>{t("ແຈ້ງເຕືອນສິນຄ້າມາຮອດ, ຄ້າງສາງ ແລະ ອ໋ອບໂຫຼດ ຈະບັນທຶກຢູ່ນີ້.", "Arrival, aging and offload notices are recorded here.")}</Empty>} />}
    </Panel>
    {edit && <CustomerDialog customer={c} onClose={() => setEdit(false)} />}
  </>;
}
