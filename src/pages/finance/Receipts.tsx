import { useMemo, useState } from "react";
import { Ban, Copy, FileDown, Pencil, RotateCcw } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { Button, Callout, Col, Confirm, DataTable, Dialog, Dl, Empty, Field, Input, PageHeader, Panel, PrintSheet, Select, StatRow, Textarea, toast } from "@/ui/kit";
import { editReceipt, refundReceipt, voidReceipt } from "@/lib/mock/finance";
import { dateAdd, fmtDateTime, money, todayIso } from "@/lib/format";
import { exportExcel } from "@/lib/export";
import { userName } from "@/ui/cargo";
import type { Receipt } from "@/lib/types";
import { MethodBadge, ReceiptBadge, ReceiptPaper } from "./shared";
import { dayOf } from "../reports/metrics";

export default function Receipts() {
  const d = useDb(); const t = useT(); const lang = useLang(); const can = useCan();
  const [from, setFrom] = useState(dateAdd(todayIso(), -30)); const [to, setTo] = useState(todayIso()); const [station, setStation] = useState(d.session.station); const [method, setMethod] = useState(""); const [cashier, setCashier] = useState(""); const [scope, setScope] = useState("");
  const [openId, setOpenId] = useState<string | null>(null); const [askVoid, setAskVoid] = useState(false); const [askRefund, setAskRefund] = useState(false); const [askEdit, setAskEdit] = useState(false); const [print, setPrint] = useState(false);
  const [amount, setAmount] = useState(""); const [reason, setReason] = useState(""); const [tried, setTried] = useState(false); const [payer, setPayer] = useState(""); const [ref, setRef] = useState("");
  const rows = useMemo(() => d.receipts.filter((r) => { const day = dayOf(r.ts); return day >= from && day <= to && (!station || r.station === station) && (!method || r.method === method) && (!cashier || r.cashierId === cashier) && (!scope || r.scope === scope); }), [d.receipts, from, to, station, method, cashier, scope]);
  const live = rows.filter((r) => r.status !== "voided"); const lakOf = (r: Receipt) => r.lakEquivalent - (r.refundAmount ?? 0) * r.rateToLak;
  const sum = (l: Receipt[]) => l.reduce((s, r) => s + lakOf(r), 0);
  const r = openId ? d.receipts.find((x) => x.id === openId) : undefined; const shift = r ? d.shifts.find((s) => s.id === r.shiftId) : undefined;
  const shiftOpen = shift?.status === "open"; const approver = can("cash.approve");
  const refundErr = r && (Number(amount) <= 0 ? t("ປ້ອນຈໍານວນທີ່ຈະຄືນ", "Enter the amount to refund") : Number(amount) > r.total + 0.005 ? t(`ຄືນໄດ້ບໍ່ເກີນ ${money(r.total, r.currency)}`, `The refund cannot exceed ${money(r.total, r.currency)}`) : undefined);
  const cols: Col<Receipt>[] = [
    { key: "no", header: t("ເລກໃບຮັບເງິນ", "Receipt no."), mono: true, render: (x) => <span className="font-semibold text-brand">{x.no}</span>, sort: (x) => x.no },
    { key: "ts", header: t("ວັນເວລາ", "Date and time"), render: (x) => <span className="tnum whitespace-nowrap">{fmtDateTime(x.ts)}</span>, sort: (x) => x.ts },
    { key: "station", header: t("ສະຖານີ", "Station"), mono: true, render: (x) => x.station, sort: (x) => x.station },
    { key: "payer", header: t("ຜູ້ຈ່າຍ", "Payer"), render: (x) => <span className="line-clamp-1">{x.payerName}</span>, sort: (x) => x.payerName },
    { key: "cashier", header: t("ຜູ້ຮັບເງິນ", "Cashier"), render: (x) => <span className="whitespace-nowrap">{userName(d, x.cashierId, lang)}</span> },
    { key: "scope", header: t("ປະເພດ", "Scope"), render: (x) => x.scope === "domestic" ? t("ພາຍໃນ", "Domestic") : t("ຕ່າງປະເທດ", "International") },
    { key: "method", header: t("ວິທີຊໍາລະ", "Method"), render: (x) => <MethodBadge method={x.method} /> },
    { key: "total", header: t("ຈໍານວນ", "Amount"), align: "right", render: (x) => <span className="whitespace-nowrap">{money(x.total, x.currency)}</span>, sort: (x) => x.lakEquivalent },
    { key: "status", header: t("ສະຖານະ", "Status"), render: (x) => <ReceiptBadge status={x.status} />, sort: (x) => x.status },
  ];
  const exportRows = () => exportExcel(t("ລາຍການໃບຮັບເງິນ", "Receipts"), `Receipts-${station || "ALL"}-${todayIso()}`, [
    { header: "Receipt", value: (x: Receipt) => x.no }, { header: "Date", value: (x) => fmtDateTime(x.ts) }, { header: "Station", value: (x) => x.station }, { header: "Scope", value: (x) => x.scope }, { header: "Payer", value: (x) => x.payerName },
    { header: "Cashier", value: (x) => userName(d, x.cashierId, "en") }, { header: "Editor", value: (x) => x.editedBy ? userName(d, x.editedBy, "en") : "" }, { header: "Approver", value: (x) => x.approvedBy ? userName(d, x.approvedBy, "en") : "" }, { header: "Method", value: (x) => x.method }, { header: "Reference", value: (x) => x.transferRef ?? "" },
    { header: "Amount", value: (x) => x.total }, { header: "Currency", value: (x) => x.currency }, { header: "Rate to LAK", value: (x) => x.rateToLak }, { header: "LAK equivalent", value: (x) => x.lakEquivalent }, { header: "Status", value: (x) => x.status }, { header: "Reason", value: (x) => x.voidReason ?? "" }, { header: "Refund", value: (x) => x.refundAmount ?? 0 },
  ], rows, `${from}..${to} ${station || "ALL"}`);
  const cashiers = [...new Set(d.receipts.map((x) => x.cashierId))];
  return <>
    <PageHeader title={t("ໃບຮັບເງິນ", "Receipts")} subtitle={t("ໃບຮັບເງິນທັງໝົດ ພ້ອມຜູ້ຮັບເງິນ, ຜູ້ແກ້ໄຂ ແລະ ຜູ້ອະນຸມັດ", "Every receipt, with who received the money, who edited it and who approved it")} actions={<Button icon={FileDown} onClick={exportRows}>{t("Export Excel", "Export Excel")}</Button>} />
    <StatRow items={[
      { label: t("ໃບຮັບເງິນໃນຊ່ວງນີ້", "Receipts in this range"), value: rows.length, sub: t(`ໃຊ້ໄດ້ ${rows.filter((x) => x.status === "valid").length}`, `${rows.filter((x) => x.status === "valid").length} valid`) },
      { label: t("ຍອດຮັບສຸດທິ", "Net collected"), value: money(sum(live)), sub: t("ຫັກການຄືນເງິນແລ້ວ", "After refunds") },
      { label: t("ເງິນສົດ", "Cash"), value: money(sum(live.filter((x) => x.method === "cash"))) },
      { label: t("ເງິນໂອນ", "Transfers"), value: money(sum(live.filter((x) => x.method === "transfer"))) },
      { label: t("ຍົກເລີກ / ຄືນເງິນ", "Voided / refunded"), value: `${rows.filter((x) => x.status === "voided").length} / ${rows.filter((x) => x.status === "refunded").length}`, tone: rows.some((x) => x.status !== "valid") ? "warn" : undefined },
    ]} />
    <Panel flush>
      <DataTable rows={rows} columns={cols} rowKey={(x) => x.id} minWidth={1040} defaultSort={{ key: "ts", dir: "desc" }} onRowClick={(x) => setOpenId(x.id)} search={(x) => `${x.no} ${x.payerName} ${x.transferRef ?? ""} ${x.lines.map((l) => l.ref).join(" ")}`}
        filters={<>
          <Input type="date" aria-label={t("ຈາກວັນທີ", "From date")} className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" aria-label={t("ຫາວັນທີ", "To date")} className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
          <Select aria-label={t("ສະຖານີ", "Station")} className="w-auto" value={station} onChange={(e) => setStation(e.target.value)} placeholder={t("ທຸກສະຖານີ", "All stations")} options={d.stations.map((s) => ({ value: s.code, label: s.code }))} />
          <Select aria-label={t("ວິທີຊໍາລະ", "Method")} className="w-auto" value={method} onChange={(e) => setMethod(e.target.value)} placeholder={t("ທຸກວິທີຊໍາລະ", "All methods")} options={[{ value: "cash", label: t("ເງິນສົດ", "Cash") }, { value: "transfer", label: t("ເງິນໂອນ", "Transfer") }]} />
          <Select aria-label={t("ຜູ້ຮັບເງິນ", "Cashier")} className="w-auto" value={cashier} onChange={(e) => setCashier(e.target.value)} placeholder={t("ທຸກຜູ້ຮັບເງິນ", "All cashiers")} options={cashiers.map((c) => ({ value: c, label: userName(d, c, lang) }))} />
          <Select aria-label={t("ປະເພດ", "Scope")} className="w-auto" value={scope} onChange={(e) => setScope(e.target.value)} placeholder={t("ພາຍໃນ ແລະ ຕ່າງປະເທດ", "Domestic and international")} options={[{ value: "domestic", label: t("ພາຍໃນ", "Domestic") }, { value: "international", label: t("ຕ່າງປະເທດ", "International") }]} />
        </>}
        empty={<Empty title={t("ບໍ່ພົບໃບຮັບເງິນໃນເງື່ອນໄຂນີ້", "No receipts match these filters")}>{t("ຂະຫຍາຍຊ່ວງວັນທີ ຫຼື ເລືອກທຸກສະຖານີ.", "Widen the date range or choose all stations.")}</Empty>} />
    </Panel>
    {r && <Dialog open={!print} size="lg" onClose={() => setOpenId(null)} title={t(`ໃບຮັບເງິນ ${r.no}`, `Receipt ${r.no}`)} footer={<>
      <Button icon={Copy} onClick={() => setPrint(true)}>{t("ພິມສໍາເນົາ", "Reprint duplicate")}</Button>
      {r.status !== "voided" && (can("cash.operate") || approver) && <Button icon={Pencil} onClick={() => { setPayer(r.payerName); setRef(r.transferRef ?? ""); setTried(false); setAskEdit(true); }}>{t("ແກ້ໄຂ", "Edit")}</Button>}
      {r.status === "valid" && <Button icon={RotateCcw} disabled={!approver} onClick={() => { setAmount(String(Math.round(r.total * 100) / 100)); setReason(""); setTried(false); setAskRefund(true); }}>{t("ຄືນເງິນ", "Refund")}</Button>}
      {r.status === "valid" && <Button variant="danger" icon={Ban} disabled={!approver || !shiftOpen} onClick={() => setAskVoid(true)}>{t("ຍົກເລີກໃບຮັບເງິນ", "Void receipt")}</Button>}
    </>}>
      <div className="space-y-4">
        {r.status === "voided" && <Callout tone="bad" title={t("ໃບຮັບເງິນນີ້ຖືກຍົກເລີກ", "This receipt is void")}>{r.voidReason}</Callout>}
        {r.status === "refunded" && <Callout tone="warn" title={t(`ຄືນເງິນ ${money(r.refundAmount ?? 0, r.currency)}`, `Refunded ${money(r.refundAmount ?? 0, r.currency)}`)}>{r.voidReason}</Callout>}
        {r.status === "valid" && !approver && <Callout tone="info">{t("ການຍົກເລີກ ແລະ ຄືນເງິນ ຕ້ອງໃຫ້ຜູ້ຈັດການອະນຸມັດ (cash.approve). ໃຫ້ຜູ້ຈັດການເຂົ້າລະບົບເພື່ອດໍາເນີນການ.", "Void and refund need a manager's approval (cash.approve). Ask a manager to sign in and do it.")}</Callout>}
        {r.status === "valid" && approver && !shiftOpen && <Callout tone="info">{t("ກະຂອງໃບຮັບເງິນນີ້ປິດແລ້ວ ຈຶ່ງຍົກເລີກບໍ່ໄດ້. ໃຫ້ໃຊ້ການຄືນເງິນແທນ.", "This receipt's shift is closed, so it can no longer be voided. Use a refund instead.")}</Callout>}
        <Dl cols={3} items={[
          { label: t("ຜູ້ຮັບເງິນ", "Recipient"), value: userName(d, r.cashierId, lang) },
          { label: t("ຜູ້ແກ້ໄຂ", "Editor"), value: r.editedBy ? userName(d, r.editedBy, lang) : t("ບໍ່ມີການແກ້ໄຂ", "Not edited") },
          { label: t("ຜູ້ອະນຸມັດ", "Approver"), value: r.approvedBy ? userName(d, r.approvedBy, lang) : t("ບໍ່ຕ້ອງອະນຸມັດ", "No approval needed") },
          { label: t("ຜູ້ຈ່າຍ", "Payer"), value: r.payerName },
          { label: t("ວັນເວລາ", "Date and time"), value: <span className="tnum">{fmtDateTime(r.ts)}</span> },
          { label: t("ສະຖານີ", "Station"), value: <span className="font-mono text-[13px]">{r.station}</span> },
          { label: t("ປະເພດ", "Scope"), value: r.scope === "domestic" ? t("ພາຍໃນ", "Domestic") : t("ຕ່າງປະເທດ", "International") },
          { label: t("ວິທີຊໍາລະ", "Method"), value: <span className="inline-flex items-center gap-1.5"><MethodBadge method={r.method} />{r.transferRef}</span> },
          { label: t("ອັດຕາທີ່ໃຊ້", "Rate used"), value: <span className="tnum">{r.currency === "LAK" ? "—" : `1 ${r.currency} = ${r.rateToLak.toLocaleString("en-US")} ₭`}</span> },
          { label: t("ກະ", "Shift"), value: <span className="font-mono text-[13px]">{r.shiftId ?? "—"}</span> },
          { label: t("ຈໍານວນ", "Amount"), value: <b className="tnum">{money(r.total, r.currency)}</b> },
          { label: t("ເທົ່າກັບກີບ", "LAK equivalent"), value: <span className="tnum">{money(r.lakEquivalent)}</span> },
        ]} />
        <div className="overflow-x-auto rounded border border-line"><table className="w-full min-w-[460px] text-sm"><thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-ink-2"><th className="px-3 py-2 font-semibold">{t("ເລກອ້າງອີງ", "Reference")}</th><th className="px-3 py-2 font-semibold">{t("ລາຍການ", "Description")}</th><th className="px-3 py-2 text-right font-semibold">{t("ຈໍານວນ", "Amount")}</th></tr></thead><tbody>{r.lines.map((l, i) => <tr key={i} className="border-b border-line last:border-0"><td className="px-3 py-1.5 font-mono text-[13px] whitespace-nowrap">{l.ref}</td><td className="px-3 py-1.5">{l.description}</td><td className="px-3 py-1.5 text-right tnum whitespace-nowrap">{money(l.amount, l.currency)}</td></tr>)}</tbody></table></div>
      </div>
    </Dialog>}
    {r && <Confirm open={askVoid} onClose={() => setAskVoid(false)} danger title={t(`ຍົກເລີກ ${r.no}?`, `Void ${r.no}?`)} confirmLabel={t("ຍົກເລີກໃບຮັບເງິນ", "Void receipt")} reasonLabel={t("ເຫດຜົນ", "Reason")} body={t("ລາຍການຈະກັບໄປລໍຖ້າຮັບເງິນຢູ່ແຄັດເຊຍ. ຊື່ທ່ານຈະຖືກບັນທຶກເປັນຜູ້ອະນຸມັດ.", "The charges return to the cashier's waiting list. Your name is recorded as the approver.")} onConfirm={(why) => { voidReceipt(r.id, why); toast(t(`ຍົກເລີກ ${r.no} ແລ້ວ`, `${r.no} voided`)); }} />}
    {r && <Dialog open={askRefund} size="sm" onClose={() => setAskRefund(false)} title={t(`ຄືນເງິນ ${r.no}`, `Refund ${r.no}`)} footer={<><Button onClick={() => setAskRefund(false)}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="danger" icon={RotateCcw} onClick={() => { setTried(true); if (refundErr || !reason.trim()) return; refundReceipt(r.id, Number(amount), reason.trim()); setAskRefund(false); toast(t(`ຄືນເງິນ ${money(Number(amount), r.currency)} ແລ້ວ`, `Refunded ${money(Number(amount), r.currency)}`)); }}>{t("ອະນຸມັດການຄືນເງິນ", "Approve refund")}</Button></>}>
      <div className="space-y-3">
        <Field label={t(`ຈໍານວນທີ່ຄືນ (${r.currency})`, `Refund amount (${r.currency})`)} required hint={t(`ຮັບມາ ${money(r.total, r.currency)}`, `Received ${money(r.total, r.currency)}`)} error={tried ? refundErr : undefined}><Input type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label={t("ເຫດຜົນ", "Reason")} required error={tried && !reason.trim() ? t("ປ້ອນເຫດຜົນການຄືນເງິນ", "Enter the reason for the refund") : undefined}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <p className="text-xs text-ink-2">{t("ຊື່ທ່ານຈະຖືກບັນທຶກເປັນຜູ້ອະນຸມັດ.", "Your name is recorded as the approver.")}</p>
      </div>
    </Dialog>}
    {r && <Dialog open={askEdit} size="sm" onClose={() => setAskEdit(false)} title={t(`ແກ້ໄຂ ${r.no}`, `Edit ${r.no}`)} footer={<><Button onClick={() => setAskEdit(false)}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={() => { setTried(true); if (!payer.trim() || (r.method === "transfer" && !ref.trim())) return; editReceipt(r.id, { payerName: payer.trim(), transferRef: r.method === "transfer" ? ref.trim() : undefined }); setAskEdit(false); toast(t("ບັນທຶກການແກ້ໄຂແລ້ວ", "Change saved")); }}>{t("ບັນທຶກ", "Save change")}</Button></>}>
      <div className="space-y-3">
        <p className="text-sm text-ink-2">{t("ແກ້ໄດ້ສະເພາະຊື່ຜູ້ຈ່າຍ ແລະ ເລກອ້າງອີງ. ຈໍານວນເງິນແກ້ບໍ່ໄດ້: ຖ້າຜິດໃຫ້ຍົກເລີກ ຫຼື ຄືນເງິນ.", "Only the payer and reference can be corrected. Amounts cannot: if one is wrong, void or refund the receipt.")}</p>
        <Field label={t("ຊື່ຜູ້ຈ່າຍ", "Payer name")} required error={tried && !payer.trim() ? t("ປ້ອນຊື່ຜູ້ຈ່າຍ", "Enter the payer's name") : undefined}><Input value={payer} onChange={(e) => setPayer(e.target.value)} /></Field>
        {r.method === "transfer" && <Field label={t("ເລກອ້າງອີງການໂອນ", "Transfer reference")} required error={tried && !ref.trim() ? t("ປ້ອນເລກອ້າງອີງ", "Enter the reference") : undefined}><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>}
      </div>
    </Dialog>}
    <PrintSheet open={print && !!r} onClose={() => setPrint(false)} title={r ? t(`ສໍາເນົາໃບຮັບເງິນ ${r.no}`, `Duplicate receipt ${r.no}`) : ""}>{r && <ReceiptPaper receipt={r} duplicate />}</PrintSheet>
  </>;
}
