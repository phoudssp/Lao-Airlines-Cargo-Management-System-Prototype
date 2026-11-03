import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, CheckCircle2, Coins, FilePlus2, Printer, Send, Trash2 } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { BarMeter, Badge, Button, Callout, Col, Confirm, DataTable, Dialog, Dl, Empty, Field, Input, PageHeader, Panel, PrintSheet, Select, StatRow, Tabs, toast, type Tone } from "@/ui/kit";
import { AwbLink, customerName, Route } from "@/ui/cargo";
import { cancelInvoice, createInvoice, creditUsed, deleteInvoice, issueInvoice, payInvoice, uninvoiced } from "@/lib/mock/finance";
import { rateToLak } from "@/lib/pricing";
import { daysBetween, fmtDate, money, num, todayIso } from "@/lib/format";
import type { Awb, Customer, Db, Invoice, InvoiceStatus } from "@/lib/types";
import { PaperHead, SignLine } from "./shared";

const balanceOf = (i: Invoice) => Math.max(0, i.amount - i.paidAmount);
const isOpen = (i: Invoice) => i.status === "issued" || i.status === "partial";
const overdueDays = (i: Invoice) => (isOpen(i) ? Math.max(0, daysBetween(i.dueDate, todayIso())) : 0);
const AGE_BANDS: { key: string; lo: string; en: string; test: (days: number) => boolean }[] = [
  { key: "current", lo: "ຍັງບໍ່ຮອດກໍານົດ", en: "Not yet due", test: (x) => x === 0 }, { key: "d30", lo: "1-30 ວັນ", en: "1-30 days", test: (x) => x >= 1 && x <= 30 },
  { key: "d60", lo: "31-60 ວັນ", en: "31-60 days", test: (x) => x > 30 && x <= 60 }, { key: "d90", lo: "61-90 ວັນ", en: "61-90 days", test: (x) => x > 60 && x <= 90 }, { key: "over", lo: "ເກີນ 90 ວັນ", en: "Over 90 days", test: (x) => x > 90 },
];
const balanceLak = (d: Db, i: Invoice) => balanceOf(i) * rateToLak(d, i.currency);
const billTo = (a: Awb) => a.agentId ?? a.shipperId;

function InvoiceBadge({ i }: { i: Invoice }) {
  const t = useT(); const late = overdueDays(i);
  if (late > 0) return <Badge tone="bad">{t(`ເກີນກໍານົດ ${late} ວັນ`, `Overdue ${late} days`)}</Badge>;
  const m: Record<InvoiceStatus, [Tone, string, string]> = { draft: ["neutral", "ຮ່າງ", "Draft"], issued: ["info", "ອອກແລ້ວ", "Issued"], partial: ["warn", "ຈ່າຍບາງສ່ວນ", "Part paid"], paid: ["ok", "ຈ່າຍຄົບ", "Paid"], cancelled: ["neutral", "ຍົກເລີກ", "Cancelled"] };
  const [tone, lo, en] = m[i.status]; return <Badge tone={tone}>{t(lo, en)}</Badge>;
}

function InvoicePaper({ i }: { i: Invoice }) {
  const d = useDb(); const c = d.customers.find((x) => x.id === i.customerId);
  return <div className="text-[13px] leading-5 text-black">
    <PaperHead station={i.station} title="ໃບເກັບເງິນ / Invoice" no={i.no}>{i.status === "draft" && <div className="mt-1 inline-block border-2 border-black px-2 text-xs font-bold">ຮ່າງ / DRAFT</div>}{i.status === "cancelled" && <div className="mt-1 inline-block border-2 border-black px-2 text-xs font-bold">ຍົກເລີກ / CANCELLED</div>}</PaperHead>
    <div className="mt-3 grid grid-cols-2 gap-6">
      <div><div className="text-xs">ເກັບເງິນຈາກ / Bill to</div><div className="font-semibold">{c?.name}</div>{c?.nameEn !== c?.name && <div>{c?.nameEn}</div>}<div>{c?.address}</div><div>{c?.contact} · {c?.phone}</div></div>
      <div className="text-right"><div>ວັນທີອອກ / Issue date: <b className="tnum">{fmtDate(i.issueDate)}</b></div><div>ກໍານົດຊໍາລະ / Due date: <b className="tnum">{fmtDate(i.dueDate)}</b></div><div>ເງື່ອນໄຂ / Terms: <b className="tnum">{c?.creditDays ?? 0}</b> ວັນ / days</div></div>
    </div>
    <table className="mt-3 w-full border-collapse"><thead><tr className="border-y border-black text-left"><th className="py-1 pr-2 font-semibold">AWB</th><th className="py-1 pr-2 font-semibold">ລາຍການ / Description</th><th className="py-1 text-right font-semibold">ຈໍານວນ / Amount</th></tr></thead><tbody>{i.lines.map((l, n) => <tr key={n} className="border-b border-black/20"><td className="py-1 pr-2 font-mono text-xs whitespace-nowrap">{l.ref}</td><td className="py-1 pr-2">{l.description}</td><td className="py-1 text-right tnum whitespace-nowrap">{money(l.amount, l.currency)}</td></tr>)}</tbody></table>
    <table className="ml-auto mt-2 text-right"><tbody>
      <tr><td className="pr-4">ລວມ / Total</td><td className="tnum text-base font-bold">{money(i.amount, i.currency)}</td></tr>
      <tr><td className="pr-4">ຊໍາລະແລ້ວ / Paid</td><td className="tnum">{money(i.paidAmount, i.currency)}</td></tr>
      <tr><td className="pr-4">ຄ້າງຊໍາລະ / Balance due</td><td className="tnum font-semibold">{money(balanceOf(i), i.currency)}</td></tr>
    </tbody></table>
    <div className="grid grid-cols-2 gap-10"><SignLine label="ຜູ້ອອກໃບເກັບເງິນ / Issued by" /><SignLine label="ຜູ້ຮັບໃບເກັບເງິນ / Received by" /></div>
  </div>;
}

export default function Invoices() {
  const d = useDb(); const t = useT(); const can = useCan(); const st = d.session.station; const manage = can("invoice.manage");
  const [tab, setTab] = useState<"invoices" | "uninvoiced" | "balances">("invoices"); const [status, setStatus] = useState(""); const [station, setStation] = useState(st); const [custFilter, setCustFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null); const [print, setPrint] = useState(false); const [ask, setAsk] = useState<"cancel" | "delete" | null>(null);
  const [payOpen, setPayOpen] = useState(false); const [payAmt, setPayAmt] = useState(""); const [tried, setTried] = useState(false);
  const [creating, setCreating] = useState(false); const [custId, setCustId] = useState(""); const [picked, setPicked] = useState<Set<string>>(new Set()); const [currency, setCurrency] = useState("LAK");

  const allUninvoiced = useMemo(() => d.awbs.filter((a) => a.status === "active" && a.payMode === "credit" && !a.invoiceId), [d.awbs]);
  const rows = useMemo(() => d.invoices.filter((i) => (!station || i.station === station) && (!custFilter || i.customerId === custFilter) && (!status || (status === "overdue" ? overdueDays(i) > 0 : i.status === status))), [d.invoices, station, custFilter, status]);
  const stationInv = d.invoices.filter((i) => !station || i.station === station);
  const receivable = stationInv.filter(isOpen).reduce((s, i) => s + balanceLak(d, i), 0); const overdue = stationInv.filter((i) => overdueDays(i) > 0);
  const creditCustomers = d.customers.filter((c) => c.creditLimit > 0 && c.active);
  const customerOptions = d.customers.filter((c) => uninvoiced(d, c.id).length > 0).map((c) => ({ value: c.id, label: customerName(d, c.id) }));
  const inv = openId ? d.invoices.find((x) => x.id === openId) : undefined; const invBal = inv ? balanceOf(inv) : 0;
  const payErr = inv && (Number(payAmt) <= 0 ? t("ປ້ອນຈໍານວນທີ່ໄດ້ຮັບ", "Enter the amount received") : Number(payAmt) > invBal + 0.005 ? t(`ຄ້າງຊໍາລະພຽງ ${money(invBal, inv.currency)}`, `Only ${money(invBal, inv.currency)} is due`) : undefined);

  const startCreate = (customerId = "") => { setCustId(customerId); setPicked(new Set(customerId ? uninvoiced(d, customerId).map((a) => a.id) : [])); setCurrency("LAK"); setTried(false); setCreating(true); };
  const custAwbs = custId ? uninvoiced(d, custId) : []; const pickedAwbs = custAwbs.filter((a) => picked.has(a.id));
  const pickedLak = pickedAwbs.reduce((s, a) => s + a.total * rateToLak(d, a.currency), 0); const rate = rateToLak(d, currency); const preview = rate ? pickedLak / rate : 0;
  const custNow = d.customers.find((c) => c.id === custId);

  const invCols: Col<Invoice>[] = [
    { key: "no", header: t("ເລກໃບເກັບເງິນ", "Invoice no."), mono: true, render: (i) => <span className="font-semibold text-brand">{i.no}</span>, sort: (i) => i.no },
    { key: "customer", header: t("ລູກຄ້າ", "Customer"), render: (i) => <span className="line-clamp-1">{customerName(d, i.customerId)}</span>, sort: (i) => customerName(d, i.customerId) },
    { key: "station", header: t("ສະຖານີ", "Station"), mono: true, render: (i) => i.station },
    { key: "issue", header: t("ວັນທີອອກ", "Issued"), render: (i) => <span className="tnum whitespace-nowrap">{fmtDate(i.issueDate)}</span>, sort: (i) => i.issueDate },
    { key: "due", header: t("ກໍານົດຊໍາລະ", "Due"), render: (i) => <span className="tnum whitespace-nowrap">{fmtDate(i.dueDate)}</span>, sort: (i) => i.dueDate },
    { key: "amount", header: t("ຈໍານວນ", "Amount"), align: "right", render: (i) => <span className="whitespace-nowrap">{money(i.amount, i.currency)}</span>, sort: (i) => i.amount * rateToLak(d, i.currency) },
    { key: "balance", header: t("ຄ້າງຊໍາລະ", "Balance"), align: "right", render: (i) => <span className="whitespace-nowrap">{i.status === "cancelled" ? "—" : money(balanceOf(i), i.currency)}</span>, sort: (i) => balanceLak(d, i) },
    { key: "status", header: t("ສະຖານະ", "Status"), render: (i) => <InvoiceBadge i={i} />, sort: (i) => overdueDays(i) },
  ];
  const awbCols: Col<Awb>[] = [
    { key: "no", header: "AWB", render: (a) => <AwbLink awb={a} />, sort: (a) => a.no },
    { key: "customer", header: t("ລູກຄ້າຕິດໜີ້", "Credit customer"), render: (a) => <span className="line-clamp-1">{customerName(d, billTo(a))}</span>, sort: (a) => customerName(d, billTo(a)) },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (a) => <Route from={a.origin} to={a.dest} /> },
    { key: "issued", header: t("ວັນທີອອກ AWB", "AWB date"), render: (a) => <span className="tnum whitespace-nowrap">{fmtDate(a.issuedAt)}</span>, sort: (a) => a.issuedAt },
    { key: "kg", header: t("ນໍ້າໜັກຄິດເງິນ", "Chargeable"), align: "right", render: (a) => `${num(a.chargeableKg, a.chargeableKg % 1 ? 1 : 0)} kg`, sort: (a) => a.chargeableKg },
    { key: "total", header: t("ຈໍານວນ", "Amount"), align: "right", render: (a) => <span className="whitespace-nowrap">{money(a.total, a.currency)}</span>, sort: (a) => a.total * rateToLak(d, a.currency) },
    { key: "act", header: "", align: "right", render: (a) => manage ? <Button size="sm" onClick={(e) => { e.stopPropagation(); startCreate(billTo(a)); }}>{t("ອອກໃບເກັບເງິນ", "Invoice this customer")}</Button> : null },
  ];
  const balanceRow = (c: Customer) => { const open = d.invoices.filter((i) => i.customerId === c.id && isOpen(i)); const bands = AGE_BANDS.map((b) => open.filter((i) => b.test(overdueDays(i))).reduce((s, i) => s + balanceLak(d, i), 0)); return { c, used: creditUsed(d, c.id), bands, overdue: bands.slice(1).reduce((a, b) => a + b, 0) }; };
  const balances = creditCustomers.map(balanceRow);
  type BalRow = (typeof balances)[number];
  const balCols: Col<BalRow>[] = [
    { key: "customer", header: t("ລູກຄ້າ", "Customer"), render: (r) => <Link to={`/crm/${r.c.id}`} onClick={(e) => e.stopPropagation()} className="line-clamp-1 text-brand hover:underline">{r.c.name}</Link>, sort: (r) => r.c.name },
    { key: "limit", header: t("ວົງເງິນ / ໃຊ້ແລ້ວ", "Limit / used"), width: "210px", render: (r) => { const pct = r.c.creditLimit ? (r.used / r.c.creditLimit) * 100 : 0; return <div className="min-w-[180px]"><BarMeter value={r.used} max={r.c.creditLimit} label={t(`ໃຊ້ວົງເງິນ ${Math.round(pct)}%`, `${Math.round(pct)}% of limit used`)} /><div className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-2 tnum"><span>{money(r.used)}</span><span>/ {money(r.c.creditLimit)}</span></div>{pct > 100 && <Badge tone="bad">{t("ເກີນວົງເງິນ", "Over limit")}</Badge>}{pct >= 80 && pct <= 100 && <Badge tone="warn">{t(`ໃຊ້ ${Math.round(pct)}%`, `${Math.round(pct)}% used`)}</Badge>}</div>; }, sort: (r) => r.used / (r.c.creditLimit || 1) },
    ...AGE_BANDS.map((b, n): Col<BalRow> => ({ key: b.key, header: t(b.lo, b.en), align: "right", sort: (r) => r.bands[n], render: (r) => r.bands[n] ? <span className={n > 0 ? "font-semibold text-bad whitespace-nowrap" : "whitespace-nowrap"}>{num(Math.round(r.bands[n]))}</span> : <span className="text-ink-3">—</span> })),
    { key: "act", header: "", align: "right", render: (r) => manage && uninvoiced(d, r.c.id).length > 0 ? <Button size="sm" onClick={() => startCreate(r.c.id)}>{t(`ອອກໃບເກັບເງິນ (${uninvoiced(d, r.c.id).length})`, `Invoice (${uninvoiced(d, r.c.id).length})`)}</Button> : null },
  ];
  return <>
    <PageHeader title={t("ໃບເກັບເງິນ ລູກຄ້າຕິດໜີ້", "Credit invoices")} subtitle={t("AWB ແບບຕິດໜີ້ ບໍ່ຮັບເງິນທີ່ແຄັດເຊຍ: ລວມໃສ່ໃບເກັບເງິນ, ອອກໃຫ້ລູກຄ້າ ແລະ ບັນທຶກການຊໍາລະ", "Credit AWBs are not paid at the cashier: bill them on an invoice, issue it and record payments")} actions={manage && <Button variant="primary" icon={FilePlus2} onClick={() => startCreate()}>{t("ສ້າງໃບເກັບເງິນ", "Create invoice")}</Button>} />
    {!manage && <div className="mb-3"><Callout tone="info">{t("ບົດບາດຂອງທ່ານເບິ່ງໄດ້ຢ່າງດຽວ. ການສ້າງ ແລະ ອອກໃບເກັບເງິນຕ້ອງມີສິດ invoice.manage.", "Your role can only view. Creating and issuing invoices needs invoice.manage.")}</Callout></div>}
    <StatRow items={[
      { label: t("ຍອດຄ້າງຮັບ", "Receivable"), value: money(receivable), sub: t(`${stationInv.filter(isOpen).length} ໃບເກັບເງິນ`, `${stationInv.filter(isOpen).length} open invoice(s)`) },
      { label: t("ເກີນກໍານົດ", "Overdue"), value: money(overdue.reduce((s, i) => s + balanceLak(d, i), 0)), sub: t(`${overdue.length} ໃບເກັບເງິນ`, `${overdue.length} invoice(s)`), tone: overdue.length ? "bad" : undefined },
      { label: t("AWB ຍັງບໍ່ອອກໃບເກັບເງິນ", "AWBs not yet invoiced"), value: allUninvoiced.length, sub: money(allUninvoiced.reduce((s, a) => s + a.total * rateToLak(d, a.currency), 0)) },
      { label: t("ໃບຮ່າງ", "Drafts"), value: stationInv.filter((i) => i.status === "draft").length, sub: t("ລໍຖ້າອອກໃຫ້ລູກຄ້າ", "Waiting to be issued") },
    ]} />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: "invoices", label: t("ໃບເກັບເງິນ", "Invoices"), count: rows.length }, { key: "uninvoiced", label: t("AWB ຍັງບໍ່ອອກໃບເກັບເງິນ", "Uninvoiced AWBs"), count: allUninvoiced.length }, { key: "balances", label: t("ຍອດລູກຄ້າ", "Customer balances"), count: balances.length }]} />
    {tab === "invoices" && <Panel flush><DataTable rows={rows} columns={invCols} rowKey={(i) => i.id} minWidth={940} defaultSort={{ key: "issue", dir: "desc" }} onRowClick={(i) => setOpenId(i.id)} search={(i) => `${i.no} ${customerName(d, i.customerId)} ${i.lines.map((l) => l.ref).join(" ")}`}
      filters={<>
        <Select aria-label={t("ສະຖານີ", "Station")} className="w-auto" value={station} onChange={(e) => setStation(e.target.value)} placeholder={t("ທຸກສະຖານີ", "All stations")} options={d.stations.map((s) => ({ value: s.code, label: s.code }))} />
        <Select aria-label={t("ສະຖານະ", "Status")} className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t("ທຸກສະຖານະ", "All statuses")} options={[{ value: "overdue", label: t("ເກີນກໍານົດ", "Overdue") }, { value: "draft", label: t("ຮ່າງ", "Draft") }, { value: "issued", label: t("ອອກແລ້ວ", "Issued") }, { value: "partial", label: t("ຈ່າຍບາງສ່ວນ", "Part paid") }, { value: "paid", label: t("ຈ່າຍຄົບ", "Paid") }, { value: "cancelled", label: t("ຍົກເລີກ", "Cancelled") }]} />
        <Select aria-label={t("ລູກຄ້າ", "Customer")} className="w-auto max-w-[220px]" value={custFilter} onChange={(e) => setCustFilter(e.target.value)} placeholder={t("ທຸກລູກຄ້າ", "All customers")} options={creditCustomers.map((c) => ({ value: c.id, label: customerName(d, c.id) }))} />
      </>}
      empty={<Empty title={t("ບໍ່ພົບໃບເກັບເງິນ", "No invoices match")} action={manage ? <Button onClick={() => startCreate()}>{t("ສ້າງໃບເກັບເງິນ", "Create invoice")}</Button> : undefined}>{t("ປ່ຽນຕົວກອງ ຫຼື ສ້າງໃບເກັບເງິນຈາກ AWB ຕິດໜີ້.", "Change the filters or bill credit AWBs on a new invoice.")}</Empty>} /></Panel>}
    {tab === "uninvoiced" && <Panel flush><DataTable rows={allUninvoiced} columns={awbCols} rowKey={(a) => a.id} minWidth={860} defaultSort={{ key: "issued", dir: "asc" }} search={(a) => `${a.prefix}${a.serial} ${customerName(d, billTo(a))} ${a.dest}`} empty={<Empty icon={CheckCircle2} title={t("AWB ຕິດໜີ້ອອກໃບເກັບເງິນຄົບແລ້ວ", "Every credit AWB is invoiced")}>{t("AWB ໃໝ່ແບບຕິດໜີ້ຈະສະແດງຢູ່ນີ້.", "New credit AWBs appear here.")}</Empty>} /></Panel>}
    {tab === "balances" && <Panel flush><DataTable rows={balances} columns={balCols} rowKey={(r) => r.c.id} minWidth={1000} defaultSort={{ key: "limit", dir: "desc" }} search={(r) => `${r.c.name} ${r.c.nameEn} ${r.c.code}`} /></Panel>}

    {inv && <Dialog open={!print} size="lg" onClose={() => setOpenId(null)} title={t(`ໃບເກັບເງິນ ${inv.no}`, `Invoice ${inv.no}`)} footer={<>
      <Button icon={Printer} onClick={() => setPrint(true)}>{t("ພິມໃບເກັບເງິນ", "Print invoice")}</Button>
      {manage && inv.status === "draft" && <><Button variant="danger" icon={Trash2} onClick={() => setAsk("delete")}>{t("ລຶບໃບຮ່າງ", "Delete draft")}</Button><Button variant="primary" icon={Send} onClick={() => { issueInvoice(inv.id); toast(t(`ອອກ ${inv.no} ແລ້ວ`, `${inv.no} issued`)); }}>{t("ອອກໃຫ້ລູກຄ້າ", "Issue to customer")}</Button></>}
      {manage && inv.status === "issued" && <Button variant="danger" icon={Ban} onClick={() => setAsk("cancel")}>{t("ຍົກເລີກໃບເກັບເງິນ", "Cancel invoice")}</Button>}
      {manage && isOpen(inv) && <Button variant="primary" icon={Coins} onClick={() => { setPayAmt(""); setTried(false); setPayOpen(true); }}>{t("ບັນທຶກການຊໍາລະ", "Record payment")}</Button>}
    </>}>
      <div className="space-y-4">
        {overdueDays(inv) > 0 && <Callout tone="bad" title={t(`ເກີນກໍານົດ ${overdueDays(inv)} ວັນ`, `Overdue by ${overdueDays(inv)} days`)}>{t(`ຄົບກໍານົດວັນທີ ${fmtDate(inv.dueDate)}. ຕິດຕາມລູກຄ້າເພື່ອຮັບຊໍາລະ.`, `It was due on ${fmtDate(inv.dueDate)}. Follow up with the customer to collect.`)}</Callout>}
        {inv.status === "partial" && <Callout tone="info">{t("ໃບເກັບເງິນນີ້ມີການຊໍາລະແລ້ວ ຈຶ່ງຍົກເລີກບໍ່ໄດ້.", "This invoice has payments on it, so it cannot be cancelled.")}</Callout>}
        <Dl cols={3} items={[
          { label: t("ລູກຄ້າ", "Customer"), value: <Link className="text-brand hover:underline" to={`/crm/${inv.customerId}`}>{customerName(d, inv.customerId)}</Link> }, { label: t("ສະຖານະ", "Status"), value: <InvoiceBadge i={inv} /> }, { label: t("ສະຖານີ", "Station"), value: <span className="font-mono text-[13px]">{inv.station}</span> },
          { label: t("ວັນທີອອກ", "Issue date"), value: <span className="tnum">{fmtDate(inv.issueDate)}</span> }, { label: t("ກໍານົດຊໍາລະ", "Due date"), value: <span className="tnum">{fmtDate(inv.dueDate)}</span> }, { label: t("ຜູ້ສ້າງ", "Created by"), value: d.users.find((u) => u.id === inv.createdBy)?.[t("nameLo", "nameEn") as "nameLo" | "nameEn"] ?? "—" },
          { label: t("ລວມ", "Total"), value: <b className="tnum">{money(inv.amount, inv.currency)}</b> }, { label: t("ຊໍາລະແລ້ວ", "Paid"), value: <span className="tnum">{money(inv.paidAmount, inv.currency)}</span> }, { label: t("ຄ້າງຊໍາລະ", "Balance due"), value: <b className="tnum">{money(invBal, inv.currency)}</b> },
        ]} />
        <div className="overflow-x-auto rounded border border-line"><table className="w-full min-w-[460px] text-sm"><thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-ink-2"><th className="px-3 py-2 font-semibold">AWB</th><th className="px-3 py-2 font-semibold">{t("ລາຍການ", "Description")}</th><th className="px-3 py-2 text-right font-semibold">{t("ຈໍານວນ", "Amount")}</th></tr></thead><tbody>{inv.lines.map((l, n) => <tr key={n} className="border-b border-line last:border-0"><td className="px-3 py-1.5 font-mono text-[13px] whitespace-nowrap">{l.ref}</td><td className="px-3 py-1.5">{l.description}</td><td className="px-3 py-1.5 text-right tnum whitespace-nowrap">{money(l.amount, l.currency)}</td></tr>)}</tbody></table></div>
      </div>
    </Dialog>}
    {inv && <Dialog open={payOpen} size="sm" onClose={() => setPayOpen(false)} title={t(`ບັນທຶກການຊໍາລະ ${inv.no}`, `Record payment on ${inv.no}`)} footer={<><Button onClick={() => setPayOpen(false)}>{t("ກັບຄືນ", "Go back")}</Button><Button variant="primary" icon={Coins} onClick={() => { setTried(true); if (payErr) return; payInvoice(inv.id, Number(payAmt)); setPayOpen(false); toast(t(`ບັນທຶກ ${money(Number(payAmt), inv.currency)} ແລ້ວ`, `${money(Number(payAmt), inv.currency)} recorded`)); }}>{t("ບັນທຶກ", "Record payment")}</Button></>}>
      <div className="grid grid-cols-[1fr_auto] items-start gap-2">
        <Field label={t(`ຈໍານວນທີ່ໄດ້ຮັບ (${inv.currency})`, `Amount received (${inv.currency})`)} required hint={t(`ຄ້າງຊໍາລະ ${money(invBal, inv.currency)}. ຊໍາລະບາງສ່ວນໄດ້.`, `${money(invBal, inv.currency)} due. Part payment is allowed.`)} error={tried ? payErr : undefined}><Input type="number" min={0} step="any" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} /></Field>
        <Button className="mt-5" onClick={() => setPayAmt(String(Math.round(invBal * 100) / 100))}>{t("ເຕັມຈໍານວນ", "Full balance")}</Button>
      </div>
    </Dialog>}
    {inv && <Confirm open={ask === "cancel"} onClose={() => setAsk(null)} danger title={t(`ຍົກເລີກ ${inv.no}?`, `Cancel ${inv.no}?`)} confirmLabel={t("ຍົກເລີກໃບເກັບເງິນ", "Cancel invoice")} body={t("AWB ໃນໃບນີ້ຈະກັບໄປເປັນ ຍັງບໍ່ອອກໃບເກັບເງິນ.", "The AWBs on it go back to uninvoiced.")} onConfirm={() => { cancelInvoice(inv.id); toast(t("ຍົກເລີກໃບເກັບເງິນແລ້ວ", "Invoice cancelled")); }} />}
    {inv && <Confirm open={ask === "delete"} onClose={() => setAsk(null)} danger title={t(`ລຶບໃບຮ່າງ ${inv.no}?`, `Delete draft ${inv.no}?`)} confirmLabel={t("ລຶບໃບຮ່າງ", "Delete draft")} body={t("AWB ໃນໃບນີ້ຈະກັບໄປເປັນ ຍັງບໍ່ອອກໃບເກັບເງິນ.", "The AWBs on it go back to uninvoiced.")} onConfirm={() => { const no = inv.no; setOpenId(null); deleteInvoice(inv.id); toast(t(`ລຶບ ${no} ແລ້ວ`, `${no} deleted`)); }} />}
    <Dialog open={creating} size="lg" onClose={() => setCreating(false)} title={t("ສ້າງໃບເກັບເງິນ", "Create invoice")} footer={<><Button onClick={() => setCreating(false)}>{t("ກັບຄືນ", "Go back")}</Button><Button variant="primary" icon={FilePlus2} onClick={() => { setTried(true); if (!custId || !pickedAwbs.length) return; const inv2 = createInvoice(custId, pickedAwbs.map((a) => a.id), currency); setCreating(false); setTab("invoices"); setStatus(""); setStation(inv2.station); setOpenId(inv2.id); toast(t(`ສ້າງໃບຮ່າງ ${inv2.no} ແລ້ວ`, `Draft ${inv2.no} created`)); }}>{t("ສ້າງໃບຮ່າງ", "Create draft")}</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label={t("ລູກຄ້າ", "Customer")} required error={tried && !custId ? t("ເລືອກລູກຄ້າທີ່ຈະອອກໃບເກັບເງິນ", "Choose the customer to invoice") : undefined}><Select value={custId} onChange={(e) => { setCustId(e.target.value); setPicked(new Set(uninvoiced(d, e.target.value).map((a) => a.id))); }} placeholder={t("ເລືອກລູກຄ້າ...", "Choose a customer...")} options={customerOptions} /></Field>
          <Field label={t("ສະກຸນເງິນ", "Currency")}><Select value={currency} onChange={(e) => setCurrency(e.target.value)} options={d.currencies.filter((c) => c.active).map((c) => ({ value: c.code, label: c.code }))} /></Field>
        </div>
        {custId && <div className="overflow-x-auto rounded border border-line"><table className="w-full min-w-[520px] text-sm"><thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-ink-2"><th className="w-9 px-3 py-2"><span className="sr-only">{t("ເລືອກ", "Select")}</span></th><th className="px-3 py-2 font-semibold">AWB</th><th className="px-3 py-2 font-semibold">{t("ເສັ້ນທາງ", "Route")}</th><th className="px-3 py-2 font-semibold">{t("ວັນທີ", "Date")}</th><th className="px-3 py-2 text-right font-semibold">{t("ຈໍານວນ", "Amount")}</th></tr></thead><tbody>{custAwbs.map((a) => <tr key={a.id} className="border-b border-line last:border-0"><td className="px-3 py-1.5"><input type="checkbox" aria-label={a.no} className="h-4 w-4 accent-[var(--brand)]" checked={picked.has(a.id)} onChange={() => setPicked((s) => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })} /></td><td className="px-3 py-1.5 font-mono text-[13px] whitespace-nowrap">{a.no}</td><td className="px-3 py-1.5"><Route from={a.origin} to={a.dest} /></td><td className="px-3 py-1.5 tnum whitespace-nowrap">{fmtDate(a.issuedAt)}</td><td className="px-3 py-1.5 text-right tnum whitespace-nowrap">{money(a.total, a.currency)}</td></tr>)}</tbody></table></div>}
        {tried && custId && !pickedAwbs.length && <p className="text-xs text-bad">{t("ເລືອກຢ່າງໜ້ອຍ 1 AWB", "Select at least one AWB")}</p>}
        {custNow && pickedAwbs.length > 0 && <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-line pt-3"><span className="text-sm text-ink-2">{t(`${pickedAwbs.length} AWB · ຄົບກໍານົດໃນ ${custNow.creditDays || 30} ວັນ`, `${pickedAwbs.length} AWB(s) · due in ${custNow.creditDays || 30} days`)}</span><span className="tnum text-xl font-semibold">{money(preview, currency)}</span></div>}
      </div>
    </Dialog>
    <PrintSheet open={print && !!inv} onClose={() => setPrint(false)} title={inv ? t(`ໃບເກັບເງິນ ${inv.no}`, `Invoice ${inv.no}`) : ""}>{inv && <InvoicePaper i={inv} />}</PrintSheet>
  </>;
}
