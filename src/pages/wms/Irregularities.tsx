import { useMemo, useState } from "react";
import { CheckCircle2, Pencil, Plus, Printer, RotateCcw, Search as SearchIcon, Trash2, TriangleAlert } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Col, Confirm, DataTable, Dialog, Dl, Empty, Field, Input, PageHeader, Panel, PrintSheet, Select, StatRow, Textarea, toast, type Tone } from "@/ui/kit";
import { AwbLink, Barcode, customerName, flightLabel, Route, userName } from "@/ui/cargo";
import type { Irregularity, IrregularityType } from "@/lib/types";
import { fmtDateTime, kg } from "@/lib/format";
import { createIrregularity, deleteIrregularity, updateIrregularity } from "@/lib/mock/ops";

const TYPES: Record<IrregularityType, [string, string]> = { damage: ["ເສຍຫາຍ", "Damage"], wet: ["ປຽກນໍ້າ", "Wet"], broken: ["ແຕກຫັກ", "Broken"], short: ["ຂາດ", "Short"], over: ["ເກີນ", "Over"], lost: ["ສູນຫາຍ", "Lost"], misrouted: ["ສົ່ງຜິດເສັ້ນທາງ", "Misrouted"] };
const STATUS: Record<Irregularity["status"], [string, string, Tone]> = { open: ["ເປີດຢູ່", "Open", "bad"], investigating: ["ກໍາລັງກວດສອບ", "Investigating", "warn"], closed: ["ປິດແລ້ວ", "Closed", "ok"] };

export default function Irregularities() {
  const d = useDb(); const t = useT(); const can = useCan(); const lang = useLang(); const st = d.session.station; const canOp = can("wms.operate");
  const [type, setType] = useState(""); const [status, setStatus] = useState(""); const [editing, setEditing] = useState<Irregularity | "new" | null>(null); const [viewId, setViewId] = useState<string | null>(null); const [closing, setClosing] = useState<Irregularity | null>(null); const [del, setDel] = useState<Irregularity | null>(null); const [printId, setPrintId] = useState<string | null>(null);
  const all = useMemo(() => d.irregularities.filter((r) => r.station === st), [d.irregularities, st]);
  const rows = all.filter((r) => (!type || r.type === type) && (!status || r.status === status));
  const awbOf = (r: Irregularity) => d.awbs.find((a) => a.id === r.awbId);
  function investigate(r: Irregularity) { updateIrregularity(r.id, { status: "investigating" }); toast(t(`${r.no}: ເລີ່ມກວດສອບແລ້ວ`, `${r.no}: investigation started`)); }
  const cols: Col<Irregularity>[] = [
    { key: "no", header: t("ເລກບັນທຶກ", "Record"), render: (r) => <span className="font-mono text-[13px] font-semibold whitespace-nowrap">{r.no}</span>, sort: (r) => r.no },
    { key: "awb", header: t("ເລກ AWB", "AWB number"), render: (r) => { const a = awbOf(r); return a ? <AwbLink awb={a} /> : "—"; } },
    { key: "type", header: t("ປະເພດ", "Type"), render: (r) => <Badge tone={["damage", "wet", "broken"].includes(r.type) ? "bad" : "warn"}>{t(TYPES[r.type][0], TYPES[r.type][1])}</Badge>, sort: (r) => r.type },
    { key: "pcs", header: t("ກ່ອງ", "Pcs"), align: "right", render: (r) => r.pieces, sort: (r) => r.pieces },
    { key: "note", header: t("ລາຍລະອຽດ", "Details"), render: (r) => <span className="line-clamp-2 min-w-[200px]">{(() => { const p = r.note.split(" / "); return p.length === 2 ? t(p[0], p[1]) : r.note; })()}</span> },
    { key: "by", header: t("ຜູ້ລາຍງານ", "Reported by"), render: (r) => <span className="whitespace-nowrap">{userName(d, r.reportedBy, lang)}</span> },
    { key: "at", header: t("ເວລາ", "Reported at"), render: (r) => <span className="tnum whitespace-nowrap">{fmtDateTime(r.reportedAt)}</span>, sort: (r) => r.reportedAt },
    { key: "status", header: t("ສະຖານະ", "Status"), render: (r) => <Badge tone={STATUS[r.status][2]}>{t(STATUS[r.status][0], STATUS[r.status][1])}</Badge>, sort: (r) => r.status },
    { key: "act", header: "", align: "right", render: (r) => canOp && r.status !== "closed" ? <span onClick={(e) => e.stopPropagation()}>{r.status === "open" ? <Button size="sm" icon={SearchIcon} onClick={() => investigate(r)}>{t("ກວດສອບ", "Investigate")}</Button> : <Button size="sm" icon={CheckCircle2} onClick={() => setClosing(r)}>{t("ປິດບັນທຶກ", "Close")}</Button>}</span> : null },
  ];
  const view = d.irregularities.find((r) => r.id === viewId); const viewAwb = view && awbOf(view); const printing = d.irregularities.find((r) => r.id === printId);
  return <>
    <PageHeader title={t("ເສຍຫາຍ ແລະ ຜິດປົກກະຕິ", "Damage and irregularities")} subtitle={t(`ບັນທຶກຄວາມຜິດປົກກະຕິຂອງສິນຄ້າ ຢູ່ສະຖານີ ${st} ຈົນກວ່າຈະປິດພ້ອມຜົນການແກ້ໄຂ`, `Cargo irregularities at ${st}, tracked until closed with a resolution`)} actions={canOp ? <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>{t("ເປີດບັນທຶກໃໝ່", "Open a record")}</Button> : undefined} />
    <StatRow items={[
      { label: t("ເປີດຢູ່", "Open"), value: all.filter((r) => r.status === "open").length, tone: all.some((r) => r.status === "open") ? "bad" : undefined },
      { label: t("ກໍາລັງກວດສອບ", "Investigating"), value: all.filter((r) => r.status === "investigating").length, tone: "warn" },
      { label: t("ປິດແລ້ວ", "Closed"), value: all.filter((r) => r.status === "closed").length },
      { label: t("ກ່ອງທີ່ກ່ຽວຂ້ອງ (ຍັງບໍ່ປິດ)", "Pieces affected (not closed)"), value: all.filter((r) => r.status !== "closed").reduce((s, r) => s + r.pieces, 0) },
    ]} />
    {!canOp && <div className="mb-4"><Callout tone="warn" title={t("ເບິ່ງໄດ້ຢ່າງດຽວ", "View only")}>{t("ບົດບາດຂອງທ່ານເບິ່ງ ແລະ ພິມບົດລາຍງານໄດ້ ແຕ່ແກ້ໄຂບໍ່ໄດ້.", "Your role can view and print reports but not change records.")}</Callout></div>}
    <Panel flush><DataTable rows={rows} columns={cols} rowKey={(r) => r.id} minWidth={1120} defaultSort={{ key: "at", dir: "desc" }} onRowClick={(r) => setViewId(r.id)} search={(r) => { const a = awbOf(r); return `${r.no} ${a ? a.prefix + a.serial : ""} ${r.note} ${r.resolution ?? ""}`; }}
      filters={<>
        <Select aria-label={t("ປະເພດ", "Type")} className="w-auto" value={type} onChange={(e) => setType(e.target.value)} placeholder={t("ທຸກປະເພດ", "All types")} options={(Object.keys(TYPES) as IrregularityType[]).map((k) => ({ value: k, label: t(TYPES[k][0], TYPES[k][1]) }))} />
        <Select aria-label={t("ສະຖານະ", "Status")} className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t("ທຸກສະຖານະ", "All statuses")} options={(Object.keys(STATUS) as Irregularity["status"][]).map((k) => ({ value: k, label: t(STATUS[k][0], STATUS[k][1]) }))} />
      </>}
      empty={<Empty icon={TriangleAlert} title={t("ບໍ່ມີບັນທຶກໃນລາຍການນີ້", "No records in this list")}>{t("ບັນທຶກຈະເປີດໃຫ້ອັດຕະໂນມັດເມື່ອຮັບສິນຄ້າຜິດປົກກະຕິ ຫຼື ກົດ ເປີດບັນທຶກໃໝ່.", "Records open automatically when a receipt finds a fault, or use Open a record.")}</Empty>} /></Panel>
    {view && <Dialog open size="lg" onClose={() => setViewId(null)} title={`${view.no} · ${t(TYPES[view.type][0], TYPES[view.type][1])}`} footer={<>
      {canOp && <Button variant="danger" icon={Trash2} onClick={() => setDel(view)}>{t("ລຶບ", "Delete")}</Button>}
      <Button icon={Printer} onClick={() => setPrintId(view.id)}>{t("ພິມບົດລາຍງານຄວາມເສຍຫາຍ", "Print damage report")}</Button>
      {canOp && <Button icon={Pencil} onClick={() => setEditing(view)}>{t("ແກ້ໄຂ", "Edit")}</Button>}
      {canOp && view.status === "open" && <Button icon={SearchIcon} onClick={() => investigate(view)}>{t("ເລີ່ມກວດສອບ", "Start investigation")}</Button>}
      {canOp && view.status !== "closed" && <Button variant="primary" icon={CheckCircle2} onClick={() => setClosing(view)}>{t("ປິດພ້ອມຜົນການແກ້ໄຂ", "Close with resolution")}</Button>}
      {canOp && view.status === "closed" && <Button icon={RotateCcw} onClick={() => { updateIrregularity(view.id, { status: "investigating" }); toast(t("ເປີດບັນທຶກຄືນແລ້ວ", "Record reopened")); }}>{t("ເປີດຄືນ", "Reopen")}</Button>}
    </>}>
      <div className="grid gap-4">
        <Dl cols={3} items={[
          { label: t("ສະຖານະ", "Status"), value: <Badge tone={STATUS[view.status][2]}>{t(STATUS[view.status][0], STATUS[view.status][1])}</Badge> },
          { label: "AWB", value: viewAwb ? <AwbLink awb={viewAwb} /> : "—" },
          { label: t("ເສັ້ນທາງ", "Route"), value: viewAwb ? <Route from={viewAwb.origin} to={viewAwb.dest} /> : "—" },
          { label: t("ກ່ອງທີ່ກ່ຽວຂ້ອງ", "Pieces affected"), value: <span className="tnum">{view.pieces}{viewAwb && ` / ${viewAwb.pieces}`}</span> },
          { label: t("ສິນຄ້າ", "Commodity"), value: viewAwb?.commodity },
          { label: t("ຜູ້ຮັບ", "Consignee"), value: customerName(d, viewAwb?.consigneeId) },
          { label: t("ຜູ້ລາຍງານ", "Reported by"), value: userName(d, view.reportedBy, lang) },
          { label: t("ເວລາລາຍງານ", "Reported at"), value: <span className="tnum">{fmtDateTime(view.reportedAt)}</span> },
          { label: t("ສະຖານີ", "Station"), value: <span className="font-mono text-[13px]">{view.station}</span> },
        ]} />
        <div><div className="box-label">{t("ລາຍລະອຽດ", "Details")}</div><p className="text-sm">{view.note || "—"}</p></div>
        {view.resolution && <Callout tone="ok" title={t("ຜົນການແກ້ໄຂ", "Resolution")}>{view.resolution}</Callout>}
      </div>
    </Dialog>}
    {editing && <RecordDialog record={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    <Confirm open={!!closing} onClose={() => setClosing(null)} title={t(`ປິດ ${closing?.no}`, `Close ${closing?.no}`)} reasonLabel={t("ຜົນການແກ້ໄຂ", "Resolution")} confirmLabel={t("ປິດບັນທຶກ", "Close the record")} onConfirm={(res) => { if (closing) { updateIrregularity(closing.id, { status: "closed", resolution: res }); toast(t("ປິດບັນທຶກແລ້ວ", "Record closed")); } }} />
    <Confirm open={!!del} onClose={() => setDel(null)} danger title={t(`ລຶບ ${del?.no}?`, `Delete ${del?.no}?`)} body={t("ລຶບແລ້ວກູ້ຄືນບໍ່ໄດ້. ຖ້າແກ້ໄຂແລ້ວ ຄວນປິດບັນທຶກແທນ.", "This cannot be undone. If the matter is resolved, close the record instead.")} confirmLabel={t("ລຶບບັນທຶກ", "Delete record")} onConfirm={() => { if (del) { deleteIrregularity(del.id); setViewId(null); toast(t("ລຶບບັນທຶກແລ້ວ", "Record deleted")); } }} />
    <PrintSheet open={!!printing} onClose={() => setPrintId(null)} title={t("ບົດລາຍງານຄວາມເສຍຫາຍ", "Damage report")}>{printing && <Report r={printing} />}</PrintSheet>
  </>;
}

function RecordDialog({ record, onClose }: { record?: Irregularity; onClose: () => void }) {
  const d = useDb(); const t = useT(); const st = d.session.station;
  const options = d.awbs.filter((a) => a.status === "active" && a.stage !== "DLV" && (a.station === st || a.dest === st)).sort((a, b) => b.no.localeCompare(a.no));
  const [awbId, setAwbId] = useState(record?.awbId ?? ""); const [type, setType] = useState<IrregularityType>(record?.type ?? "damage"); const [pieces, setPieces] = useState(String(record?.pieces ?? 1)); const [note, setNote] = useState(record?.note ?? ""); const [resolution, setResolution] = useState(record?.resolution ?? ""); const [tried, setTried] = useState(false);
  const a = d.awbs.find((x) => x.id === awbId); const n = Number(pieces);
  const errs = { awb: !awbId, pieces: !Number.isInteger(n) || n < 1, note: !note.trim(), res: record?.status === "closed" && !resolution.trim() };
  function save() {
    setTried(true); if (Object.values(errs).some(Boolean)) return;
    if (record) { updateIrregularity(record.id, { type, pieces: n, note: note.trim(), resolution: resolution.trim() || undefined }); toast(t("ບັນທຶກການແກ້ໄຂແລ້ວ", "Changes saved")); }
    else { createIrregularity({ awbId, type, pieces: n, note: note.trim() }); toast(t("ເປີດບັນທຶກໃໝ່ແລ້ວ", "Record opened")); }
    onClose();
  }
  return <Dialog open onClose={onClose} title={record ? t(`ແກ້ໄຂ ${record.no}`, `Edit ${record.no}`) : t("ເປີດບັນທຶກຄວາມຜິດປົກກະຕິ", "Open an irregularity record")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{record ? t("ບັນທຶກ", "Save") : t("ເປີດບັນທຶກ", "Open record")}</Button></>}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="AWB" required className="sm:col-span-2" hint={a ? `${a.origin} → ${a.dest} · ${a.pieces} PCS · ${kg(a.grossKg)} · ${a.commodity}` : undefined} error={tried && errs.awb ? t("ເລືອກ AWB ທີ່ກ່ຽວຂ້ອງ.", "Choose the AWB concerned.") : undefined}>
        <Select value={awbId} disabled={!!record} onChange={(e) => setAwbId(e.target.value)} placeholder={t("ເລືອກ AWB", "Choose an AWB")} options={(record && a && !options.includes(a) ? [a, ...options] : options).map((x) => ({ value: x.id, label: `${x.no} · ${x.origin}-${x.dest} · ${flightLabel(d, x.flightId)}` }))} />
      </Field>
      <Field label={t("ປະເພດ", "Type")} required><Select value={type} onChange={(e) => setType(e.target.value as IrregularityType)} options={(Object.keys(TYPES) as IrregularityType[]).map((k) => ({ value: k, label: t(TYPES[k][0], TYPES[k][1]) }))} /></Field>
      <Field label={t("ກ່ອງທີ່ກ່ຽວຂ້ອງ", "Pieces affected")} required error={tried && errs.pieces ? t("ໃສ່ຈໍານວນກ່ອງ ຢ່າງໜ້ອຍ 1.", "Enter at least 1 piece.") : undefined}><Input type="number" min={1} value={pieces} onChange={(e) => setPieces(e.target.value)} /></Field>
      <Field label={t("ລາຍລະອຽດ", "Details")} required className="sm:col-span-2" error={tried && errs.note ? t("ອະທິບາຍສິ່ງທີ່ພົບ.", "Describe what was found.") : undefined}><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {record?.status === "closed" && <Field label={t("ຜົນການແກ້ໄຂ", "Resolution")} required className="sm:col-span-2" error={tried && errs.res ? t("ບັນທຶກທີ່ປິດແລ້ວຕ້ອງມີຜົນການແກ້ໄຂ.", "A closed record needs a resolution.") : undefined}><Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} /></Field>}
    </div>
  </Dialog>;
}

function Report({ r }: { r: Irregularity }) {
  const d = useDb(); const lang = useLang(); const a = d.awbs.find((x) => x.id === r.awbId); const name = (id?: string) => d.customers.find((c) => c.id === id)?.nameEn ?? "—";
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <tr><th className="w-[36%] border border-black p-1.5 text-left text-[11px] font-normal">{label}</th><td className="border border-black p-1.5 text-[13px]">{children}</td></tr>;
  return <div className="text-black" style={{ fontFamily: "Noto Sans, Noto Sans Lao, sans-serif" }}>
    <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-2"><div><div className="text-sm font-semibold">LAO AIRLINES CARGO · ການບິນລາວ ພະແນກຂົນສົ່ງສິນຄ້າ</div><div className="text-xl font-semibold">ບົດລາຍງານຄວາມເສຍຫາຍ / Damage report</div></div><div className="text-right text-[12px]"><div>No.</div><div className="font-mono text-lg font-semibold">{r.no}</div><div>{r.station} · {fmtDateTime(r.reportedAt)}</div></div></div>
    {a && <div className="my-3"><Barcode value={`${a.prefix}${a.serial}`} height={38} /></div>}
    <table className="w-full border-collapse"><tbody>
      <Row label="AWB"><span className="font-mono">{a?.no ?? "—"}</span>{a && ` · ${a.origin} → ${a.dest}`}</Row>
      <Row label="ຖ້ຽວບິນ / Flight">{flightLabel(d, a?.flightId)}</Row>
      <Row label="ຜູ້ສົ່ງ / Shipper">{name(a?.shipperId)}</Row>
      <Row label="ຜູ້ຮັບ / Consignee">{name(a?.consigneeId)}</Row>
      <Row label="ສິນຄ້າ / Nature of goods">{a?.commodity ?? "—"}</Row>
      <Row label="ຈໍານວນ ແລະ ນໍ້າໜັກ / Pieces and weight">{a ? `${a.pieces} PCS · ${kg(a.grossKg)}` : "—"}</Row>
      <Row label="ປະເພດ / Type">{TYPES[r.type][0]} / {TYPES[r.type][1]}</Row>
      <Row label="ກ່ອງທີ່ກ່ຽວຂ້ອງ / Pieces affected">{r.pieces}</Row>
      <Row label="ລາຍລະອຽດ / Details">{r.note || "—"}</Row>
      <Row label="ສະຖານະ / Status">{STATUS[r.status][0]} / {STATUS[r.status][1]}</Row>
      <Row label="ຜົນການແກ້ໄຂ / Resolution">{r.resolution ?? "—"}</Row>
      <Row label="ຜູ້ລາຍງານ / Reported by">{userName(d, r.reportedBy, lang)}</Row>
    </tbody></table>
    <div className="mt-10 grid grid-cols-3 gap-6 text-[12px]">{["ພະນັກງານສາງ / Warehouse officer", "ຜູ້ຮັບສິນຄ້າ / Consignee", "ຫົວໜ້າສະຖານີ / Station manager"].map((x) => <div key={x}><div className="h-14 border-b border-black" /><div className="mt-1">{x}</div></div>)}</div>
  </div>;
}
