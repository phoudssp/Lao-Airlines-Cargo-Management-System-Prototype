import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Mail, Pencil, Plus, Printer, Stamp, Trash2, Wallet } from "lucide-react";
import { me, nowIso, useCan, useDb } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Col, Confirm, DataTable, Dialog, Empty, Field, IconButton, Input, PageHeader, Panel, PrintSheet, Select, StatRow, Tabs, toast, type Tone } from "@/ui/kit";
import { Barcode, flightLabel, Route, userName } from "@/ui/cargo";
import type { Db, MailBag, MailStatus, Scope } from "@/lib/types";
import { dateAdd, fmtDate, fmtDateTime, kg, money, num, todayIso } from "@/lib/format";
import { isEffective, scopeOf } from "@/lib/pricing";
import { advanceMail, deleteMail, issueMailPass, newMailId, saveMail } from "@/lib/mock/ops";

const FLOW: MailStatus[] = ["received", "manifested", "dispatched", "arrived", "delivered"];
const STATUS: Record<MailStatus, [string, string, Tone]> = { received: ["ຮັບເຂົ້າສາງ", "Received", "info"], manifested: ["ເຂົ້າ Manifest", "Manifested", "info"], dispatched: ["ສົ່ງອອກແລ້ວ", "Dispatched", "warn"], arrived: ["ມາຮອດ", "Arrived", "warn"], delivered: ["ມອບແລ້ວ", "Delivered", "ok"] };
const NEXT_LABEL: Partial<Record<MailStatus, [string, string]>> = { manifested: ["ເຂົ້າ Manifest", "Manifest"], dispatched: ["ສົ່ງອອກ", "Dispatch"], arrived: ["ຮັບມາຮອດ", "Mark arrived"], delivered: ["ມອບໃຫ້ໄປສະນີ", "Deliver to post"] };
const CATEGORIES: { value: MailBag["category"]; lo: string; en: string }[] = [{ value: "LC", lo: "LC ຈົດໝາຍ", en: "LC letters" }, { value: "CP", lo: "CP ພັດສະດຸ", en: "CP parcels" }, { value: "EMS", lo: "EMS ດ່ວນພິເສດ", en: "EMS express" }];
const nextOf = (s: MailStatus) => FLOW[FLOW.indexOf(s) + 1] as MailStatus | undefined;

/** The mail tariff in force for this scope, applied per kg with its minimum. */
function mailFee(d: Db, scope: Scope, weightKg: number) { const tariff = d.tariffs.find((x) => x.category === "mail" && x.scope === scope && isEffective(x, todayIso())); return { tariff, fee: tariff ? Math.max(tariff.rate * weightKg, tariff.minCharge) : 0, currency: tariff?.currency ?? "LAK" }; }

export default function MailBags() {
  const d = useDb(); const t = useT(); const can = useCan(); const st = d.session.station; const canOp = can("mail.manage");
  const [tab, setTab] = useState<"outbound" | "inbound">("outbound"); const [scope, setScope] = useState(""); const [status, setStatus] = useState(""); const [editing, setEditing] = useState<MailBag | "new" | null>(null); const [del, setDel] = useState<MailBag | null>(null); const [printId, setPrintId] = useState<string | null>(null);
  const outbound = useMemo(() => d.mail.filter((m) => m.direction === "outbound" && m.origin === st), [d.mail, st]);
  const inbound = useMemo(() => d.mail.filter((m) => m.dest === st && (m.direction === "inbound" || ["dispatched", "arrived", "delivered"].includes(m.status))), [d.mail, st]);
  const rows = (tab === "outbound" ? outbound : inbound).filter((m) => (!scope || m.scope === scope) && (!status || m.status === status));
  const inStore = [...outbound, ...inbound].filter((m) => (m.status === "received" && m.origin === st) || (m.status === "arrived" && m.dest === st));
  const unpaid = [...new Set([...outbound, ...inbound])].filter((m) => !m.paid);
  function advance(m: MailBag) {
    const next = nextOf(m.status); if (!next) return;
    if (next === "manifested" && !m.flightId) { toast(t(`ກໍານົດຖ້ຽວບິນໃຫ້ ${m.no} ກ່ອນເຂົ້າ Manifest`, `Assign a flight to ${m.no} before manifesting`), "warn"); setEditing(m); return; }
    if (!m.paid && (next === "dispatched" || next === "delivered")) { toast(t(`ຄ່າຖົງເມ ${m.no} ຍັງບໍ່ຊໍາລະ. ໃຫ້ແຄັດເຊຍຮັບເງິນກ່ອນ.`, `The fee for ${m.no} is unpaid. Take payment at the cashier first.`), "bad"); return; }
    advanceMail(m.id, next); toast(t(`${m.no}: ${STATUS[next][0]}`, `${m.no}: ${STATUS[next][1]}`));
  }
  const receiptFor = (m: MailBag) => d.receipts.find((r) => r.mailIds.includes(m.id) && r.status !== "voided");
  const cols: Col<MailBag>[] = [
    { key: "no", header: t("ເລກຖົງເມ", "Dispatch no."), render: (m) => <span className="font-mono text-[13px] font-semibold whitespace-nowrap">{m.no}</span>, sort: (m) => m.no },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (m) => <Route from={m.origin} to={m.dest} />, sort: (m) => m.dest },
    { key: "scope", header: t("ປະເພດ", "Scope"), render: (m) => m.scope === "international" ? t("ຕ່າງປະເທດ", "International") : t("ພາຍໃນ", "Domestic") },
    { key: "cat", header: t("ໝວດ", "Class"), render: (m) => <span className="font-mono text-[13px]">{m.category}</span> },
    { key: "flight", header: t("ຖ້ຽວບິນ", "Flight"), render: (m) => <span className="font-mono text-[13px] whitespace-nowrap">{flightLabel(d, m.flightId)}</span> },
    { key: "bags", header: t("ຖົງ", "Bags"), align: "right", render: (m) => m.bags, sort: (m) => m.bags },
    { key: "kg", header: t("ນໍ້າໜັກ", "Weight"), align: "right", render: (m) => kg(m.weightKg), sort: (m) => m.weightKg },
    { key: "fee", header: t("ຄ່າຖົງເມ", "Fee"), align: "right", render: (m) => <span className="whitespace-nowrap">{money(m.fee, m.currency)}</span>, sort: (m) => m.fee },
    { key: "pay", header: t("ການຊໍາລະ", "Payment"), render: (m) => m.paid ? <Badge tone="ok">{t("ຈ່າຍແລ້ວ", "Paid")}</Badge> : <Link to="/finance/cashier" className="inline-flex items-center gap-1 text-xs font-medium text-warn hover:underline"><Wallet size={13} aria-hidden />{t("ຍັງບໍ່ຈ່າຍ · ໄປແຄັດເຊຍ", "Unpaid · Go to cashier")}</Link> },
    { key: "status", header: t("ສະຖານະ", "Status"), render: (m) => <Badge tone={STATUS[m.status][2]}>{t(STATUS[m.status][0], STATUS[m.status][1])}</Badge>, sort: (m) => FLOW.indexOf(m.status) },
    { key: "pass", header: t("ໃບຜ່ານສາງ", "Pass"), render: (m) => <span className="font-mono text-[13px] whitespace-nowrap">{m.passNo ?? "—"}</span> },
    { key: "act", header: "", align: "right", render: (m) => { const next = nextOf(m.status); const locked = ["dispatched", "arrived", "delivered"].includes(m.status); const paidFor = !!receiptFor(m); return <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
      {canOp && next && <Button size="sm" icon={ChevronRight} onClick={() => advance(m)}>{t(NEXT_LABEL[next]![0], NEXT_LABEL[next]![1])}</Button>}
      <IconButton icon={m.passNo ? Printer : Stamp} label={m.passNo ? t("ພິມໃບຜ່ານສາງ", "Print warehouse pass") : t("ອອກໃບຜ່ານສາງ", "Issue warehouse pass")} disabled={!m.passNo && !canOp} onClick={() => { if (!m.passNo) { issueMailPass(m.id); toast(t("ອອກໃບຜ່ານສາງແລ້ວ", "Warehouse pass issued")); } setPrintId(m.id); }} />
      {canOp && <IconButton icon={Pencil} label={locked ? t("ຖົງເມສົ່ງອອກແລ້ວ ແກ້ໄຂບໍ່ໄດ້", "Dispatched bags cannot be edited") : t("ແກ້ໄຂ", "Edit")} disabled={locked && m.direction === "outbound"} onClick={() => setEditing(m)} />}
      {canOp && <IconButton icon={Trash2} label={paidFor ? t("ມີໃບຮັບເງິນແລ້ວ ລຶບບໍ່ໄດ້", "A receipt exists, so this cannot be deleted") : t("ລຶບ", "Delete")} disabled={paidFor || m.status === "delivered"} onClick={() => setDel(m)} />}
    </span>; } },
  ];
  const printing = d.mail.find((m) => m.id === printId);
  return <>
    <PageHeader title={t("ຖົງເມ", "Mail bags")} subtitle={t(`ຖົງເມພາຍໃນ ແລະ ຕ່າງປະເທດ ຢູ່ສະຖານີ ${st}, ຄິດຄ່າຕາມອັດຕາຖົງເມທີ່ອະນຸມັດແລ້ວ`, `Domestic and international mail at ${st}, charged from the approved mail tariff`)} actions={canOp ? <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>{t("ຮັບຖົງເມໃໝ່", "Receive mail bags")}</Button> : undefined} />
    <StatRow items={[
      { label: t("ຖົງເມໃນສາງ", "Bags in the warehouse"), value: inStore.reduce((s, m) => s + m.bags, 0), sub: kg(inStore.reduce((s, m) => s + m.weightKg, 0)) },
      { label: t("ລໍຖ້າສົ່ງອອກ", "Waiting for dispatch"), value: outbound.filter((m) => m.status === "received" || m.status === "manifested").length },
      { label: t("ລໍຖ້າມອບໃຫ້ໄປສະນີ", "Waiting for delivery to post"), value: inbound.filter((m) => m.status === "arrived").length },
      { label: t("ຄ່າຖົງເມຍັງບໍ່ຊໍາລະ", "Fees unpaid"), value: unpaid.length, sub: money(unpaid.reduce((s, m) => s + m.fee, 0)), tone: unpaid.length ? "warn" : undefined, to: "/finance/cashier" },
    ]} />
    {!canOp && <div className="mb-4"><Callout tone="warn" title={t("ເບິ່ງໄດ້ຢ່າງດຽວ", "View only")}>{t("ບົດບາດຂອງທ່ານບໍ່ມີສິດຈັດການຖົງເມ.", "Your role cannot manage mail bags.")}</Callout></div>}
    <Tabs value={tab} onChange={(k) => { setTab(k); setStatus(""); }} tabs={[{ key: "outbound", label: t("ຂາອອກ", "Outbound"), count: outbound.length }, { key: "inbound", label: t("ຂາເຂົ້າ", "Inbound"), count: inbound.length }]} />
    <Panel flush><DataTable rows={rows} columns={cols} rowKey={(m) => m.id} minWidth={1120} defaultSort={{ key: "status", dir: "asc" }} search={(m) => `${m.no} ${m.origin} ${m.dest} ${m.passNo ?? ""} ${m.postOffice}`}
      filters={<>
        <Select aria-label={t("ປະເພດ", "Scope")} className="w-auto" value={scope} onChange={(e) => setScope(e.target.value)} placeholder={t("ພາຍໃນ ແລະ ຕ່າງປະເທດ", "Domestic and international")} options={[{ value: "domestic", label: t("ພາຍໃນ", "Domestic") }, { value: "international", label: t("ຕ່າງປະເທດ", "International") }]} />
        <Select aria-label={t("ສະຖານະ", "Status")} className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t("ທຸກສະຖານະ", "All statuses")} options={FLOW.map((s) => ({ value: s, label: t(STATUS[s][0], STATUS[s][1]) }))} />
      </>}
      empty={<Empty icon={Mail} title={t("ບໍ່ມີຖົງເມໃນລາຍການນີ້", "No mail bags in this list")} action={canOp ? <Button icon={Plus} onClick={() => setEditing("new")}>{t("ຮັບຖົງເມໃໝ່", "Receive mail bags")}</Button> : undefined}>{t("ປ່ຽນຕົວກອງ ຫຼື ບັນທຶກຖົງເມທີ່ໄປສະນີນໍາສົ່ງ.", "Change the filters or record bags from the post office.")}</Empty>} /></Panel>
    {editing && <MailDialog bag={editing === "new" ? undefined : editing} direction={tab} onClose={() => setEditing(null)} />}
    <Confirm open={!!del} onClose={() => setDel(null)} danger title={t(`ລຶບ ${del?.no}?`, `Delete ${del?.no}?`)} body={t("ລຶບຖົງເມລາຍການນີ້ ແລະ ຄ່າທີ່ຍັງຄ້າງຢູ່ແຄັດເຊຍ.", "This removes the bag record and any fee still waiting at the cashier.")} confirmLabel={t("ລຶບຖົງເມ", "Delete bag record")} onConfirm={() => { if (del) { deleteMail(del.id); toast(t("ລຶບຖົງເມແລ້ວ", "Bag record deleted")); } }} />
    <PrintSheet open={!!printing} onClose={() => setPrintId(null)} title={t("ໃບຜ່ານສາງຖົງເມ", "Mail warehouse pass")}>{printing && <Pass m={printing} />}</PrintSheet>
  </>;
}

function MailDialog({ bag, direction, onClose }: { bag?: MailBag; direction: "outbound" | "inbound"; onClose: () => void }) {
  const d = useDb(); const t = useT(); const st = d.session.station; const dir = bag?.direction ?? direction;
  const [origin, setOrigin] = useState(bag?.origin ?? (dir === "outbound" ? st : "")); const [dest, setDest] = useState(bag?.dest ?? (dir === "inbound" ? st : "")); const [flightId, setFlightId] = useState(bag?.flightId ?? ""); const [bags, setBags] = useState(String(bag?.bags ?? 1)); const [weight, setWeight] = useState(String(bag?.weightKg ?? "")); const [category, setCategory] = useState<MailBag["category"]>(bag?.category ?? "LC"); const [postOffice, setPostOffice] = useState(bag?.postOffice ?? "ໄປສະນີລາວ / Lao Post"); const [tried, setTried] = useState(false);
  const others = d.stations.filter((s) => s.active && s.code !== st).map((s) => ({ value: s.code, label: `${s.code} · ${t(s.nameLo, s.nameEn)}` }));
  const scope: Scope = origin && dest ? scopeOf(d, origin, dest) : "domestic"; const w = Number(weight); const n = Number(bags); const priced = mailFee(d, scope, w > 0 ? w : 0);
  const today = todayIso(); const flights = d.flights.filter((f) => f.origin === origin && f.dest === dest && (dir === "inbound" ? f.date <= today && f.date >= dateAdd(today, -14) : f.date >= today && f.status === "open")).sort((a, b) => dir === "inbound" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)).slice(0, 10);
  const flightOptions = [...flights, ...d.flights.filter((f) => f.id === bag?.flightId && !flights.includes(f))].map((f) => ({ value: f.id, label: `${f.no} · ${fmtDate(f.date)} ${f.std}` }));
  const paid = !!bag?.paid; const errs = { route: !origin || !dest || origin === dest, bags: !Number.isInteger(n) || n < 1, weight: !(w > 0), post: !postOffice.trim(), tariff: !priced.tariff };
  function save() {
    setTried(true); if (Object.values(errs).some(Boolean)) return;
    const id = bag?.id ?? newMailId(); const seq = id.split("-")[1];
    const m: MailBag = { id, no: bag?.no ?? `${origin}${dest}${category}${seq}`, origin, dest, scope, flightId: flightId || undefined, bags: n, weightKg: w, category, direction: dir, status: bag?.status ?? (dir === "inbound" ? "arrived" : "received"), fee: paid ? bag!.fee : priced.fee, currency: paid ? bag!.currency : priced.currency, passNo: bag?.passNo, paid, receivedBy: bag?.receivedBy ?? me(d), receivedAt: bag?.receivedAt ?? nowIso(), postOffice: postOffice.trim() };
    saveMail(m, !bag); toast(bag ? t("ບັນທຶກຖົງເມແລ້ວ", "Mail bag saved") : t(`ບັນທຶກ ${m.no} ແລ້ວ. ຄ່າຖົງເມສົ່ງໄປແຄັດເຊຍແລ້ວ.`, `${m.no} recorded. The fee is now waiting at the cashier.`)); onClose();
  }
  return <Dialog open onClose={onClose} title={bag ? t(`ແກ້ໄຂ ${bag.no}`, `Edit ${bag.no}`) : dir === "outbound" ? t("ຮັບຖົງເມຂາອອກ", "Receive outbound mail bags") : t("ຮັບຖົງເມຂາເຂົ້າ", "Receive inbound mail bags")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{t("ບັນທຶກຖົງເມ", "Save mail bags")}</Button></>}>
    <div className="grid gap-3 sm:grid-cols-2">
      {dir === "outbound" ? <><Field label={t("ຕົ້ນທາງ", "Origin")}><Input className="font-mono" value={origin} disabled /></Field><Field label={t("ປາຍທາງ", "Destination")} required error={tried && errs.route ? t("ເລືອກປາຍທາງ.", "Choose the destination.") : undefined}><Select value={dest} onChange={(e) => { setDest(e.target.value); setFlightId(""); }} placeholder={t("ເລືອກປາຍທາງ", "Choose a destination")} options={others} /></Field></> : <><Field label={t("ຕົ້ນທາງ", "Origin")} required error={tried && errs.route ? t("ເລືອກຕົ້ນທາງ.", "Choose the origin.") : undefined}><Select value={origin} onChange={(e) => { setOrigin(e.target.value); setFlightId(""); }} placeholder={t("ເລືອກຕົ້ນທາງ", "Choose an origin")} options={others} /></Field><Field label={t("ປາຍທາງ", "Destination")}><Input className="font-mono" value={dest} disabled /></Field></>}
      <Field label={t("ຖ້ຽວບິນ", "Flight")} hint={dir === "outbound" ? t("ກໍານົດໄດ້ພາຍຫຼັງ. ຕ້ອງມີກ່ອນເຂົ້າ Manifest.", "Can be set later. Required before manifesting.") : undefined}><Select value={flightId} onChange={(e) => setFlightId(e.target.value)} placeholder={origin && dest ? t("ກໍານົດພາຍຫຼັງ", "Assign later") : t("ເລືອກເສັ້ນທາງກ່ອນ", "Choose the route first")} options={flightOptions} /></Field>
      <Field label={t("ໝວດ", "Mail class")}><Select value={category} disabled={!!bag} onChange={(e) => setCategory(e.target.value as MailBag["category"])} options={CATEGORIES.map((c) => ({ value: c.value, label: t(c.lo, c.en) }))} /></Field>
      <Field label={t("ຈໍານວນຖົງ", "Number of bags")} required error={tried && errs.bags ? t("ໃສ່ຈໍານວນຖົງ ຢ່າງໜ້ອຍ 1.", "Enter at least 1 bag.") : undefined}><Input type="number" min={1} value={bags} onChange={(e) => setBags(e.target.value)} /></Field>
      <Field label={t("ນໍ້າໜັກລວມ (kg)", "Total weight (kg)")} required hint={paid ? t("ຊໍາລະແລ້ວ ແກ້ນໍ້າໜັກບໍ່ໄດ້.", "Paid, so the weight is locked.") : undefined} error={tried && errs.weight ? t("ໃສ່ນໍ້າໜັກທີ່ຫຼາຍກວ່າ 0.", "Enter a weight above 0.") : undefined}><Input type="number" min={0} step="0.5" disabled={paid} value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
      <Field label={t("ໄປສະນີ", "Post office")} required className="sm:col-span-2" error={tried && errs.post ? t("ໃສ່ຊື່ໄປສະນີ.", "Enter the post office.") : undefined}><Input value={postOffice} onChange={(e) => setPostOffice(e.target.value)} /></Field>
      <div className="sm:col-span-2 rounded border border-line bg-surface-2 px-3 py-2">
        {priced.tariff ? <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm text-ink-2">{t(priced.tariff.nameLo, priced.tariff.nameEn)}: {money(priced.tariff.rate, priced.tariff.currency)}/kg · {t("ຂັ້ນຕໍ່າ", "minimum")} {money(priced.tariff.minCharge, priced.tariff.currency)}</span><span className="tnum text-lg font-semibold">{money(paid ? bag!.fee : priced.fee, paid ? bag!.currency : priced.currency)}</span></div> : <span className="text-sm text-bad">{t("ບໍ່ມີອັດຕາຖົງເມທີ່ມີຜົນບັງຄັບໃຊ້. ກະລຸນາໃຫ້ອະນຸມັດອັດຕາໃນໜ້າ ອັດຕາຄ່າບໍລິການ.", "No mail tariff is in force. Have one approved under Tariffs & pricing.")}</span>}
      </div>
    </div>
  </Dialog>;
}

function Pass({ m }: { m: MailBag }) {
  const d = useDb(); const lang = useLang(); const f = d.flights.find((x) => x.id === m.flightId);
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <tr><th className="w-[42%] border border-black p-1.5 text-left text-[11px] font-normal">{label}</th><td className="border border-black p-1.5 text-[13px]">{children}</td></tr>;
  return <div className="text-black" style={{ fontFamily: "Noto Sans, Noto Sans Lao, sans-serif" }}>
    <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-2"><div><div className="text-sm font-semibold">LAO AIRLINES CARGO · ການບິນລາວ ພະແນກຂົນສົ່ງສິນຄ້າ</div><div className="text-xl font-semibold">ໃບຜ່ານສາງຖົງເມ / Mail warehouse pass</div></div><div className="text-right text-[12px]"><div>No.</div><div className="font-mono text-lg font-semibold">{m.passNo}</div></div></div>
    <div className="my-3"><Barcode value={m.no} height={44} /></div>
    <table className="w-full border-collapse"><tbody>
      <Row label="ເລກຖົງເມ / Dispatch no."><span className="font-mono">{m.no}</span></Row>
      <Row label="ເສັ້ນທາງ / Route"><span className="font-mono">{m.origin} → {m.dest}</span> ({m.scope === "international" ? "ຕ່າງປະເທດ / International" : "ພາຍໃນ / Domestic"})</Row>
      <Row label="ຖ້ຽວບິນ / Flight">{f ? `${f.no} · ${fmtDate(f.date)} ${f.std}` : "—"}</Row>
      <Row label="ໝວດ / Mail class">{m.category}</Row>
      <Row label="ຈໍານວນຖົງ / Bags">{m.bags}</Row>
      <Row label="ນໍ້າໜັກລວມ / Total weight">{num(m.weightKg, m.weightKg % 1 ? 1 : 0)} kg</Row>
      <Row label="ຄ່າຖົງເມ / Fee">{money(m.fee, m.currency)} · {m.paid ? "ຈ່າຍແລ້ວ / Paid" : "ຍັງບໍ່ຈ່າຍ / Unpaid"}</Row>
      <Row label="ໄປສະນີ / Post office">{m.postOffice}</Row>
      <Row label="ຮັບເຂົ້າສາງ / Received">{fmtDateTime(m.receivedAt)} · {userName(d, m.receivedBy, lang)}</Row>
    </tbody></table>
    <div className="mt-10 grid grid-cols-2 gap-10 text-[12px]">{["ຜູ້ມອບ (ໄປສະນີ) / Handed over by (post office)", "ຜູ້ຮັບ (ພະນັກງານສາງ) / Received by (warehouse)"].map((x) => <div key={x}><div className="h-14 border-b border-black" /><div className="mt-1">{x}</div><div className="mt-3">ຊື່ / Name: ______________________</div><div className="mt-2">ວັນທີ / Date: ______________________</div></div>)}</div>
  </div>;
}
