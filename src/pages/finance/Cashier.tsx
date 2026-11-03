import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Copy, Printer, Wallet } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Col, DataTable, Empty, Field, Input, PageHeader, Panel, PrintSheet, Select, toast, cx } from "@/ui/kit";
import { Route, userName } from "@/ui/cargo";
import { openShift, openShiftFor, pendingCharges, takePayment, type PendingCharge } from "@/lib/mock/finance";
import { rateToLak } from "@/lib/pricing";
import { fmtTime, money, num } from "@/lib/format";
import type { PayMethod } from "@/lib/types";
import { ReceiptPaper } from "./shared";

const CURRENCIES = ["LAK", "USD", "THB"];
const keyOf = (c: PendingCharge) => `${c.kind}:${c.id}`;
/** Amount a cashier can actually hand over: whole kip, or two decimals for foreign currency. */
const payable = (n: number, c: string) => (c === "LAK" ? Math.round(n) : Math.round(n * 100) / 100);

function OpenShiftForm() {
  const t = useT(); const d = useDb(); const can = useCan(); const [lak, setLak] = useState(""); const [usd, setUsd] = useState(""); const [tried, setTried] = useState(false);
  const validLak = lak.trim() !== "" && Number(lak) >= 0; const validUsd = usd.trim() !== "" && Number(usd) >= 0;
  if (!can("cash.operate")) return <Panel><Empty icon={Wallet} title={t("ຍັງບໍ່ມີກະເປີດຢູ່ສະຖານີນີ້", "No shift is open at this station")}>{t("ບົດບາດຂອງທ່ານບໍ່ມີສິດເປີດກະ. ໃຫ້ພະນັກງານການເງິນເຂົ້າລະບົບເພື່ອເປີດກະ.", "Your role cannot open a shift. Ask a cashier to sign in and open one.")}</Empty></Panel>;
  return <Panel title={t("ເປີດກະແຄັດເຊຍ", "Open a cashier shift")} className="max-w-xl">
    <form onSubmit={(e) => { e.preventDefault(); setTried(true); if (!validLak || !validUsd) return; openShift({ openingLak: Number(lak), openingUsd: Number(usd) }); toast(t("ເປີດກະແລ້ວ. ເລີ່ມຮັບເງິນໄດ້", "Shift opened. You can take payments now")); }}>
      <p className="mb-3 text-sm text-ink-2">{t(`ຕ້ອງເປີດກະກ່ອນຈຶ່ງຮັບເງິນໄດ້. ນັບເງິນຕັ້ງຕົ້ນໃນລິ້ນຊັກ ສະຖານີ ${d.session.station} ແລ້ວປ້ອນຈໍານວນ.`, `A shift must be open before taking payment. Count the opening float in the ${d.session.station} drawer and enter it here.`)}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("ເງິນຕັ້ງຕົ້ນ ກີບ (LAK)", "Opening float LAK")} required error={tried && !validLak ? t("ປ້ອນຈໍານວນກີບ, ຖ້າບໍ່ມີໃຫ້ປ້ອນ 0", "Enter the kip count, or 0 if none") : undefined}><Input type="number" min={0} step={1000} value={lak} onChange={(e) => setLak(e.target.value)} autoFocus /></Field>
        <Field label={t("ເງິນຕັ້ງຕົ້ນ ໂດລາ (USD)", "Opening float USD")} required error={tried && !validUsd ? t("ປ້ອນຈໍານວນໂດລາ, ຖ້າບໍ່ມີໃຫ້ປ້ອນ 0", "Enter the dollar count, or 0 if none") : undefined}><Input type="number" min={0} step={1} value={usd} onChange={(e) => setUsd(e.target.value)} /></Field>
      </div>
      <div className="mt-4"><Button type="submit" variant="primary" icon={Wallet}>{t("ເປີດກະ", "Open shift")}</Button></div>
    </form>
  </Panel>;
}

export default function Cashier() {
  const d = useDb(); const t = useT(); const can = useCan(); const lang = useLang(); const st = d.session.station;
  const shift = openShiftFor(d, st);
  const charges = useMemo(() => pendingCharges(d, st), [d, st]);
  const [sel, setSel] = useState<Set<string>>(new Set()); const [kind, setKind] = useState("");
  const [payCur, setPayCur] = useState("LAK"); const [method, setMethod] = useState<PayMethod>("cash"); const [tendered, setTendered] = useState(""); const [ref, setRef] = useState(""); const [payer, setPayer] = useState<string | null>(null); const [tried, setTried] = useState(false);
  const [print, setPrint] = useState<{ id: string; duplicate: boolean; tendered?: number; change?: number } | null>(null); const [lastId, setLastId] = useState<string | null>(null);

  const selected = charges.filter((c) => sel.has(keyOf(c)));
  const scope = selected[0]?.scope;
  const toggle = (c: PendingCharge) => { if (scope && c.scope !== scope) { toast(t("ໃບຮັບເງິນໜຶ່ງໃບ ມີໄດ້ປະເພດດຽວ: ພາຍໃນ ຫຼື ຕ່າງປະເທດ. ຮັບເງິນປະເພດນີ້ໃຫ້ແລ້ວກ່ອນ.", "One receipt covers one scope, domestic or international. Finish this payment first."), "warn"); return; } setSel((s) => { const n = new Set(s); n.has(keyOf(c)) ? n.delete(keyOf(c)) : n.add(keyOf(c)); return n; }); };
  const creditOpen = d.awbs.filter((a) => a.status === "active" && a.payMode === "credit" && !a.invoiceId && a.station === st).length;

  const byCurrency = selected.reduce<Record<string, number>>((m, c) => { m[c.currency] = (m[c.currency] ?? 0) + c.amount; return m; }, {});
  const lak = selected.reduce((s, c) => s + c.amount * rateToLak(d, c.currency), 0);
  const inCurrency = (c: string) => { const r = rateToLak(d, c); return c === "LAK" ? lak : r ? lak / r : 0; };
  const due = payable(inCurrency(payCur), payCur);
  const given = Number(tendered); const change = method === "cash" && tendered !== "" ? payable(given - due, payCur) : 0;
  const payerName = payer ?? selected[0]?.payer ?? "";
  const payerMix = new Set(selected.map((c) => c.payer)).size > 1;
  const canPay = can("cash.operate");
  const errTender = method === "cash" && (tendered === "" || given < due) ? (tendered === "" ? t("ປ້ອນຈໍານວນເງິນທີ່ຮັບມາ", "Enter the amount received") : t(`ຍັງຂາດ ${money(due - given, payCur)}. ຮັບເງິນໃຫ້ຄົບກ່ອນ`, `Still ${money(due - given, payCur)} short. Collect the full amount first`)) : undefined;
  const errRef = method === "transfer" && !ref.trim() ? t("ປ້ອນເລກອ້າງອີງການໂອນຈາກໃບແຈ້ງທະນາຄານ", "Enter the transfer reference from the bank slip") : undefined;
  const errPayer = !payerName.trim() ? t("ປ້ອນຊື່ຜູ້ຈ່າຍ", "Enter the payer's name") : undefined;

  const pay = () => {
    setTried(true); if (!selected.length || errTender || errRef || errPayer) return;
    const res = takePayment({ items: selected, payCurrency: payCur, method, transferRef: method === "transfer" ? ref.trim() : undefined, payerName: payerName.trim() });
    if (!res.ok) { toast(t("ບໍ່ມີກະເປີດຢູ່. ເປີດກະກ່ອນແລ້ວຮັບເງິນອີກຄັ້ງ", "No shift is open. Open one, then take the payment again"), "bad"); return; }
    setPrint({ id: res.id, duplicate: false, tendered: method === "cash" ? given : undefined, change: method === "cash" ? change : undefined }); setLastId(res.id);
    setSel(new Set()); setTendered(""); setRef(""); setPayer(null); setTried(false);
  };
  const printing = print ? d.receipts.find((r) => r.id === print.id) : undefined; const last = lastId ? d.receipts.find((r) => r.id === lastId) : undefined;

  const kindName = (k: PendingCharge["label"]) => k === "freight" ? t("ຄ່າຂົນສົ່ງ", "Freight") : k === "storage" ? t("ຄ່າຝາກສາງ", "Storage") : t("ຖົງເມ", "Mail");
  const cols: Col<PendingCharge>[] = [
    { key: "pick", header: "", width: "36px", render: (c) => <input type="checkbox" aria-label={t(`ເລືອກ ${c.ref}`, `Select ${c.ref}`)} className="h-4 w-4 accent-[var(--brand)]" checked={sel.has(keyOf(c))} disabled={!!scope && c.scope !== scope} onClick={(e) => e.stopPropagation()} onChange={() => toggle(c)} /> },
    { key: "kind", header: t("ປະເພດ", "Kind"), render: (c) => <Badge noIcon>{kindName(c.label)}</Badge>, sort: (c) => c.label },
    { key: "ref", header: t("ເລກອ້າງອີງ", "Reference"), render: (c) => c.kind === "awb" ? <Link to={`/export/awb/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[13px] font-semibold text-brand whitespace-nowrap hover:underline">{c.ref}</Link> : <span className="font-mono text-[13px] font-semibold whitespace-nowrap">{c.ref}</span>, sort: (c) => c.ref },
    { key: "payer", header: t("ຜູ້ຈ່າຍ", "Payer"), render: (c) => <span className="line-clamp-1">{c.payer}</span>, sort: (c) => c.payer },
    { key: "scope", header: t("ເສັ້ນທາງ", "Scope"), render: (c) => c.scope === "domestic" ? t("ພາຍໃນ", "Domestic") : t("ຕ່າງປະເທດ", "International"), sort: (c) => c.scope },
    { key: "amount", header: t("ຈໍານວນ", "Amount"), align: "right", render: (c) => <span className="whitespace-nowrap">{money(c.amount, c.currency)}</span>, sort: (c) => c.amount * rateToLak(d, c.currency) },
  ];

  return <>
    <PageHeader title={t("ແຄັດເຊຍ POS", "Cashier POS")} subtitle={shift ? t(`ສະຖານີ ${st} · ກະຂອງ ${userName(d, shift.cashierId, lang)} ເປີດເວລາ ${fmtTime(shift.openedAt)}`, `Station ${st} · ${userName(d, shift.cashierId, lang)}'s shift, opened ${fmtTime(shift.openedAt)}`) : t(`ສະຖານີ ${st}`, `Station ${st}`)} actions={shift && <><Link to="/finance/receipts"><Button icon={Printer}>{t("ໃບຮັບເງິນທັງໝົດ", "All receipts")}</Button></Link><Link to="/finance/cash"><Button>{t("ນັບເງິນ ແລະ ປິດກະ", "Count and close shift")}</Button></Link></>} />
    {!shift ? <OpenShiftForm /> : <>
      {shift.cashierId !== d.session.userId && <div className="mb-3"><Callout tone="info">{t(`ລິ້ນຊັກນີ້ເປັນກະຂອງ ${userName(d, shift.cashierId, lang)}. ໃບຮັບເງິນທີ່ອອກຈາກໜ້ານີ້ຈະເຂົ້າກະນັ້ນ ໂດຍບັນທຶກຊື່ທ່ານເປັນຜູ້ຮັບເງິນ.`, `This drawer belongs to ${userName(d, shift.cashierId, lang)}'s shift. Receipts issued here go into that shift, with your name as the person receiving the money.`)}</Callout></div>}
      {!canPay && <div className="mb-3"><Callout tone="warn" title={t("ເບິ່ງໄດ້ຢ່າງດຽວ", "View only")}>{t("ບົດບາດຂອງທ່ານບໍ່ມີສິດຮັບເງິນ (cash.operate). ໃຫ້ພະນັກງານການເງິນເປັນຜູ້ຮັບເງິນ.", "Your role cannot take payments (cash.operate). A cashier must do this.")}</Callout></div>}
      {last && <div className="mb-3"><Callout tone="ok" title={t(`ອອກໃບຮັບເງິນ ${last.no} ແລ້ວ`, `Receipt ${last.no} issued`)} action={<Button size="sm" icon={Copy} onClick={() => setPrint({ id: last.id, duplicate: true })}>{t("ພິມສໍາເນົາ", "Reprint duplicate")}</Button>}>{money(last.total, last.currency)} · {last.payerName}</Callout></div>}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <Panel flush title={t("ລາຍການລໍຖ້າຮັບເງິນ", "Charges waiting for payment")} actions={selected.length > 0 && <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>{t(`ລ້າງການເລືອກ (${selected.length})`, `Clear selection (${selected.length})`)}</Button>}>
            <DataTable rows={charges.filter((c) => !kind || c.label === kind)} columns={cols} rowKey={keyOf} minWidth={590} pageSize={10} onRowClick={toggle}
              search={(c) => `${c.ref} ${c.payer}`}
              filters={<Select aria-label={t("ປະເພດ", "Kind")} className="w-auto" value={kind} onChange={(e) => setKind(e.target.value)} placeholder={t("ທຸກປະເພດ", "All kinds")} options={(["freight", "storage", "mail"] as const).map((k) => ({ value: k, label: kindName(k) }))} />}
              empty={<Empty icon={CheckCircle2} title={t("ບໍ່ມີລາຍການຄ້າງຮັບ", "Nothing waiting for payment")}>{t(`ທຸກລາຍການເງິນສົດຂອງສະຖານີ ${st} ຮັບເງິນແລ້ວ. ລາຍການໃໝ່ຈະມາເອງເມື່ອອອກ AWB ຫຼື ຄິດຄ່າຝາກສາງ.`, `All cash charges at ${st} are collected. New ones appear here when an AWB is issued or storage is charged.`)}</Empty>} />
          </Panel>
          <Callout tone="info" title={t("ລູກຄ້າຕິດໜີ້ບໍ່ຮັບເງິນຢູ່ນີ້", "Credit customers are not collected here")} action={<Link to="/finance/invoices"><Button size="sm">{t("ໄປໃບເກັບເງິນ", "Go to invoices")}</Button></Link>}>{t(`AWB ແບບຕິດໜີ້ຈະລວມໃສ່ໃບເກັບເງິນ ແລະ ຮັບຊໍາລະໃນໜ້າໃບເກັບເງິນ. ສະຖານີນີ້ມີ ${creditOpen} AWB ທີ່ຍັງບໍ່ໄດ້ອອກໃບເກັບເງິນ.`, `Credit AWBs are billed on an invoice and settled on the invoices page. This station has ${creditOpen} AWB(s) not yet invoiced.`)}</Callout>
        </div>
        <Panel title={t("ຮັບເງິນ", "Take payment")}>
          {!selected.length ? <Empty title={t("ຍັງບໍ່ໄດ້ເລືອກລາຍການ", "No charge selected")}>{t("ເລືອກລາຍການຈາກຕາຕະລາງ ເພື່ອຄິດໄລ່ຍອດ.", "Select charges from the table to work out the total.")}</Empty> : <div className="space-y-3">
            <div>
              <div className="box-label">{t(`ຍອດຕາມສະກຸນເງິນ (${selected.length} ລາຍການ)`, `Total in charge currency (${selected.length} item${selected.length > 1 ? "s" : ""})`)}</div>
              {Object.entries(byCurrency).map(([c, v]) => <div key={c} className="tnum text-sm font-medium">{money(v, c)}</div>)}
            </div>
            <div className="rounded border border-line">
              {CURRENCIES.map((c) => <button key={c} type="button" onClick={() => { setPayCur(c); setTendered(""); }} aria-pressed={payCur === c} className={cx("flex w-full items-baseline justify-between gap-3 border-b border-line px-3 py-1.5 text-left last:border-0", payCur === c ? "bg-brand-soft" : "hover:bg-surface-2")}>
                <span className="text-sm"><span className={cx("font-mono text-[13px]", payCur === c && "font-semibold text-brand")}>{c}</span>{c !== "LAK" && <span className="ml-2 text-xs text-ink-2 tnum">1 {c} = {num(rateToLak(d, c))} ₭</span>}</span>
                <span className={cx("tnum", payCur === c ? "text-xl font-semibold" : "text-sm text-ink-2")}>{money(payable(inCurrency(c), c), c)}</span>
              </button>)}
            </div>
            <div role="group" aria-label={t("ວິທີຊໍາລະ", "Payment method")} className="grid grid-cols-2 gap-2">
              <Button variant={method === "cash" ? "primary" : "secondary"} aria-pressed={method === "cash"} onClick={() => setMethod("cash")}>{t("ເງິນສົດ", "Cash")}</Button>
              <Button variant={method === "transfer" ? "primary" : "secondary"} aria-pressed={method === "transfer"} onClick={() => setMethod("transfer")}>{t("ເງິນໂອນ", "Transfer")}</Button>
            </div>
            {method === "cash" ? <div className="grid grid-cols-[1fr_auto] items-start gap-2">
              <Field label={t(`ເງິນທີ່ຮັບມາ (${payCur})`, `Amount tendered (${payCur})`)} required error={tried ? errTender : undefined}><Input type="number" min={0} step={payCur === "LAK" ? 1000 : 0.01} value={tendered} onChange={(e) => setTendered(e.target.value)} /></Field>
              <Button className="mt-5" onClick={() => setTendered(String(due))}>{t("ພໍດີ", "Exact")}</Button>
              <div className="col-span-2 flex items-baseline justify-between border-t border-line pt-2"><span className="text-sm text-ink-2">{t("ເງິນທອນ", "Change")}</span><span className="tnum text-xl font-semibold">{money(Math.max(0, change), payCur)}</span></div>
            </div> : <Field label={t("ເລກອ້າງອີງການໂອນ", "Transfer reference")} required error={tried ? errRef : undefined}><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="BCEL-" /></Field>}
            <Field label={t("ຊື່ຜູ້ຈ່າຍ", "Payer name")} required error={tried ? errPayer : undefined} hint={payerMix ? t("ລາຍການທີ່ເລືອກມີຫຼາຍຜູ້ຈ່າຍ. ກວດຊື່ທີ່ຈະພິມໃສ່ໃບຮັບເງິນ.", "The selected charges have different payers. Check the name printed on the receipt.") : undefined}><Input value={payerName} onChange={(e) => setPayer(e.target.value)} /></Field>
            <Button variant="success" size="lg" className="w-full" icon={Printer} disabled={!canPay} onClick={pay}>{t(`ຮັບ ${money(due, payCur)} ແລະ ພິມໃບຮັບເງິນ`, `Take ${money(due, payCur)} and print receipt`)}</Button>
          </div>}
        </Panel>
      </div>
    </>}
    <PrintSheet open={!!printing} onClose={() => setPrint(null)} title={printing ? t(`ໃບຮັບເງິນ ${printing.no}`, `Receipt ${printing.no}`) : ""}>{printing && <ReceiptPaper receipt={printing} duplicate={print?.duplicate} tendered={print?.tendered} change={print?.change} />}</PrintSheet>
  </>;
}
