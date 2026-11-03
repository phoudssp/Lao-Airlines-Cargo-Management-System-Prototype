import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useLang, useName, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Checkbox, Col, Confirm, DataTable, Dialog, Field, IconButton, Input, MonoCode, PageHeader, Panel, Select, StatRow, Tabs, Textarea, toast } from "@/ui/kit";
import { ApprovalBadge, userName } from "@/ui/cargo";
import type { Currency, Db, ExchangeRate } from "@/lib/types";
import { dateAdd, fmtDate, fmtDateTime, money, num, todayIso } from "@/lib/format";
import { rateToLak } from "@/lib/pricing";
import { decideRate, deleteRate, removeFrom, requestRate, upsert } from "@/lib/mock/master";

const lak = (n: number) => money(n, "LAK");
/** The approved rate record actually in force on the date; matches rateToLak. */
const inForce = (d: Db, code: string, on = todayIso()) => d.rates.filter((x) => x.currency === code && x.status === "approved" && x.effectiveFrom <= on).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
const changePct = (from: number, to: number) => (from ? ((to - from) / from) * 100 : 0);
const signed = (n: number) => `${n > 0 ? "+" : ""}${num(n, 2)}%`;

const noteText = (t: (lo: string, en: string) => string, s?: string) => { const p = (s ?? "").split(" / "); return p.length === 2 ? t(p[0], p[1]) : s ?? ""; };

export default function CurrencyPage() {
  const d = useDb(); const t = useT();
  const [tab, setTab] = useState<"rates" | "currencies">("rates");
  return <>
    <PageHeader title={t("ອັດຕາແລກປ່ຽນ", "Exchange rates")} subtitle={t("ທຸກການປ່ຽນອັດຕາຕ້ອງຜ່ານການອະນຸມັດ ແລະ ມີວັນທີເລີ່ມໃຊ້. ອັດຕາທີ່ໃຊ້ຢູ່ແມ່ນອັດຕາທີ່ອະນຸມັດຫຼ້າສຸດ ຈົນຮອດມື້ນີ້.", "Every rate change needs approval and an effective date. The rate in force is the latest one approved up to today.")} />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: "rates", label: t("ອັດຕາ", "Rates"), count: d.rates.filter((r) => r.status === "pending").length || undefined }, { key: "currencies", label: t("ສະກຸນເງິນ", "Currencies"), count: d.currencies.length }]} />
    {tab === "rates" ? <RatesTab /> : <CurrenciesTab />}
  </>;
}

// ---------- Rates ----------
function RatesTab() {
  const d = useDb(); const t = useT(); const name = useName(); const lang = useLang(); const can = useCan();
  const approve = can("rates.approve");
  const canRequest = approve || can("master.manage") || can("cash.operate");
  const [request, setRequest] = useState<string | null>(null); const [accept, setAccept] = useState<ExchangeRate | null>(null); const [reject, setReject] = useState<ExchangeRate | null>(null); const [del, setDel] = useState<ExchangeRate | null>(null);
  const [cur, setCur] = useState(""); const [status, setStatus] = useState("");
  const foreign = d.currencies.filter((c) => c.code !== "LAK" && c.active);
  const pending = d.rates.filter((r) => r.status === "pending").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const missing = foreign.filter((c) => !rateToLak(d, c.code));
  const mayDelete = (r: ExchangeRate) => approve || r.requestedBy === d.session.userId;
  const rows = d.rates.filter((r) => (!cur || r.currency === cur) && (!status || r.status === status));
  const scheduled = (code: string) => d.rates.filter((r) => r.currency === code && r.status === "approved" && r.effectiveFrom > todayIso()).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
  const history: Col<ExchangeRate>[] = [
    { key: "cur", header: t("ສະກຸນເງິນ", "Currency"), mono: true, render: (r) => <span className="font-semibold">{r.currency}</span>, sort: (r) => r.currency },
    { key: "rate", header: t("ອັດຕາ (ກີບ)", "Rate (LAK)"), align: "right", render: (r) => lak(r.toLak), sort: (r) => r.toLak },
    { key: "from", header: t("ເລີ່ມໃຊ້", "Effective from"), render: (r) => <span className="tnum whitespace-nowrap">{fmtDate(r.effectiveFrom)}</span>, sort: (r) => r.effectiveFrom },
    { key: "status", header: t("ສະຖານະ", "Status"), render: (r) => <span className="inline-flex items-center gap-1.5"><ApprovalBadge status={r.status} />{inForce(d, r.currency)?.id === r.id && <Badge tone="info" noIcon>{t("ໃຊ້ຢູ່ມື້ນີ້", "In force today")}</Badge>}{r.status === "approved" && r.effectiveFrom > todayIso() && <Badge noIcon>{t("ລໍຖ້າມື້ເລີ່ມໃຊ້", "Scheduled")}</Badge>}</span>, sort: (r) => r.status },
    { key: "by", header: t("ຜູ້ຂໍ", "Requested by"), render: (r) => <span className="whitespace-nowrap">{userName(d, r.requestedBy, lang)}</span> },
    { key: "at", header: t("ວັນທີຂໍ", "Requested"), render: (r) => <span className="tnum whitespace-nowrap">{fmtDateTime(r.createdAt)}</span>, sort: (r) => r.createdAt },
    { key: "dec", header: t("ຜູ້ຕັດສິນ", "Decided by"), render: (r) => <span className="whitespace-nowrap">{userName(d, r.decidedBy, lang)}</span> },
    { key: "note", header: t("ໝາຍເຫດ", "Note"), render: (r) => noteText(t, r.note) },
  ];
  return <>
    <StatRow items={[
      ...foreign.slice(0, 3).map((c) => { const r = rateToLak(d, c.code); return { label: t(`1 ${c.code} ມື້ນີ້`, `1 ${c.code} today`), value: r ? lak(r) : t("ບໍ່ມີອັດຕາ", "No rate"), tone: r ? undefined : ("bad" as const), sub: r ? t(`ໃຊ້ແຕ່ ${fmtDate(inForce(d, c.code)?.effectiveFrom)}`, `Since ${fmtDate(inForce(d, c.code)?.effectiveFrom)}`) : t("ຍັງບໍ່ໄດ້ອະນຸມັດ", "None approved yet") }; }),
      { label: t("ລໍຖ້າອະນຸມັດ", "Waiting for approval"), value: pending.length, tone: pending.length ? ("warn" as const) : undefined },
    ]} />
    {missing.length > 0 && <div className="mb-4"><Callout tone="bad" title={t("ສະກຸນເງິນບໍ່ມີອັດຕາທີ່ອະນຸມັດ", "Currency without an approved rate")}>{t(`${missing.map((c) => c.code).join(", ")} ຍັງແປງເປັນກີບບໍ່ໄດ້. ກະລຸນາຂໍອັດຕາໃໝ່.`, `${missing.map((c) => c.code).join(", ")} cannot be converted to LAK. Request a rate.`)}</Callout></div>}

    <Panel flush className="mb-4" title={t("ຄໍາຂໍລໍຖ້າອະນຸມັດ", "Requests waiting for approval")}>
      {pending.length === 0 ? <p className="px-4 py-3 text-sm text-ink-2">{t("ບໍ່ມີຄໍາຂໍທີ່ຄ້າງຢູ່.", "No requests are waiting.")}</p> : <>
        {!approve && <div className="border-b border-line px-4 py-2 text-xs text-ink-2">{t("ອັດຕາໃໝ່ຈະມີຜົນຫຼັງຜູ້ມີສິດອະນຸມັດຢືນຢັນ. ທ່ານບໍ່ມີສິດອະນຸມັດອັດຕາແລກປ່ຽນ.", "A new rate takes effect after an approver confirms it. Your role cannot approve exchange rates.")}</div>}
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-ink-2"><th className="px-3 py-2 font-semibold">{t("ສະກຸນເງິນ", "Currency")}</th><th className="px-3 py-2 text-right font-semibold">{t("ອັດຕາທີ່ຂໍ", "Requested rate")}</th><th className="px-3 py-2 text-right font-semibold">{t("ປ່ຽນຈາກປັດຈຸບັນ", "Change from current")}</th><th className="px-3 py-2 font-semibold">{t("ເລີ່ມໃຊ້", "Effective from")}</th><th className="px-3 py-2 font-semibold">{t("ຜູ້ຂໍ", "Requested by")}</th><th className="px-3 py-2 font-semibold">{t("ໝາຍເຫດ", "Note")}</th><th className="px-3 py-2" /></tr></thead>
          <tbody>{pending.map((r) => { const cur0 = rateToLak(d, r.currency); return <tr key={r.id} className="border-b border-line last:border-0">
            <td className="px-3 py-2"><MonoCode className="font-semibold">{r.currency}</MonoCode></td>
            <td className="tnum whitespace-nowrap px-3 py-2 text-right font-medium">{lak(r.toLak)}</td>
            <td className="tnum whitespace-nowrap px-3 py-2 text-right">{cur0 ? signed(changePct(cur0, r.toLak)) : "—"}</td>
            <td className="tnum whitespace-nowrap px-3 py-2">{fmtDate(r.effectiveFrom)}</td>
            <td className="whitespace-nowrap px-3 py-2">{userName(d, r.requestedBy, lang)}<span className="tnum block text-xs text-ink-2">{fmtDateTime(r.createdAt)}</span></td>
            <td className="px-3 py-2">{noteText(t, r.note)}</td>
            <td className="px-3 py-2"><span className="flex justify-end gap-1.5">
              {approve && <><Button size="sm" variant="success" icon={Check} onClick={() => setAccept(r)}>{t("ອະນຸມັດ", "Approve")}</Button><Button size="sm" variant="danger" icon={X} onClick={() => setReject(r)}>{t("ບໍ່ອະນຸມັດ", "Reject")}</Button></>}
              {!approve && <ApprovalBadge status="pending" />}
              {mayDelete(r) && <IconButton icon={Trash2} label={t("ລຶບຄໍາຂໍ", "Delete request")} onClick={() => setDel(r)} />}
            </span></td>
          </tr>; })}</tbody></table></div>
      </>}
    </Panel>

    <Panel flush className="mb-4" title={t("ອັດຕາທີ່ໃຊ້ຢູ່ມື້ນີ້", "Rates in force today")} actions={canRequest && <Button variant="primary" icon={Plus} onClick={() => setRequest("")}>{t("ຂໍອັດຕາໃໝ່", "Request new rate")}</Button>}>
      {!canRequest && <div className="border-b border-line px-4 py-2 text-xs text-ink-2">{t("ການຂໍອັດຕາໃໝ່ຕ້ອງມີສິດການເງິນ ຫຼື ຈັດການຂໍ້ມູນພື້ນຖານ.", "Requesting a rate needs a cashier, master data or approver permission.")}</div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-ink-2"><th className="px-3 py-2 font-semibold">{t("ສະກຸນເງິນ", "Currency")}</th><th className="px-3 py-2 text-right font-semibold">{t("1 ໜ່ວຍ ເທົ່າກັບ", "1 unit equals")}</th><th className="px-3 py-2 font-semibold">{t("ໃຊ້ແຕ່", "In force since")}</th><th className="px-3 py-2 font-semibold">{t("ອັດຕາຖັດໄປ", "Next approved rate")}</th><th className="px-3 py-2" /></tr></thead>
        <tbody>{foreign.map((c) => { const r = rateToLak(d, c.code); const next = scheduled(c.code); return <tr key={c.code} className="border-b border-line last:border-0">
          <td className="px-3 py-2"><MonoCode className="font-semibold">{c.code}</MonoCode> <span className="text-ink-2">{name(c)}</span></td>
          <td className="tnum whitespace-nowrap px-3 py-2 text-right font-medium">{r ? lak(r) : <Badge tone="bad">{t("ບໍ່ມີອັດຕາ", "No rate")}</Badge>}</td>
          <td className="tnum whitespace-nowrap px-3 py-2">{fmtDate(inForce(d, c.code)?.effectiveFrom)}</td>
          <td className="tnum whitespace-nowrap px-3 py-2">{next ? `${lak(next.toLak)} · ${fmtDate(next.effectiveFrom)}` : "—"}</td>
          <td className="px-3 py-2 text-right">{canRequest && <Button size="sm" onClick={() => setRequest(c.code)}>{t(`ຂໍອັດຕາ ${c.code}`, `Request ${c.code} rate`)}</Button>}</td>
        </tr>; })}</tbody></table></div>
    </Panel>

    <Panel flush title={t("ປະຫວັດອັດຕາ", "Rate history")}>
      <DataTable rows={rows} columns={history} rowKey={(r) => r.id} minWidth={960} defaultSort={{ key: "from", dir: "desc" }} pageSize={10} search={(r) => `${r.currency} ${r.toLak} ${r.note ?? ""}`}
        filters={<>
          <Select aria-label={t("ສະກຸນເງິນ", "Currency")} className="w-auto" value={cur} onChange={(e) => setCur(e.target.value)} placeholder={t("ທຸກສະກຸນເງິນ", "All currencies")} options={d.currencies.filter((c) => c.code !== "LAK").map((c) => ({ value: c.code, label: c.code }))} />
          <Select aria-label={t("ສະຖານະ", "Status")} className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t("ທຸກສະຖານະ", "All statuses")} options={[{ value: "pending", label: t("ລໍຖ້າອະນຸມັດ", "Pending approval") }, { value: "approved", label: t("ອະນຸມັດແລ້ວ", "Approved") }, { value: "rejected", label: t("ບໍ່ອະນຸມັດ", "Rejected") }]} />
        </>} />
    </Panel>

    {request !== null && <RateForm currency={request} onClose={() => setRequest(null)} />}
    <Confirm open={!!accept} onClose={() => setAccept(null)} title={t(`ອະນຸມັດອັດຕາ ${accept?.currency ?? ""}?`, `Approve the ${accept?.currency ?? ""} rate?`)} confirmLabel={t("ອະນຸມັດ", "Approve")} body={accept && t(`1 ${accept.currency} = ${lak(accept.toLak)} ເລີ່ມໃຊ້ ${fmtDate(accept.effectiveFrom)}. ໃບຮັບເງິນໃໝ່ຈະໃຊ້ອັດຕານີ້ແຕ່ວັນນັ້ນເປັນຕົ້ນໄປ.`, `1 ${accept.currency} = ${lak(accept.toLak)} from ${fmtDate(accept.effectiveFrom)}. New receipts use this rate from that date.`)} onConfirm={() => { if (accept) { decideRate(accept.id, true); toast(t("ອະນຸມັດອັດຕາແລ້ວ", "Rate approved")); } }} />
    <Confirm open={!!reject} onClose={() => setReject(null)} danger title={t(`ບໍ່ອະນຸມັດອັດຕາ ${reject?.currency ?? ""}?`, `Reject the ${reject?.currency ?? ""} rate?`)} reasonLabel={t("ເຫດຜົນ", "Reason")} confirmLabel={t("ບໍ່ອະນຸມັດ", "Reject")} onConfirm={(why) => { if (reject) { decideRate(reject.id, false, why); toast(t("ບັນທຶກການບໍ່ອະນຸມັດແລ້ວ", "Rate rejected")); } }} />
    <Confirm open={!!del} onClose={() => setDel(null)} danger title={t("ລຶບຄໍາຂໍນີ້?", "Delete this request?")} body={del && `1 ${del.currency} = ${lak(del.toLak)} · ${fmtDate(del.effectiveFrom)}`} confirmLabel={t("ລຶບຄໍາຂໍ", "Delete request")} onConfirm={() => { if (del) { deleteRate(del.id); toast(t("ລຶບຄໍາຂໍແລ້ວ", "Request deleted")); } }} />
  </>;
}

function RateForm({ currency, onClose }: { currency: string; onClose: () => void }) {
  const d = useDb(); const t = useT(); const name = useName();
  const foreign = d.currencies.filter((c) => c.code !== "LAK" && c.active);
  const [code, setCode] = useState(currency || foreign[0]?.code || ""); const [rate, setRate] = useState(""); const [from, setFrom] = useState(dateAdd(todayIso(), 1)); const [note, setNote] = useState(""); const [tried, setTried] = useState(false);
  const cur = rateToLak(d, code); const val = Number(rate);
  const errs = {
    code: code ? "" : t("ກະລຸນາເລືອກສະກຸນເງິນ", "Choose a currency"),
    rate: val > 0 ? "" : t("ກະລຸນາປ້ອນອັດຕາທີ່ຫຼາຍກວ່າ 0", "Enter a rate above 0"),
    from: !from ? t("ກະລຸນາເລືອກວັນທີເລີ່ມໃຊ້", "Choose an effective date") : from < todayIso() ? t("ວັນທີເລີ່ມໃຊ້ຕ້ອງເປັນມື້ນີ້ ຫຼື ຫຼັງຈາກນີ້", "The effective date must be today or later") : d.rates.some((r) => r.currency === code && r.status === "pending" && r.effectiveFrom === from) ? t("ມີຄໍາຂໍລໍຖ້າຢູ່ແລ້ວສໍາລັບວັນທີນີ້. ກະລຸນາລຶບຄໍາຂໍເກົ່າ ຫຼື ເລືອກວັນອື່ນ", "A request is already waiting for this date. Delete it or choose another date") : "",
  };
  const pct = cur && val > 0 ? changePct(cur, val) : 0;
  const save = () => {
    setTried(true); if (Object.values(errs).some(Boolean)) return;
    requestRate({ currency: code, toLak: val, effectiveFrom: from, note: note.trim() || undefined });
    toast(t("ສົ່ງຄໍາຂໍແລ້ວ ລໍຖ້າການອະນຸມັດ", "Request sent and waiting for approval")); onClose();
  };
  return <Dialog open onClose={onClose} size="sm" title={t("ຂໍອັດຕາແລກປ່ຽນໃໝ່", "Request a new exchange rate")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{t("ສົ່ງຄໍາຂໍ", "Send request")}</Button></>}>
    <div className="grid gap-3">
      <Field label={t("ສະກຸນເງິນ", "Currency")} required error={tried && errs.code || undefined}><Select value={code} onChange={(e) => setCode(e.target.value)} options={foreign.map((c) => ({ value: c.code, label: `${c.code} · ${name(c)}` }))} /></Field>
      <Field label={t(`ກີບຕໍ່ 1 ${code}`, `LAK per 1 ${code}`)} required error={tried && errs.rate || undefined} hint={cur ? t(`ອັດຕາປັດຈຸບັນ ${lak(cur)}`, `Current rate ${lak(cur)}`) : t("ຍັງບໍ່ມີອັດຕາທີ່ອະນຸມັດ", "No approved rate yet")}><Input type="number" min={0} step="any" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
      {Math.abs(pct) >= 5 && <Callout tone="warn">{t(`ອັດຕານີ້ຕ່າງຈາກປັດຈຸບັນ ${signed(pct)}. ກະລຸນາກວດຄືນກ່ອນສົ່ງ.`, `This is ${signed(pct)} from the current rate. Check it before sending.`)}</Callout>}
      <Field label={t("ເລີ່ມໃຊ້ວັນທີ", "Effective from")} required error={tried && errs.from || undefined}><Input type="date" value={from} min={todayIso()} onChange={(e) => setFrom(e.target.value)} /></Field>
      <Field label={t("ໝາຍເຫດ", "Note")} hint={t("ເຊັ່ນ ແຫຼ່ງອັດຕາ ທະນາຄານ", "Such as the bank the rate came from")}><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </div>
  </Dialog>;
}

// ---------- Currencies ----------
function CurrenciesTab() {
  const d = useDb(); const t = useT(); const name = useName(); const can = useCan();
  const manage = can("master.manage");
  const [edit, setEdit] = useState<Currency | "new" | null>(null); const [del, setDel] = useState<Currency | null>(null);
  const refs = (code: string) => { const list: [number, string, string][] = [
    [d.rates.filter((r) => r.currency === code).length, "ອັດຕາແລກປ່ຽນ", "exchange rates"], [d.tariffs.filter((x) => x.currency === code).length, "ອັດຕາຄ່າບໍລິການ", "tariffs"],
    [d.awbs.filter((a) => a.currency === code).length, "AWB", "AWBs"], [d.receipts.filter((r) => r.currency === code).length, "ໃບຮັບເງິນ", "receipts"], [d.invoices.filter((i) => i.currency === code).length, "ໃບເກັບເງິນ", "invoices"],
  ]; return list.filter(([n]) => n > 0).map(([n, lo, en]) => t(`${lo} ${n} ລາຍການ`, `${n} ${en}`)); };
  const toggle = (c: Currency, active: boolean) => {
    if (c.code === "LAK") { toast(t("ກີບເປັນສະກຸນເງິນຫຼັກ ປິດໃຊ້ບໍ່ໄດ້", "LAK is the base currency and cannot be deactivated."), "warn"); return; }
    upsert("currencies", { ...c, active }, false); toast(active ? t(`ເປີດໃຊ້ ${c.code} ແລ້ວ`, `${c.code} is active`) : t(`ປິດໃຊ້ ${c.code} ແລ້ວ`, `${c.code} is inactive`));
  };
  const cols: Col<Currency>[] = [
    { key: "code", header: t("ລະຫັດ", "Code"), mono: true, render: (c) => <span className="font-semibold">{c.code}</span>, sort: (c) => c.code },
    { key: "name", header: t("ຊື່", "Name"), render: (c) => <span className="inline-flex items-center gap-1.5">{name(c)}{c.code === "LAK" && <Badge tone="info" noIcon>{t("ສະກຸນຫຼັກ", "Base")}</Badge>}</span>, sort: (c) => c.nameEn },
    { key: "symbol", header: t("ສັນຍາລັກ", "Symbol"), render: (c) => c.symbol },
    { key: "rate", header: t("ອັດຕາມື້ນີ້", "Rate today"), align: "right", render: (c) => { const r = rateToLak(d, c.code); return c.code === "LAK" ? "—" : r ? lak(r) : <Badge tone={c.active ? "bad" : "neutral"}>{t("ບໍ່ມີອັດຕາ", "No rate")}</Badge>; } },
    { key: "active", header: t("ສະຖານະ", "Status"), render: (c) => <Checkbox label={c.active ? t("ເປີດໃຊ້", "Active") : t("ປິດໃຊ້", "Inactive")} checked={c.active} disabled={!manage || c.code === "LAK"} onChange={(v) => toggle(c, v)} /> },
    ...(manage ? [{ key: "act", header: "", align: "right" as const, render: (c: Currency) => <span className="inline-flex"><IconButton icon={Pencil} label={t(`ແກ້ໄຂ ${c.code}`, `Edit ${c.code}`)} onClick={() => setEdit(c)} /><IconButton icon={Trash2} label={t(`ລຶບ ${c.code}`, `Delete ${c.code}`)} onClick={() => setDel(c)} /></span> }] : []),
  ];
  const blockers = del ? refs(del.code) : []; const isBase = del?.code === "LAK"; const blocked = !!del && (isBase || blockers.length > 0);
  return <>
    {!manage && <div className="mb-3"><Callout tone="info">{t("ທ່ານເບິ່ງໄດ້ຢ່າງດຽວ. ການແກ້ໄຂຕ້ອງມີສິດຈັດການຂໍ້ມູນພື້ນຖານ.", "You can view this list. Changes need the Manage master data permission.")}</Callout></div>}
    <Panel flush>
      <DataTable rows={d.currencies} columns={cols} rowKey={(c) => c.code} minWidth={640} defaultSort={{ key: "code", dir: "asc" }} search={(c) => `${c.code} ${c.nameLo} ${c.nameEn}`} toolbar={manage && <Button variant="primary" icon={Plus} onClick={() => setEdit("new")}>{t("ເພີ່ມສະກຸນເງິນ", "Add currency")}</Button>} />
    </Panel>
    {edit && <CurrencyForm currency={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
    <Dialog open={blocked} onClose={() => setDel(null)} size="sm" title={t(`ລຶບ ${del?.code ?? ""} ບໍ່ໄດ້`, `${del?.code ?? ""} cannot be deleted`)} footer={<><Button onClick={() => setDel(null)}>{t("ປິດ", "Close")}</Button>{del && !isBase && del.active && <Button variant="primary" onClick={() => { toggle(del, false); setDel(null); }}>{t("ປິດໃຊ້ແທນ", "Deactivate instead")}</Button>}</>}>
      {isBase ? <p className="text-sm">{t("ກີບເປັນສະກຸນເງິນຫຼັກຂອງລະບົບ.", "LAK is the system's base currency.")}</p> : <><p className="mb-2 text-sm">{t("ຂໍ້ມູນຕໍ່ໄປນີ້ຍັງໃຊ້ສະກຸນເງິນນີ້. ໃຫ້ປິດໃຊ້ແທນການລຶບ.", "These records still use this currency. Deactivate it instead.")}</p><ul className="tnum list-disc space-y-0.5 pl-5 text-sm">{blockers.map((x) => <li key={x}>{x}</li>)}</ul></>}
    </Dialog>
    <Confirm open={!!del && !blocked} onClose={() => setDel(null)} danger title={t(`ລຶບສະກຸນເງິນ ${del?.code ?? ""}?`, `Delete currency ${del?.code ?? ""}?`)} body={t("ບໍ່ມີຂໍ້ມູນໃດໃຊ້ສະກຸນເງິນນີ້.", "No record uses this currency.")} confirmLabel={t("ລຶບສະກຸນເງິນ", "Delete currency")} onConfirm={() => { if (del) { removeFrom("currencies", del.code); toast(t(`ລຶບ ${del.code} ແລ້ວ`, `${del.code} deleted`)); } }} />
  </>;
}

function CurrencyForm({ currency, onClose }: { currency?: Currency; onClose: () => void }) {
  const d = useDb(); const t = useT();
  const [f, setF] = useState<Currency>(currency ?? { code: "", nameLo: "", nameEn: "", symbol: "", active: true }); const [tried, setTried] = useState(false);
  const req = t("ກະລຸນາປ້ອນຂໍ້ມູນນີ້", "Enter this field");
  const errs = {
    code: currency ? "" : !/^[A-Z]{3}$/.test(f.code) ? t("ລະຫັດຕ້ອງເປັນຕົວພິມໃຫຍ່ 3 ຕົວ ເຊັ່ນ THB", "The code must be 3 capital letters, such as THB") : d.currencies.some((c) => c.code === f.code) ? t(`ມີ ${f.code} ແລ້ວ`, `${f.code} already exists`) : "",
    nameLo: f.nameLo.trim() ? "" : req, nameEn: f.nameEn.trim() ? "" : req, symbol: f.symbol.trim() ? "" : req,
  };
  const save = () => {
    setTried(true); if (Object.values(errs).some(Boolean)) return;
    upsert("currencies", { ...f, nameLo: f.nameLo.trim(), nameEn: f.nameEn.trim(), symbol: f.symbol.trim() }, !currency);
    if (currency) toast(t(`ບັນທຶກ ${f.code} ແລ້ວ`, `${f.code} saved`));
    else toast(t(`ເພີ່ມ ${f.code} ແລ້ວ. ຂັ້ນຕໍ່ໄປ ຂໍອັດຕາແລກປ່ຽນໃນແຖບອັດຕາ`, `${f.code} added. Next, request its exchange rate on the Rates tab.`));
    onClose();
  };
  return <Dialog open onClose={onClose} size="sm" title={currency ? t(`ແກ້ໄຂ ${currency.code}`, `Edit ${currency.code}`) : t("ເພີ່ມສະກຸນເງິນ", "Add currency")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{currency ? t("ບັນທຶກການແກ້ໄຂ", "Save changes") : t("ເພີ່ມສະກຸນເງິນ", "Add currency")}</Button></>}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("ລະຫັດ ISO", "ISO code")} required error={tried && errs.code || undefined}><Input className="font-mono" maxLength={3} value={f.code} disabled={!!currency} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
      <Field label={t("ສັນຍາລັກ", "Symbol")} required error={tried && errs.symbol || undefined}><Input value={f.symbol} onChange={(e) => setF({ ...f, symbol: e.target.value })} /></Field>
      <Field label={t("ຊື່ພາສາລາວ", "Name in Lao")} required error={tried && errs.nameLo || undefined}><Input value={f.nameLo} onChange={(e) => setF({ ...f, nameLo: e.target.value })} /></Field>
      <Field label={t("ຊື່ພາສາອັງກິດ", "Name in English")} required error={tried && errs.nameEn || undefined}><Input value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} /></Field>
    </div>
    <div className="mt-3"><Checkbox label={t("ເປີດໃຊ້ສະກຸນເງິນນີ້", "This currency is active")} checked={f.active} disabled={f.code === "LAK"} onChange={(v) => setF({ ...f, active: v })} /></div>
  </Dialog>;
}
