import { useMemo, useState } from "react";
import { FileCheck2, Landmark, PlugZap } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Checkbox, Col, DataTable, Dialog, Dl, Empty, Field, Input, PageHeader, Panel, Select, StatRow, Textarea, toast, type Tone } from "@/ui/kit";
import { AwbLink, customerName, Route, ShcTags, userName } from "@/ui/cargo";
import type { Awb, CustomsRecord } from "@/lib/types";
import { fmtDate, fmtDateTime, kg } from "@/lib/format";
import { scopeOf } from "@/lib/pricing";
import { awbDocs, customsDocList, saveCustoms, setAwbDoc } from "@/lib/mock/ops";

type CS = CustomsRecord["status"];
const STATUS: Record<CS, [string, string, Tone]> = { pending: ["ລໍຖ້າຍື່ນ", "Pending", "neutral"], submitted: ["ຍື່ນແລ້ວ", "Submitted", "info"], cleared: ["ຜ່ານພາສີ", "Cleared", "ok"], hold: ["ຖືກກັກໄວ້", "Hold", "bad"] };
const statusOf = (a: Awb): CS => a.customs?.status ?? "pending";

export default function Customs() {
  const d = useDb(); const t = useT(); const can = useCan(); const lang = useLang(); const st = d.session.station; const canOp = can("customs.manage");
  const comm = (a: Awb) => a.commodity.split(" / ")[t("0", "1") === "0" ? 0 : 1] ?? a.commodity;
  const [status, setStatus] = useState(""); const [editId, setEditId] = useState<string | null>(null); const [check, setCheck] = useState<{ awb?: Awb } | null>(null);
  const all = useMemo(() => d.awbs.filter((a) => a.direction === "import" && a.status === "active" && a.dest === st && a.stage !== "DLV" && scopeOf(d, a.origin, a.dest) === "international"), [d, st]);
  const rows = all.filter((a) => !status || statusOf(a) === status);
  const docsDone = (a: Awb) => { const list = customsDocList(a); const got = awbDocs(a); return { done: list.filter((x) => got.includes(x.key)).length, total: list.length }; };
  const count = (s: CS) => all.filter((a) => statusOf(a) === s).length;
  const cols: Col<Awb>[] = [
    { key: "no", header: t("ເລກ AWB", "AWB number"), render: (a) => <AwbLink awb={a} />, sort: (a) => a.no },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (a) => <Route from={a.origin} to={a.dest} /> },
    { key: "co", header: t("ຜູ້ຮັບ", "Consignee"), render: (a) => <span className="line-clamp-1">{customerName(d, a.consigneeId)}</span>, sort: (a) => customerName(d, a.consigneeId) },
    { key: "comm", header: t("ສິນຄ້າ", "Commodity"), render: (a) => <span className="inline-flex items-center gap-1.5"><span className="line-clamp-1">{comm(a)}</span><ShcTags codes={a.shc} /></span> },
    { key: "arr", header: t("ມາຮອດ", "Arrived"), render: (a) => <span className="tnum whitespace-nowrap">{fmtDate(a.arrivedAt)}</span>, sort: (a) => a.arrivedAt ?? "" },
    { key: "decl", header: t("ເລກໃບແຈ້ງພາສີ", "Declaration no."), render: (a) => a.customs?.declarationNo ? <span className="font-mono text-[13px] whitespace-nowrap">{a.customs.declarationNo}</span> : <span className="text-xs text-ink-3">{t("ຍັງບໍ່ມີ", "None yet")}</span> },
    { key: "docs", header: t("ເອກະສານ", "Documents"), align: "right", render: (a) => { const x = docsDone(a); return <span className={x.done === x.total ? "font-semibold text-ok" : "text-ink-2"}>{x.done}/{x.total}</span>; }, sort: (a) => docsDone(a).done },
    { key: "st", header: t("ສະຖານະ", "Status"), render: (a) => { const s = STATUS[statusOf(a)]; return <Badge tone={s[2]} noIcon={s[2] === "neutral"}>{t(s[0], s[1])}</Badge>; }, sort: (a) => statusOf(a) },
    { key: "upd", header: t("ອັບເດດ", "Updated"), render: (a) => a.customs ? <span className="block whitespace-nowrap text-xs text-ink-2"><span className="tnum">{fmtDateTime(a.customs.updatedAt)}</span><span className="block">{userName(d, a.customs.updatedBy, lang)}</span></span> : "—" },
  ];
  const editing = d.awbs.find((a) => a.id === editId);
  return <>
    <PageHeader title={t("ພາສີ", "Customs")} subtitle={t(`ບັນທຶກໃບແຈ້ງພາສີຂອງ AWB ຂາເຂົ້າສາຍຕ່າງປະເທດ ທີ່ສະຖານີ ${st}`, `Declarations for international import AWBs at ${st}`)} />
    <div className="mb-4"><Callout tone="warn" title={t("ສະຖານະການເຊື່ອມຕໍ່: ຍັງບໍ່ເປີດໃຊ້", "Connection status: not yet active")} action={<Button size="sm" icon={PlugZap} onClick={() => setCheck({})}>{t("ກວດກັບພາສີ", "Check with Customs")}</Button>}>{t("ການເຊື່ອມຕໍ່ໂດຍກົງກັບ National Single Window ລໍຖ້າສິດເຂົ້າໃຊ້ ແລະ ເອກະສານ API; ໃນຕອນນີ້ ພະນັກງານບັນທຶກໃບແຈ້ງພາສີຢູ່ທີ່ນີ້.", "Direct connection to National Single Window waiting for access and API documents; staff record the declaration here for now.")}</Callout></div>
    <StatRow items={[
      { label: t("ລໍຖ້າຍື່ນ", "Pending"), value: count("pending") },
      { label: t("ຍື່ນແລ້ວ", "Submitted"), value: count("submitted") },
      { label: t("ຜ່ານພາສີ", "Cleared"), value: count("cleared"), tone: "ok" },
      { label: t("ຖືກກັກໄວ້", "On hold"), value: count("hold"), tone: count("hold") ? "bad" : undefined, sub: t("ມອບສິນຄ້າບໍ່ໄດ້", "Cannot be released") },
    ]} />
    {!canOp && <div className="mb-4"><Callout tone="warn" title={t("ເບິ່ງໄດ້ຢ່າງດຽວ", "View only")}>{t("ບົດບາດຂອງທ່ານບໍ່ມີສິດບັນທຶກຂໍ້ມູນພາສີ. ກົດແຖວເພື່ອເບິ່ງລາຍລະອຽດ.", "Your role cannot record customs data. Open a row to view its details.")}</Callout></div>}
    <Panel flush><DataTable rows={rows} columns={cols} rowKey={(a) => a.id} minWidth={1120} defaultSort={{ key: "arr", dir: "desc" }} onRowClick={(a) => setEditId(a.id)} search={(a) => `${a.prefix}${a.serial} ${a.customs?.declarationNo ?? ""} ${customerName(d, a.consigneeId)} ${a.commodity}`}
      filters={<Select aria-label={t("ສະຖານະ", "Status")} className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t("ທຸກສະຖານະ", "All statuses")} options={(Object.keys(STATUS) as CS[]).map((k) => ({ value: k, label: t(STATUS[k][0], STATUS[k][1]) }))} />}
      empty={<Empty icon={Landmark} title={t("ບໍ່ມີ AWB ໃນລາຍການນີ້", "No AWBs in this list")}>{t("AWB ຂາເຂົ້າສາຍຕ່າງປະເທດ ຈະປາກົດຢູ່ນີ້ ເມື່ອມາຮອດສະຖານີນີ້.", "International import AWBs show here once they arrive at this station.")}</Empty>} /></Panel>
    {editing && <CustomsDialog key={editing.id} a={editing} canOp={canOp} onClose={() => setEditId(null)} onCheck={() => setCheck({ awb: editing })} />}
    {check && <Dialog open size="sm" onClose={() => setCheck(null)} title={t("ກວດກັບພາສີ", "Check with Customs")} footer={<Button variant="primary" onClick={() => setCheck(null)}>{t("ເຂົ້າໃຈແລ້ວ", "Understood")}</Button>}>
      <div className="grid gap-3">
        <Callout tone="warn" title={t("ການເຊື່ອມຕໍ່ຍັງບໍ່ເປີດໃຊ້", "The connection is not yet active")}>{t("ບໍ່ໄດ້ສົ່ງຄໍາຮ້ອງໄປຫາພາສີ ແລະ ບໍ່ມີການກວດສະຖານະໃດໆ. ສະຖານະໃນໜ້ານີ້ມາຈາກການບັນທຶກຂອງພະນັກງານເທົ່ານັ້ນ.", "No request was sent to Customs and nothing was checked. Every status on this screen comes from what staff recorded.")}</Callout>
        <Dl cols={2} items={[
          ...(check.awb ? [{ label: "AWB", value: <span className="font-mono text-[13px]">{check.awb.no}</span> }, { label: t("ເລກໃບແຈ້ງພາສີ", "Declaration no."), value: <span className="font-mono text-[13px]">{check.awb.customs?.declarationNo || "—"}</span> }] : []),
          { label: t("ລໍຖ້າຫຍັງຢູ່", "What it is waiting for"), value: t("ສິດເຂົ້າໃຊ້ ແລະ ເອກະສານ API ຈາກ National Single Window", "Access and API documents from National Single Window") },
          { label: t("ເມື່ອເຊື່ອມຕໍ່ແລ້ວ", "Once connected"), value: t("ປຸ່ມນີ້ຈະດຶງສະຖານະຕາມເລກໃບແຈ້ງພາສີ ແລະ ບັນທຶກເປັນ API", "This button fetches the status by declaration number and records it as API") },
        ]} />
      </div>
    </Dialog>}
  </>;
}

function CustomsDialog({ a, canOp, onClose, onCheck }: { a: Awb; canOp: boolean; onClose: () => void; onCheck: () => void }) {
  const t = useT(); const [declarationNo, setDecl] = useState(a.customs?.declarationNo ?? ""); const [status, setStatus] = useState<CS>(statusOf(a)); const [note, setNote] = useState(a.customs?.note ?? ""); const [tried, setTried] = useState(false);
  const list = customsDocList(a); const got = awbDocs(a); const missing = list.filter((x) => !got.includes(x.key));
  const errs = { decl: status !== "pending" && !declarationNo.trim(), note: status === "hold" && !note.trim() };
  function save() { setTried(true); if (errs.decl || errs.note) return; saveCustoms(a.id, { declarationNo: declarationNo.trim(), status, note: note.trim() || undefined, method: "manual" }); toast(t(`ບັນທຶກຂໍ້ມູນພາສີ ${a.no} ແລ້ວ`, `Customs record saved for ${a.no}`)); onClose(); }
  return <Dialog open size="lg" onClose={onClose} title={t(`ຂໍ້ມູນພາສີ ${a.no}`, `Customs record for ${a.no}`)} footer={<><Button icon={PlugZap} onClick={onCheck}>{t("ກວດກັບພາສີ", "Check with Customs")}</Button><Button onClick={onClose}>{canOp ? t("ຍົກເລີກ", "Cancel") : t("ປິດ", "Close")}</Button>{canOp && <Button variant="primary" onClick={save}>{t("ບັນທຶກ", "Save record")}</Button>}</>}>
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
      <div className="grid content-start gap-3">
        <Dl cols={3} items={[{ label: t("ເສັ້ນທາງ", "Route"), value: <Route from={a.origin} to={a.dest} /> }, { label: t("ກ່ອງ", "Pieces"), value: <span className="tnum">{a.pieces}</span> }, { label: t("ນໍ້າໜັກ", "Gross weight"), value: kg(a.grossKg) }]} />
        <Field label={t("ເລກໃບແຈ້ງພາສີ", "Declaration number")} required={status !== "pending"} error={tried && errs.decl ? t("ໃສ່ເລກໃບແຈ້ງພາສີ ກ່ອນປ່ຽນສະຖານະ.", "Enter the declaration number before changing the status.") : undefined}><Input className="font-mono" disabled={!canOp} value={declarationNo} onChange={(e) => setDecl(e.target.value)} placeholder="LA26-000000" /></Field>
        <Field label={t("ສະຖານະ", "Status")} required><Select disabled={!canOp} value={status} onChange={(e) => setStatus(e.target.value as CS)} options={(Object.keys(STATUS) as CS[]).map((k) => ({ value: k, label: t(STATUS[k][0], STATUS[k][1]) }))} /></Field>
        <Field label={t("ໝາຍເຫດ", "Note")} required={status === "hold"} error={tried && errs.note ? t("ບອກເຫດຜົນທີ່ພາສີກັກໄວ້.", "State why Customs is holding the cargo.") : undefined}><Textarea rows={2} disabled={!canOp} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {status === "hold" && <Callout tone="bad">{t("ສິນຄ້າທີ່ຖືກກັກໄວ້ຈະມອບໃຫ້ຜູ້ຮັບບໍ່ໄດ້.", "Cargo on hold cannot be released to the receiver.")}</Callout>}
        {status === "cleared" && missing.length > 0 && <Callout tone="warn">{t(`ເອກະສານຍັງຂາດ ${missing.length} ລາຍການ. ກວດໃຫ້ຄົບກ່ອນບັນທຶກວ່າຜ່ານພາສີ.`, `${missing.length} document(s) still unchecked. Check them before recording clearance.`)}</Callout>}
      </div>
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><FileCheck2 size={16} aria-hidden />{t("ລາຍການເອກະສານ", "Document checklist")}<span className="tnum ml-auto text-xs font-normal text-ink-2">{list.length - missing.length}/{list.length}</span></div>
        <ul className="grid gap-2">{list.map((x) => <li key={x.key}><Checkbox label={t(x.lo, x.en)} disabled={!canOp} checked={got.includes(x.key)} onChange={(v) => setAwbDoc(a.id, x.key, v)} /></li>)}</ul>
        {a.shc.length > 0 && <div className="mt-3 text-xs text-ink-2"><ShcTags codes={a.shc} /></div>}
      </div>
    </div>
  </Dialog>;
}
