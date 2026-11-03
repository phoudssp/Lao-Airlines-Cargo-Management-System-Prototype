import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Lock, Printer, Send, Wallet } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Col, DataTable, Dialog, Dl, Empty, Field, Input, PageHeader, Panel, PrintSheet, Select, StatRow, Textarea, toast } from "@/ui/kit";
import { closeShift, handOver, openShiftFor, requestHandOver, shiftExpected } from "@/lib/mock/finance";
import { fmtDate, fmtDateTime, fmtTime, money, num } from "@/lib/format";
import { userName } from "@/ui/cargo";
import type { CashShift, Db, Receipt } from "@/lib/types";
import { MethodBadge, PaperHead, ReceiptBadge, SignLine } from "./shared";
import { shiftDiff } from "../reports/metrics";

/** What a shift took in, by currency and by scope. */
function shiftFigures(d: Db, s: CashShift) {
  const e = shiftExpected(d, s); const cash = e.list.filter((r) => r.method === "cash"); const sum = (c: string) => cash.filter((r) => r.currency === c).reduce((a, r) => a + r.total - (r.refundAmount ?? 0), 0);
  const scopeLak = (x: string) => e.list.filter((r) => r.scope === x).reduce((a, r) => a + r.lakEquivalent - (r.refundAmount ?? 0) * r.rateToLak, 0);
  return { ...e, cashLak: sum("LAK"), cashUsd: sum("USD"), cashThb: sum("THB"), domestic: scopeLak("domestic"), international: scopeLak("international") };
}
const round2 = (n: number) => Math.round(n * 100) / 100;

function DiffBadge({ s }: { s: CashShift }) {
  const t = useT(); const x = shiftDiff(s); if (!x) return <span className="text-ink-3">—</span>; if (!x.any) return <Badge tone="ok">{t("ກົງກັນ", "Balanced")}</Badge>;
  const parts = [x.lak ? `${x.lak > 0 ? "+" : ""}${money(x.lak)}` : "", x.usd ? `${x.usd > 0 ? "+" : "-"}${money(Math.abs(x.usd), "USD")}` : ""].filter(Boolean).join(" · ");
  return <Badge tone="bad">{parts}</Badge>;
}
function StatusBadge({ s }: { s: CashShift }) { const t = useT(); return s.status === "open" ? <Badge tone="info">{t("ເປີດຢູ່", "Open")}</Badge> : s.status === "handed_over" ? <Badge tone="ok">{t("ມອບແລ້ວ", "Handed over")}</Badge> : s.handedTo ? <Badge tone="warn">{t("ລໍຖ້າອະນຸມັດ", "Awaiting approval")}</Badge> : <Badge tone="warn">{t("ປິດແລ້ວ", "Closed")}</Badge>; }

function HandoverPaper({ s }: { s: CashShift }) {
  const d = useDb(); const f = shiftFigures(d, s); const diff = shiftDiff(s);
  const row = (label: string, lak: string, usd: string, strong?: boolean) => <tr className="border-b border-black/20"><td className="py-1 pr-2">{label}</td><td className={`py-1 text-right tnum ${strong ? "font-bold" : ""}`}>{lak}</td><td className={`py-1 text-right tnum ${strong ? "font-bold" : ""}`}>{usd}</td></tr>;
  return <div className="text-[13px] leading-5 text-black">
    <PaperHead station={s.station} title="ໃບມອບເງິນ / Cash handover" no={s.id} />
    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5">
      <div>ວັນທີ / Date: <b className="tnum">{fmtDate(s.date)}</b></div><div>ສະຖານີ / Station: <b className="font-mono">{s.station}</b></div>
      <div>ຜູ້ຮັບເງິນ / Cashier: <b>{userName(d, s.cashierId, "lo")} ({userName(d, s.cashierId, "en")})</b></div><div>ເປີດ - ປິດ / Opened - closed: <b className="tnum">{fmtTime(s.openedAt)} - {s.closedAt ? fmtTime(s.closedAt) : "—"}</b></div>
    </div>
    <table className="mt-3 w-full border-collapse"><thead><tr className="border-y border-black text-left"><th className="py-1 font-semibold">ລາຍການ / Item</th><th className="py-1 text-right font-semibold">LAK</th><th className="py-1 text-right font-semibold">USD</th></tr></thead><tbody>
      {row("ເງິນຕັ້ງຕົ້ນ / Opening float", money(s.openingLak), money(s.openingUsd, "USD"))}
      {row("ເງິນສົດຮັບ / Cash received", money(f.cashLak), money(f.cashUsd, "USD"))}
      {row("ຍອດທີ່ຄວນມີ / Expected", money(s.expectedLak ?? f.lak), money(s.expectedUsd ?? f.usd, "USD"))}
      {row("ນັບໄດ້ / Counted", s.countedLak != null ? money(s.countedLak) : "—", s.countedUsd != null ? money(s.countedUsd, "USD") : "—", true)}
      {row("ສ່ວນຕ່າງ / Difference", diff ? money(diff.lak) : "—", diff ? `${diff.usd < 0 ? "-" : ""}${money(Math.abs(diff.usd), "USD")}` : "—", true)}
    </tbody></table>
    <div className="mt-2 grid grid-cols-2 gap-x-6">
      <div>ເງິນໂອນ (ບໍ່ຢູ່ໃນລິ້ນຊັກ) / Transfers, not in drawer: <b className="tnum">{money(f.transferLak)}</b></div>
      <div>ຈໍານວນໃບຮັບເງິນ / Receipts: <b className="tnum">{f.count}</b></div>
      {f.cashThb > 0 && <div>ເງິນສົດບາດ / THB cash: <b className="tnum">{money(f.cashThb, "THB")}</b></div>}
    </div>
    {s.note && <div className="mt-2">ໝາຍເຫດ / Note: {s.note}</div>}
    {f.list.length > 0 && <table className="mt-3 w-full border-collapse text-xs"><thead><tr className="border-y border-black text-left"><th className="py-0.5 font-semibold">ໃບຮັບເງິນ / Receipt</th><th className="py-0.5 font-semibold">ຜູ້ຈ່າຍ / Payer</th><th className="py-0.5 font-semibold">ວິທີ / Method</th><th className="py-0.5 text-right font-semibold">ຈໍານວນ / Amount</th></tr></thead><tbody>{f.list.map((r) => <tr key={r.id} className="border-b border-black/20"><td className="py-0.5 font-mono">{r.no}</td><td className="py-0.5">{r.payerName}</td><td className="py-0.5">{r.method === "cash" ? "Cash" : `Transfer ${r.transferRef ?? ""}`}</td><td className="py-0.5 text-right tnum">{money(r.total, r.currency)}</td></tr>)}</tbody></table>}
    <div className="grid grid-cols-2 gap-10"><SignLine label={`ຜູ້ມອບ / Handed over by: ${userName(d, s.cashierId, "en")}`} /><SignLine label={`ຜູ້ຮັບມອບ / Received by: ${s.handedTo ? userName(d, s.handedTo, "en") : ""}`} /></div>
  </div>;
}

export default function CashClose() {
  const d = useDb(); const t = useT(); const lang = useLang(); const can = useCan(); const st = d.session.station; const myId = d.session.userId;
  const shift = openShiftFor(d, st);
  const [count, setCount] = useState(false); const [lak, setLak] = useState(""); const [usd, setUsd] = useState(""); const [thb, setThb] = useState(""); const [note, setNote] = useState(""); const [tried, setTried] = useState(false);
  const [detail, setDetail] = useState<string | null>(null); const [print, setPrint] = useState<string | null>(null); const [give, setGive] = useState<string | null>(null); const [manager, setManager] = useState("");
  const [branch, setBranch] = useState(st); const [branchScope, setBranchScope] = useState("");
  const f = shift ? shiftFigures(d, shift) : null;
  const history = useMemo(() => d.shifts.filter((s) => { const b = d.stations.find((x) => x.code === s.station); return s.status !== "open" && (!branch || s.station === branch) && (!branchScope || b?.scope === branchScope); }), [d.shifts, d.stations, branch, branchScope]);
  const canClose = !!shift && (shift.cashierId === myId || can("cash.approve")) && (can("cash.operate") || can("cash.approve"));
  const managers = d.users.filter((u) => u.active && u.id !== myId && d.roles.find((r) => r.id === u.roleId)?.perms.includes("cash.approve"));

  const dLak = f && lak !== "" ? Number(lak) - Math.round(f.lak) : 0; const dUsd = f && usd !== "" ? round2(Number(usd) - f.usd) : 0; const dThb = f && thb !== "" ? round2(Number(thb) - f.cashThb) : 0;
  const hasDiff = dLak !== 0 || dUsd !== 0 || dThb !== 0; const needThb = !!f && f.cashThb > 0;
  const missing = lak === "" || usd === "" || (needThb && thb === ""); const needNote = hasDiff && !note.trim();
  const submit = () => { setTried(true); if (!shift || !f || missing || needNote) return; const full = [note.trim(), needThb ? `THB ${num(Number(thb), 2)} / ${num(f.cashThb, 2)}` : ""].filter(Boolean).join(" · "); closeShift(shift.id, { lak: Number(lak), usd: Number(usd), note: full || undefined }); setCount(false); setDetail(shift.id); toast(hasDiff ? t("ປິດກະແລ້ວ ໂດຍມີສ່ວນຕ່າງ. ມອບເງິນໃຫ້ຜູ້ຈັດການ.", "Shift closed with a difference. Hand it over to a manager.") : t("ປິດກະແລ້ວ ຍອດກົງກັນ. ມອບເງິນໃຫ້ຜູ້ຈັດການ.", "Shift closed and balanced. Hand it over to a manager."), hasDiff ? "warn" : "ok"); };

  const recCols: Col<Receipt>[] = [
    { key: "no", header: t("ເລກໃບຮັບເງິນ", "Receipt no."), mono: true, render: (r) => r.no, sort: (r) => r.no },
    { key: "time", header: t("ເວລາ", "Time"), render: (r) => <span className="tnum">{fmtTime(r.ts)}</span>, sort: (r) => r.ts },
    { key: "payer", header: t("ຜູ້ຈ່າຍ", "Payer"), render: (r) => <span className="line-clamp-1">{r.payerName}</span> },
    { key: "method", header: t("ວິທີຊໍາລະ", "Method"), render: (r) => <MethodBadge method={r.method} /> },
    { key: "amount", header: t("ຈໍານວນ", "Amount"), align: "right", render: (r) => <span className="whitespace-nowrap">{money(r.total, r.currency)}</span>, sort: (r) => r.lakEquivalent },
    { key: "status", header: t("ສະຖານະ", "Status"), render: (r) => <ReceiptBadge status={r.status} /> },
  ];
  const histCols: Col<CashShift>[] = [
    { key: "date", header: t("ວັນທີ", "Date"), render: (s) => <span className="tnum whitespace-nowrap">{fmtDate(s.date)}</span>, sort: (s) => s.date },
    { key: "station", header: t("ສາຂາ", "Branch"), mono: true, render: (s) => s.station, sort: (s) => s.station },
    { key: "cashier", header: t("ຜູ້ຮັບເງິນ", "Cashier"), render: (s) => <span className="whitespace-nowrap">{userName(d, s.cashierId, lang)}</span> },
    { key: "domestic", header: t("ພາຍໃນ", "Domestic"), align: "right", render: (s) => { const x = shiftFigures(d, s); return x.count ? <span className="whitespace-nowrap">{money(x.domestic)}</span> : "—"; } },
    { key: "international", header: t("ຕ່າງປະເທດ", "International"), align: "right", render: (s) => { const x = shiftFigures(d, s); return x.count ? <span className="whitespace-nowrap">{money(x.international)}</span> : "—"; } },
    { key: "expected", header: t("ຄວນມີ (LAK)", "Expected LAK"), align: "right", render: (s) => <span className="whitespace-nowrap">{s.expectedLak != null ? money(s.expectedLak) : "—"}</span> },
    { key: "counted", header: t("ນັບໄດ້ (LAK)", "Counted LAK"), align: "right", render: (s) => <span className="whitespace-nowrap">{s.countedLak != null ? money(s.countedLak) : "—"}</span> },
    { key: "diff", header: t("ສ່ວນຕ່າງ", "Difference"), render: (s) => <DiffBadge s={s} />, sort: (s) => Math.abs(shiftDiff(s)?.lak ?? 0) + Math.abs(shiftDiff(s)?.usd ?? 0) },
    { key: "status", header: t("ສະຖານະ", "Status"), render: (s) => <StatusBadge s={s} /> },
  ];
  const open = detail ? d.shifts.find((s) => s.id === detail) : undefined; const giveShift = give ? d.shifts.find((s) => s.id === give) : undefined; const printing = print ? d.shifts.find((s) => s.id === print) : undefined;
  const openFig = open ? shiftFigures(d, open) : null; const openDiff = open ? shiftDiff(open) : null;
  const waiting = d.shifts.filter((s) => s.status === "closed" && (!branch || s.station === branch));
  return <>
    <PageHeader title={t("ຄັງເງິນ ແລະ ປິດຍອດ", "Cash drawer and day close")} subtitle={t(`ລິ້ນຊັກເງິນ ສະຖານີ ${st}, ການນັບເງິນ ແລະ ການມອບເງິນໃຫ້ຜູ້ຈັດການ`, `The ${st} cash drawer, the count and the handover to a manager`)} />
    {shift && f ? <>
      <StatRow items={[
        { label: t("ເງິນຕັ້ງຕົ້ນ", "Opening float"), value: money(shift.openingLak), sub: money(shift.openingUsd, "USD") },
        { label: t("ເງິນສົດກີບ", "Cash LAK"), value: money(f.cashLak) },
        { label: t("ເງິນສົດໂດລາ", "Cash USD"), value: money(f.cashUsd, "USD"), sub: f.cashThb > 0 ? `+ ${money(f.cashThb, "THB")}` : undefined },
        { label: t("ເງິນໂອນ", "Transfers"), value: money(f.transferLak), sub: t("ບໍ່ຢູ່ໃນລິ້ນຊັກ", "Not in the drawer") },
        { label: t("ຍອດທີ່ຄວນມີ", "Expected in drawer"), value: money(f.lak), sub: money(f.usd, "USD") },
      ]} />
      <Panel flush className="mb-4" title={t(`ກະປັດຈຸບັນ: ${userName(d, shift.cashierId, lang)}, ເປີດ ${fmtTime(shift.openedAt)}`, `Current shift: ${userName(d, shift.cashierId, lang)}, opened ${fmtTime(shift.openedAt)}`)} actions={<><Button icon={Printer} onClick={() => setPrint(shift.id)}>{t("ພິມໃບສະຫຼຸບ", "Print summary")}</Button><Button variant="primary" icon={Lock} disabled={!canClose} title={canClose ? undefined : t("ສະເພາະເຈົ້າຂອງກະ ຫຼື ຜູ້ຈັດການ", "Only the shift's cashier or a manager")} onClick={() => { setLak(""); setUsd(""); setThb(""); setNote(""); setTried(false); setCount(true); }}>{t("ນັບເງິນ ແລະ ປິດກະ", "Count and close shift")}</Button></>}>
        <DataTable rows={f.list} columns={recCols} rowKey={(r) => r.id} minWidth={620} pageSize={8} defaultSort={{ key: "time", dir: "desc" }} empty={<Empty title={t("ກະນີ້ຍັງບໍ່ມີໃບຮັບເງິນ", "No receipts in this shift yet")}>{t("ໃບຮັບເງິນຈາກແຄັດເຊຍຈະສະແດງຢູ່ນີ້.", "Receipts taken at the cashier appear here.")}</Empty>} />
      </Panel>
    </> : <Panel className="mb-4"><Empty icon={Wallet} title={t(`ບໍ່ມີກະເປີດຢູ່ສະຖານີ ${st}`, `No shift is open at ${st}`)} action={<Link to="/finance/cashier"><Button variant="primary">{t("ໄປເປີດກະທີ່ແຄັດເຊຍ", "Open a shift at the cashier")}</Button></Link>}>{t("ເປີດກະໃໝ່ຈາກໜ້າແຄັດເຊຍ. ກະທີ່ປິດແລ້ວຢູ່ໃນປະຫວັດຂ້າງລຸ່ມ.", "Start a new shift from the cashier page. Closed shifts are in the history below.")}</Empty></Panel>}
    {waiting.length > 0 && <div className="mb-4"><Callout tone="warn" title={t(`${waiting.length} ກະປິດແລ້ວ ແຕ່ຍັງບໍ່ໄດ້ມອບ`, `${waiting.length} closed shift(s) not yet handed over`)}>{t("ເປີດກະໃນປະຫວັດ ເພື່ອມອບໃຫ້ຜູ້ຈັດການ ຫຼື ອະນຸມັດ.", "Open a shift in the history to hand it to a manager or to approve it.")}</Callout></div>}
    <Panel flush title={t("ປະຫວັດກະ", "Shift history")}>
      <DataTable rows={history} columns={histCols} rowKey={(s) => s.id} minWidth={960} defaultSort={{ key: "date", dir: "desc" }} onRowClick={(s) => setDetail(s.id)}
        filters={<>
          <Select aria-label={t("ສາຂາ", "Branch")} className="w-auto" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder={t("ທຸກສາຂາ", "All branches")} options={d.stations.map((s) => ({ value: s.code, label: s.code }))} />
          <Select aria-label={t("ປະເພດສາຂາ", "Branch type")} className="w-auto" value={branchScope} onChange={(e) => setBranchScope(e.target.value)} placeholder={t("ພາຍໃນ ແລະ ຕ່າງປະເທດ", "Domestic and international")} options={[{ value: "domestic", label: t("ສາຂາພາຍໃນ", "Domestic branches") }, { value: "international", label: t("ສາຂາຕ່າງປະເທດ", "International branches") }]} />
        </>}
        empty={<Empty title={t("ຍັງບໍ່ມີກະທີ່ປິດແລ້ວ", "No closed shifts here")}>{t("ເລືອກທຸກສາຂາ ເພື່ອເບິ່ງກະຂອງສາຂາອື່ນ.", "Choose all branches to see other branches' shifts.")}</Empty>} />
    </Panel>

    {shift && f && <Dialog open={count} onClose={() => setCount(false)} title={t("ນັບເງິນ ແລະ ປິດກະ", "Count cash and close the shift")} footer={<><Button onClick={() => setCount(false)}>{t("ກັບຄືນ", "Go back")}</Button><Button variant="primary" icon={Lock} onClick={submit}>{t("ປິດກະ", "Close shift")}</Button></>}>
      <div className="space-y-3">
        <p className="text-sm text-ink-2">{t("ນັບເງິນຈິງໃນລິ້ນຊັກ ແລ້ວປ້ອນຈໍານວນ. ກະທີ່ປິດແລ້ວເປີດຄືນບໍ່ໄດ້.", "Count the actual cash in the drawer and enter it. A closed shift cannot be reopened.")}</p>
        {([["LAK", lak, setLak, f.lak, dLak], ["USD", usd, setUsd, f.usd, dUsd], ...(needThb ? [["THB", thb, setThb, f.cashThb, dThb]] : [])] as [string, string, (v: string) => void, number, number][]).map(([c, v, set, exp, diff]) => <div key={c} className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_1fr]">
          <Field label={t(`ນັບໄດ້ ${c}`, `Counted ${c}`)} required error={tried && v === "" ? t(`ປ້ອນຈໍານວນ ${c} ທີ່ນັບໄດ້`, `Enter the ${c} you counted`) : undefined}><Input type="number" min={0} step={c === "LAK" ? 1000 : 0.01} value={v} onChange={(e) => set(e.target.value)} /></Field>
          <div><div className="box-label mb-1">{t("ຄວນມີ", "Expected")}</div><div className="tnum leading-9">{money(exp, c)}</div></div>
          <div><div className="box-label mb-1">{t("ສ່ວນຕ່າງ", "Difference")}</div><div className="leading-9">{v === "" ? <span className="text-ink-3">—</span> : diff === 0 ? <Badge tone="ok">{t("ກົງກັນ", "Balanced")}</Badge> : <Badge tone="bad">{diff > 0 ? t(`ເກີນ ${money(diff, c)}`, `Over ${money(diff, c)}`) : t(`ຂາດ ${money(-diff, c)}`, `Short ${money(-diff, c)}`)}</Badge>}</div></div>
        </div>)}
        <Field label={t("ໝາຍເຫດ", "Note")} required={hasDiff} hint={hasDiff ? undefined : t("ຕ້ອງປ້ອນເມື່ອມີສ່ວນຕ່າງ", "Required when there is a difference")} error={tried && needNote ? t("ອະທິບາຍສາເຫດຂອງສ່ວນຕ່າງ ກ່ອນປິດກະ", "Explain the difference before closing the shift") : undefined}><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Dialog>}

    {open && <Dialog open={!print && !give} size="lg" onClose={() => setDetail(null)} title={t(`ກະ ${open.id} · ${open.station} · ${fmtDate(open.date)}`, `Shift ${open.id} · ${open.station} · ${fmtDate(open.date)}`)} footer={<>
      <Button icon={Printer} onClick={() => setPrint(open.id)}>{t("ພິມໃບມອບເງິນ", "Print handover sheet")}</Button>
      {open.status === "closed" && !open.handedTo && <Button variant="primary" icon={Send} disabled={!(open.cashierId === myId || can("cash.approve"))} onClick={() => { setManager(""); setTried(false); setGive(open.id); }}>{t("ມອບໃຫ້ຜູ້ຈັດການ", "Hand over to a manager")}</Button>}
      {open.status === "closed" && !!open.handedTo && <Button variant="success" icon={CheckCircle2} disabled={!can("cash.approve") || open.cashierId === myId} onClick={() => { handOver(open.id, myId!); toast(t("ອະນຸມັດການມອບເງິນແລ້ວ", "Handover approved")); }}>{t("ອະນຸມັດ ແລະ ຮັບມອບ", "Approve and receive")}</Button>}
    </>}>
      <div className="space-y-4">
        {openDiff?.any && <Callout tone="bad" title={t("ກະນີ້ມີສ່ວນຕ່າງ", "This shift has a difference")}>{open.note ?? t("ບໍ່ມີໝາຍເຫດ", "No note recorded")}</Callout>}
        {open.status === "closed" && open.handedTo && <Callout tone="warn" title={t(`ລໍຖ້າ ${userName(d, open.handedTo, lang)} ອະນຸມັດ`, `Waiting for ${userName(d, open.handedTo, lang)} to approve`)}>{can("cash.approve") ? (open.cashierId === myId ? t("ທ່ານເປັນເຈົ້າຂອງກະນີ້ ຈຶ່ງອະນຸມັດເອງບໍ່ໄດ້.", "You ran this shift, so you cannot approve it yourself.") : t("ກວດເງິນ ແລ້ວກົດອະນຸມັດ.", "Check the cash, then approve.")) : t("ຜູ້ຈັດການຕ້ອງເຂົ້າລະບົບເພື່ອອະນຸມັດ (cash.approve).", "The manager must sign in to approve (cash.approve).")}</Callout>}
        <Dl cols={3} items={[
          { label: t("ຜູ້ຮັບເງິນ", "Cashier"), value: userName(d, open.cashierId, lang) }, { label: t("ສະຖານະ", "Status"), value: <StatusBadge s={open} /> }, { label: t("ສ່ວນຕ່າງ", "Difference"), value: <DiffBadge s={open} /> },
          { label: t("ເປີດ", "Opened"), value: <span className="tnum">{fmtDateTime(open.openedAt)}</span> }, { label: t("ປິດ", "Closed"), value: <span className="tnum">{fmtDateTime(open.closedAt)}</span> }, { label: t("ຜູ້ອະນຸມັດ", "Approved by"), value: open.approvedBy ? userName(d, open.approvedBy, lang) : "—" },
          { label: t("ຄວນມີ LAK", "Expected LAK"), value: <span className="tnum">{open.expectedLak != null ? money(open.expectedLak) : "—"}</span> }, { label: t("ນັບໄດ້ LAK", "Counted LAK"), value: <span className="tnum">{open.countedLak != null ? money(open.countedLak) : "—"}</span> }, { label: t("ເງິນຕັ້ງຕົ້ນ LAK", "Opening LAK"), value: <span className="tnum">{money(open.openingLak)}</span> },
          { label: t("ຄວນມີ USD", "Expected USD"), value: <span className="tnum">{open.expectedUsd != null ? money(open.expectedUsd, "USD") : "—"}</span> }, { label: t("ນັບໄດ້ USD", "Counted USD"), value: <span className="tnum">{open.countedUsd != null ? money(open.countedUsd, "USD") : "—"}</span> }, { label: t("ໃບຮັບເງິນ", "Receipts"), value: <span className="tnum">{openFig?.count}</span> },
        ]} />
        {open.status !== "open" && <p className="flex items-center gap-1.5 text-sm text-ink-2"><AlertTriangle size={14} aria-hidden />{t("ກະທີ່ປິດແລ້ວເປີດຄືນບໍ່ໄດ້ ເພື່ອຮັກສາຍອດເງິນທີ່ນັບແລ້ວ. ຖ້າພົບຂໍ້ຜິດພາດ ໃຫ້ບັນທຶກການຄືນເງິນໃນໃບຮັບເງິນ ຫຼື ແຈ້ງໃນກະຖັດໄປ.", "A closed shift cannot be reopened, which protects the counted figures. If you find a mistake, refund on the receipt or record it in the next shift.")}</p>}
      </div>
    </Dialog>}

    {giveShift && <Dialog open size="sm" onClose={() => setGive(null)} title={t(`ມອບກະ ${giveShift.id} ໃຫ້ຜູ້ຈັດການ`, `Hand over shift ${giveShift.id}`)} footer={<><Button onClick={() => setGive(null)}>{t("ກັບຄືນ", "Go back")}</Button><Button variant="primary" icon={Send} onClick={() => { setTried(true); if (!manager) return; requestHandOver(giveShift.id, manager); setGive(null); toast(t("ສົ່ງໃຫ້ຜູ້ຈັດການອະນຸມັດແລ້ວ", "Sent to the manager for approval")); }}>{t("ສົ່ງໃຫ້ອະນຸມັດ", "Send for approval")}</Button></>}>
      <Field label={t("ຜູ້ຈັດການທີ່ຮັບມອບ", "Manager receiving the cash")} required error={tried && !manager ? t("ເລືອກຜູ້ຈັດການ", "Choose a manager") : undefined}><Select value={manager} onChange={(e) => setManager(e.target.value)} placeholder={t("ເລືອກ...", "Choose...")} options={managers.map((u) => ({ value: u.id, label: `${lang === "lo" ? u.nameLo : u.nameEn} (${u.station})` }))} /></Field>
      <p className="mt-2 text-sm text-ink-2">{t("ກະຈະຍັງບໍ່ຖືວ່າມອບແລ້ວ ຈົນກວ່າຜູ້ຈັດການຈະເຂົ້າລະບົບ ແລະ ກົດອະນຸມັດ.", "The shift is not handed over until that manager signs in and approves it.")}</p>
    </Dialog>}
    <PrintSheet open={!!printing} onClose={() => setPrint(null)} title={printing ? t(`ໃບມອບເງິນ ${printing.id}`, `Handover sheet ${printing.id}`) : ""}>{printing && <HandoverPaper s={printing} />}</PrintSheet>
  </>;
}
