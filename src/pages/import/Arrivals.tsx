import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckSquare, Eye, MessageCircle, PhoneCall, PlaneLanding, Send, Trash2 } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Checkbox, Col, Confirm, DataTable, Dialog, Empty, IconButton, PageHeader, Panel, Select, StatRow, Tabs, toast, type Tone } from "@/ui/kit";
import { AwbLink, AwbStrip, customerName, Route, ShcTags, userName } from "@/ui/cargo";
import type { Awb, NotificationLog, NotifyStatus } from "@/lib/types";
import { fmtDateTime, todayIso } from "@/lib/format";
import { deleteNotification, hasReceipt, markNoteDone, notifyArrival } from "@/lib/mock/ops";

const SENT: Partial<Record<NotifyStatus, [string, string, Tone]>> = { sent: ["ສົ່ງແລ້ວ", "Sent", "info"], delivered: ["ຮອດແລ້ວ", "Delivered", "ok"], read: ["ອ່ານແລ້ວ", "Read", "ok"], failed: ["ສົ່ງບໍ່ສໍາເລັດ", "Failed", "bad"] };
const KIND: Record<NotificationLog["templateKey"], [string, string]> = { arrival: ["ແຈ້ງສິນຄ້າມາຮອດ", "Arrival notice"], aging: ["ເຕືອນສິນຄ້າຄ້າງສາງ", "Aging reminder"], offload: ["ແຈ້ງອ໋ອບໂຫຼດ", "Offload notice"], booking: ["ແຈ້ງການຈອງ", "Booking result"] };
const checkbox = "h-4 w-4 accent-[var(--brand)]";

export default function Arrivals() {
  const d = useDb(); const t = useT(); const can = useCan(); const lang = useLang(); const st = d.session.station; const canOp = can("import.operate");
  const comm = (a: Awb) => a.commodity.split(" / ")[t("0", "1") === "0" ? 0 : 1] ?? a.commodity;
  const [tab, setTab] = useState<"notify" | "log" | "call">("notify"); const [which, setWhich] = useState<"todo" | "again">("todo"); const [sel, setSel] = useState<Set<string>>(new Set()); const [preview, setPreview] = useState<string[] | null>(null); const [logView, setLogView] = useState<NotificationLog | null>(null); const [del, setDel] = useState<NotificationLog | null>(null); const [status, setStatus] = useState(""); const [showCalled, setShowCalled] = useState(false);
  const arrivals = useMemo(() => d.awbs.filter((a) => a.direction === "import" && a.status === "active" && a.dest === st && ["ARR", "RCF", "NFD"].includes(a.stage)), [d.awbs, st]);
  const toNotify = arrivals.filter((a) => a.stage !== "NFD"); const rows = which === "todo" ? toNotify : arrivals.filter((a) => a.stage === "NFD");
  const here = useMemo(() => d.notifications.filter((n) => { const a = d.awbs.find((x) => x.id === n.awbId); return a && (a.dest === st || a.station === st); }), [d.notifications, d.awbs, st]);
  const log = here.filter((n) => n.channel === "whatsapp" && (!status || n.status === status)); const allLog = here.filter((n) => n.channel === "whatsapp");
  const allCalls = here.filter((n) => n.channel === "staff_note"); const openCalls = allCalls.filter((n) => n.status === "staff_note"); const calls = showCalled ? allCalls : openCalls;
  const cust = (a: Awb) => d.customers.find((c) => c.id === a.consigneeId);
  const lastNotice = (a: Awb) => d.notifications.filter((n) => n.awbId === a.id).sort((x, y) => y.ts.localeCompare(x.ts))[0];
  const toggle = (id: string, on: boolean) => setSel((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const selected = [...sel].filter((id) => rows.some((a) => a.id === id));
  const cols: Col<Awb>[] = [
    { key: "sel", header: "", width: "36px", render: (a) => <input type="checkbox" className={checkbox} aria-label={t(`ເລືອກ ${a.no}`, `Select ${a.no}`)} checked={sel.has(a.id)} disabled={!canOp} onChange={(e) => toggle(a.id, e.target.checked)} /> },
    { key: "no", header: t("ເລກ AWB", "AWB number"), render: (a) => <AwbLink awb={a} />, sort: (a) => a.no },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (a) => <Route from={a.origin} to={a.dest} /> },
    { key: "arr", header: t("ມາຮອດ", "Arrived"), render: (a) => <span className="tnum whitespace-nowrap">{fmtDateTime(a.arrivedAt)}</span>, sort: (a) => a.arrivedAt ?? "" },
    { key: "co", header: t("ຜູ້ຮັບ", "Consignee"), render: (a) => <span className="line-clamp-1">{customerName(d, a.consigneeId)}</span>, sort: (a) => customerName(d, a.consigneeId) },
    { key: "comm", header: t("ສິນຄ້າ", "Commodity"), render: (a) => <span className="inline-flex items-center gap-1.5"><span className="line-clamp-1">{comm(a)}</span><ShcTags codes={a.shc} /></span> },
    { key: "pcs", header: t("ກ່ອງ", "Pcs"), align: "right", render: (a) => a.pieces },
    { key: "channel", header: t("ຊ່ອງທາງ", "Channel"), render: (a) => { const c = cust(a); return c?.whatsapp ? <Badge tone="ok" noIcon>WhatsApp</Badge> : <Badge tone="warn" noIcon>{t("ໃຫ້ພະນັກງານໂທ", "Staff to call")}</Badge>; } },
    { key: "stage", header: t("ສະຖານະ", "Status"), render: (a) => hasReceipt(a) ? <AwbStrip awb={a} /> : <Link to="/wms/inbound" className="text-xs font-medium text-warn hover:underline">{t("ຍັງບໍ່ຮັບເຂົ້າສາງ", "Not yet received")}</Link> },
    { key: "last", header: t("ແຈ້ງຫຼ້າສຸດ", "Last notice"), render: (a) => { const n = lastNotice(a); return n ? <span className="tnum whitespace-nowrap text-xs text-ink-2">{fmtDateTime(n.ts)}</span> : <span className="text-xs text-ink-3">{t("ຍັງບໍ່ແຈ້ງ", "None yet")}</span>; } },
    { key: "act", header: "", align: "right", render: (a) => <Button size="sm" icon={Bell} disabled={!canOp} onClick={() => setPreview([a.id])}>{a.stage === "NFD" ? t("ແຈ້ງອີກຄັ້ງ", "Notify again") : t("ແຈ້ງລູກຄ້າ", "Notify")}</Button> },
  ];
  const logCols: Col<NotificationLog>[] = [
    { key: "ts", header: t("ເວລາ", "Time"), render: (n) => <span className="tnum whitespace-nowrap">{fmtDateTime(n.ts)}</span>, sort: (n) => n.ts },
    { key: "awb", header: "AWB", render: (n) => { const a = d.awbs.find((x) => x.id === n.awbId); return a ? <AwbLink awb={a} /> : "—"; } },
    { key: "c", header: t("ລູກຄ້າ", "Customer"), render: (n) => <span className="line-clamp-1">{customerName(d, n.customerId)}</span> },
    { key: "to", header: "WhatsApp", render: (n) => <span className="tnum whitespace-nowrap">{n.to}</span> },
    { key: "kind", header: t("ປະເພດ", "Type"), render: (n) => t(KIND[n.templateKey][0], KIND[n.templateKey][1]) },
    { key: "by", header: t("ຜູ້ສົ່ງ", "Sent by"), render: (n) => <span className="whitespace-nowrap">{userName(d, n.by, lang)}</span> },
    { key: "st", header: t("ສະຖານະ", "Status"), render: (n) => { const s = SENT[n.status]; return s ? <Badge tone={s[2]}>{t(s[0], s[1])}</Badge> : n.status; }, sort: (n) => n.status },
    { key: "act", header: "", align: "right", render: (n) => <span className="inline-flex"><IconButton icon={Eye} label={t("ເບິ່ງຂໍ້ຄວາມ", "View message")} onClick={() => setLogView(n)} /><IconButton icon={Trash2} label={t("ລຶບລາຍການ", "Delete entry")} disabled={!canOp} onClick={() => setDel(n)} /></span> },
  ];
  const callCols: Col<NotificationLog>[] = [
    { key: "ts", header: t("ເວລາ", "Time"), render: (n) => <span className="tnum whitespace-nowrap">{fmtDateTime(n.ts)}</span>, sort: (n) => n.ts },
    { key: "c", header: t("ລູກຄ້າ", "Customer"), render: (n) => { const c = d.customers.find((x) => x.id === n.customerId); return <span className="block min-w-[160px]"><span className="block">{c?.name ?? "—"}</span><span className="text-xs text-ink-2">{c?.contact}</span></span>; } },
    { key: "phone", header: t("ເບີໂທ", "Phone"), render: (n) => { const c = d.customers.find((x) => x.id === n.customerId); return <a className="tnum whitespace-nowrap font-medium text-brand hover:underline" href={`tel:${c?.phone.replace(/\s/g, "")}`}>{c?.phone}</a>; } },
    { key: "awb", header: "AWB", render: (n) => { const a = d.awbs.find((x) => x.id === n.awbId); return a ? <AwbLink awb={a} /> : "—"; } },
    { key: "kind", header: t("ເລື່ອງ", "About"), render: (n) => <span className="whitespace-nowrap">{t(KIND[n.templateKey][0], KIND[n.templateKey][1])}</span> },
    { key: "note", header: t("ໝາຍເຫດ", "Note"), render: (n) => <span className="block min-w-[240px] text-xs text-ink-2">{n.body}</span> },
    { key: "st", header: t("ສະຖານະ", "Status"), render: (n) => n.status === "done" ? <Badge tone="ok">{t("ໂທແລ້ວ", "Called")}</Badge> : <Badge tone="warn">{t("ລໍຖ້າໂທ", "To call")}</Badge> },
    { key: "act", header: "", align: "right", render: (n) => <span className="inline-flex items-center gap-1 whitespace-nowrap">{n.status !== "done" && <Button size="sm" variant="primary" icon={PhoneCall} disabled={!canOp} onClick={() => { markNoteDone(n.id); toast(t("ບັນທຶກວ່າໂທແລ້ວ", "Marked as called")); }}>{t("ໂທແລ້ວ", "Mark as called")}</Button>}<IconButton icon={Trash2} label={t("ລຶບລາຍການ", "Delete entry")} disabled={!canOp} onClick={() => setDel(n)} /></span> },
  ];
  return <>
    <PageHeader title={t("ສິນຄ້າມາຮອດ ແລະ ແຈ້ງເຕືອນ", "Arrivals and notices")} subtitle={t(`ແຈ້ງຜູ້ຮັບສິນຄ້າທີ່ສະຖານີ ${st} ທາງ WhatsApp. ລູກຄ້າທີ່ບໍ່ມີ WhatsApp ຈະເຂົ້າລາຍການໃຫ້ພະນັກງານໂທ.`, `Tell consignees at ${st} by WhatsApp. Customers without WhatsApp go on a list for staff to call.`)} />
    <StatRow items={[
      { label: t("ມາຮອດມື້ນີ້", "Arrived today"), value: arrivals.filter((a) => a.arrivedAt?.slice(0, 10) === todayIso()).length },
      { label: t("ລໍຖ້າແຈ້ງ", "To notify"), value: toNotify.length, tone: toNotify.length ? "warn" : "ok" },
      { label: t("WhatsApp ທີ່ສົ່ງ", "WhatsApp sent"), value: allLog.length, sub: t(`ອ່ານແລ້ວ ${allLog.filter((n) => n.status === "read").length}`, `${allLog.filter((n) => n.status === "read").length} read`) },
      { label: t("ຕ້ອງໂທແຈ້ງ", "Staff to call"), value: openCalls.length, tone: openCalls.length ? "warn" : "ok" },
    ]} />
    {!canOp && <div className="mb-4"><Callout tone="warn" title={t("ເບິ່ງໄດ້ຢ່າງດຽວ", "View only")}>{t("ບົດບາດຂອງທ່ານບໍ່ມີສິດສົ່ງແຈ້ງເຕືອນ.", "Your role cannot send notices.")}</Callout></div>}
    <Tabs value={tab} onChange={setTab} tabs={[{ key: "notify", label: t("ລໍຖ້າແຈ້ງ", "To notify"), count: toNotify.length }, { key: "log", label: t("ປະຫວັດການສົ່ງ", "Sent log"), count: allLog.length }, { key: "call", label: t("ໃຫ້ພະນັກງານໂທ", "Staff to call"), count: openCalls.length }]} />
    {tab === "notify" && <Panel flush><DataTable rows={rows} columns={cols} rowKey={(a) => a.id} minWidth={1120} defaultSort={{ key: "arr", dir: "desc" }} search={(a) => `${a.prefix}${a.serial} ${customerName(d, a.consigneeId)} ${a.commodity} ${a.origin}`}
      filters={<Select aria-label={t("ສະຖານະການແຈ້ງ", "Notice status")} className="w-auto" value={which} onChange={(e) => { setWhich(e.target.value as "todo" | "again"); setSel(new Set()); }} options={[{ value: "todo", label: t("ຍັງບໍ່ແຈ້ງ (ARR, RCF)", "Not yet notified (ARR, RCF)") }, { value: "again", label: t("ແຈ້ງແລ້ວ (NFD)", "Already notified (NFD)") }]} />}
      toolbar={canOp && rows.length > 0 ? <><Button size="sm" icon={CheckSquare} onClick={() => setSel(selected.length === rows.length ? new Set() : new Set(rows.map((a) => a.id)))}>{selected.length === rows.length ? t("ຍົກເລີກການເລືອກ", "Clear selection") : t(`ເລືອກທັງໝົດ ${rows.length}`, `Select all ${rows.length}`)}</Button><Button size="sm" variant="primary" icon={Send} disabled={selected.length === 0} onClick={() => setPreview(selected)}>{t(`ແຈ້ງທີ່ເລືອກ (${selected.length})`, `Notify selected (${selected.length})`)}</Button></> : undefined}
      empty={<Empty icon={PlaneLanding} title={which === "todo" ? t("ແຈ້ງຄົບທຸກ AWB ແລ້ວ", "Every arrival has been notified") : t("ຍັງບໍ່ມີ AWB ທີ່ແຈ້ງແລ້ວ", "No notified AWBs yet")}>{t("AWB ໃໝ່ຈະປາກົດຢູ່ນີ້ ເມື່ອຖ້ຽວບິນຂາເຂົ້າມາຮອດ.", "New AWBs appear here when an inbound flight arrives.")}</Empty>} /></Panel>}
    {tab === "log" && <Panel flush><DataTable rows={log} columns={logCols} rowKey={(n) => n.id} minWidth={1020} defaultSort={{ key: "ts", dir: "desc" }} search={(n) => { const a = d.awbs.find((x) => x.id === n.awbId); return `${a ? a.prefix + a.serial : ""} ${customerName(d, n.customerId)} ${n.to ?? ""}`; }}
      filters={<Select aria-label={t("ສະຖານະ", "Status")} className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t("ທຸກສະຖານະ", "All statuses")} options={(["sent", "delivered", "read", "failed"] as const).map((k) => ({ value: k, label: t(SENT[k]![0], SENT[k]![1]) }))} />}
      empty={<Empty icon={MessageCircle} title={t("ບໍ່ມີຂໍ້ຄວາມໃນລາຍການນີ້", "No messages in this list")}>{t("ຂໍ້ຄວາມຈະປາກົດຢູ່ນີ້ ຫຼັງຈາກສົ່ງແຈ້ງເຕືອນ.", "Messages appear here after a notice goes out.")}</Empty>} /></Panel>}
    {tab === "call" && <><div className="mb-3"><Callout tone="info">{t("ລູກຄ້າເຫຼົ່ານີ້ບໍ່ມີ WhatsApp. ໂທຫາລູກຄ້າ ແລ້ວກົດ ໂທແລ້ວ ເພື່ອປິດວຽກ.", "These customers have no WhatsApp. Phone them, then choose Mark as called to clear the task.")}</Callout></div><Panel flush><DataTable rows={calls} columns={callCols} rowKey={(n) => n.id} minWidth={1120} defaultSort={{ key: "ts", dir: "desc" }} search={(n) => `${customerName(d, n.customerId)} ${d.customers.find((c) => c.id === n.customerId)?.phone ?? ""}`}
      toolbar={<Checkbox label={t("ສະແດງທີ່ໂທແລ້ວ", "Show called")} checked={showCalled} onChange={setShowCalled} />}
      empty={<Empty icon={PhoneCall} title={t("ບໍ່ມີລູກຄ້າທີ່ຕ້ອງໂທ", "No customers to call")}>{t("ເມື່ອແຈ້ງລູກຄ້າທີ່ບໍ່ມີ WhatsApp ວຽກຈະມາຢູ່ນີ້.", "Notifying a customer without WhatsApp adds a task here.")}</Empty>} /></Panel></>}
    {preview && <PreviewDialog ids={preview} onClose={() => setPreview(null)} onSent={(wa, call) => { setSel(new Set()); setPreview(null); toast(t(`ສົ່ງ WhatsApp ${wa} ລາຍການ, ໃຫ້ພະນັກງານໂທ ${call} ລາຍການ`, `${wa} sent by WhatsApp, ${call} added for staff to call`)); if (call && !wa) setTab("call"); }} />}
    {logView && <Dialog open size="sm" onClose={() => setLogView(null)} title={t(KIND[logView.templateKey][0], KIND[logView.templateKey][1])} footer={<Button onClick={() => setLogView(null)}>{t("ປິດ", "Close")}</Button>}><div className="mb-2 text-xs text-ink-2">{customerName(d, logView.customerId)} · <span className="tnum">{logView.to}</span> · <span className="tnum">{fmtDateTime(logView.ts)}</span></div><Bubble body={logView.body} /></Dialog>}
    <Confirm open={!!del} onClose={() => setDel(null)} danger title={t("ລຶບລາຍການນີ້?", "Delete this entry?")} body={t("ລຶບອອກຈາກປະຫວັດການແຈ້ງເຕືອນ. ບໍ່ກະທົບສະຖານະຂອງ AWB.", "This removes it from the notice history. The AWB status does not change.")} confirmLabel={t("ລຶບລາຍການ", "Delete entry")} onConfirm={() => { if (del) { deleteNotification(del.id); toast(t("ລຶບລາຍການແລ້ວ", "Entry deleted")); } }} />
  </>;
}

const Bubble = ({ body }: { body: string }) => <div className="rounded-lg bg-ok-soft px-3 py-2 text-sm leading-6 text-ink">{body}</div>;

function PreviewDialog({ ids, onClose, onSent }: { ids: string[]; onClose: () => void; onSent: (wa: number, call: number) => void }) {
  const d = useDb(); const t = useT(); const tpl = d.templates.find((x) => x.key === "arrival");
  const list = ids.map((id) => d.awbs.find((a) => a.id === id)!).filter(Boolean);
  const body = (a: Awb, name: string) => (tpl?.bodyLo ?? "").replace(/\{(\w+)\}/g, (_, k: string) => ({ name, awb: a.no, pieces: String(a.pieces), station: a.dest, flight: [...a.events].reverse().find((e) => e.flightNo)?.flightNo ?? "" } as Record<string, string>)[k] ?? "");
  const wa = list.filter((a) => d.customers.find((c) => c.id === a.consigneeId)?.whatsapp); const call = list.length - wa.length;
  return <Dialog open size="md" onClose={onClose} title={t("ກວດຂໍ້ຄວາມກ່ອນສົ່ງ", "Check the message before sending")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" icon={Send} onClick={() => { list.forEach((a) => notifyArrival(a.id)); onSent(wa.length, call); }}>{t(`ສົ່ງແຈ້ງເຕືອນ ${list.length} ລາຍການ`, `Send ${list.length} notice(s)`)}</Button></>}>
    <p className="mb-3 text-sm text-ink-2">{t(`WhatsApp ${wa.length} ລາຍການ · ໃຫ້ພະນັກງານໂທ ${call} ລາຍການ`, `${wa.length} by WhatsApp · ${call} for staff to call`)}</p>
    <ul className="grid gap-3">{list.map((a) => { const c = d.customers.find((x) => x.id === a.consigneeId); return <li key={a.id}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2"><span><span className="font-mono text-[13px] font-semibold text-ink">{a.no}</span> · {c?.name}</span>{c?.whatsapp ? <span className="tnum">WhatsApp {c.whatsapp}</span> : <span className="tnum font-medium text-warn">{t("ບໍ່ມີ WhatsApp · ໂທ", "No WhatsApp · call")} {c?.phone}</span>}</div>
      {c?.whatsapp ? <Bubble body={body(a, c.contact)} /> : <Callout tone="warn">{t("ຈະບໍ່ສົ່ງຂໍ້ຄວາມ. ລະບົບຈະເພີ່ມໃສ່ລາຍການໃຫ້ພະນັກງານໂທແຈ້ງແທນ.", "No message goes out. This customer is added to the list for staff to call.")}</Callout>}
    </li>; })}</ul>
  </Dialog>;
}
