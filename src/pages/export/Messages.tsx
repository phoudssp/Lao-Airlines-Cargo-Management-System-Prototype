import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Copy, Download, FilePlus2, Pencil, RefreshCw, RotateCcw, Save, Send, Trash2 } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Col, Confirm, DataTable, Dialog, Empty, Field, IconButton, PageHeader, Panel, Select, Tabs, Textarea, toast } from "@/ui/kit";
import { userName } from "@/ui/cargo";
import type { CargoMessage, MessageType } from "@/lib/types";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { buildFfm, buildFhl, buildFwb, createMessage, deleteMessage, updateMessage } from "@/lib/mock/awb";

const fileName = (m: CargoMessage) => `${m.type}-${m.ref.replace(/[^A-Za-z0-9]+/g, "-")}.txt`;
function download(m: CargoMessage) { const url = URL.createObjectURL(new Blob([m.body], { type: "text/plain;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = fileName(m); document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
const TYPE_NOTE: Record<MessageType, [string, string]> = { FFM: ["Manifest ຂອງຖ້ຽວບິນ", "Flight manifest"], FWB: ["ຂໍ້ມູນ AWB (MAWB)", "Air waybill data (MAWB)"], FHL: ["ລາຍການ HAWB ພາຍໃຕ້ MAWB", "House list under a MAWB"] };

function GenerateDialog({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const d = useDb(); const t = useT(); const st = d.session.station; const [type, setType] = useState<MessageType>("FFM"); const [ref, setRef] = useState("");
  const awbs = d.awbs.filter((a) => a.status === "active" && a.direction === "export" && a.origin === st && (type !== "FHL" || a.houses.length > 0));
  const flights = d.flights.filter((f) => f.origin === st && d.loads.some((l) => l.flightId === f.id && l.status !== "offloaded")).sort((a, b) => `${b.date}${b.std}`.localeCompare(`${a.date}${a.std}`));
  const options = type === "FFM" ? flights.map((f) => ({ value: f.id, label: `${f.no} ${f.origin}→${f.dest} ${fmtDate(f.date)} · ${d.loads.filter((l) => l.flightId === f.id && l.status !== "offloaded").length} AWB` })) : awbs.map((a) => ({ value: a.id, label: `${a.no} ${a.origin}→${a.dest}${type === "FHL" ? ` · ${a.houses.length} HAWB` : ""}` }));
  return <Dialog open size="sm" onClose={onClose} title={t("ສ້າງຮ່າງຂໍ້ຄວາມ", "Generate a message draft")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" disabled={!ref} onClick={() => { const m = createMessage(type, type === "FFM" ? { flightId: ref } : { awbId: ref }); toast(t(`ສ້າງຮ່າງ ${type} ແລ້ວ`, `${type} draft generated`)); onDone(m.id); }}>{t("ສ້າງຮ່າງ", "Generate draft")}</Button></>}>
    <div className="grid gap-3">
      <Field label={t("ປະເພດຂໍ້ຄວາມ", "Message type")} required><Select value={type} onChange={(e) => { setType(e.target.value as MessageType); setRef(""); }} options={(["FFM", "FWB", "FHL"] as MessageType[]).map((x) => ({ value: x, label: `${x} · ${t(TYPE_NOTE[x][0], TYPE_NOTE[x][1])}` }))} /></Field>
      <Field label={type === "FFM" ? t("ຖ້ຽວບິນ", "Flight") : "AWB"} required hint={options.length === 0 ? (type === "FFM" ? t(`ບໍ່ມີຖ້ຽວບິນທີ່ມີ Manifest ຈາກ ${st}. ວາງແຜນໂຫຼດສິນຄ້າກ່ອນ.`, `No flight from ${st} has a manifest yet. Plan a load first.`) : type === "FHL" ? t(`ບໍ່ມີ AWB ທີ່ມີ HAWB ຢູ່ ${st}. FHL ໃຊ້ໄດ້ສະເພາະ AWB ທີ່ມີ HAWB.`, `No AWB at ${st} has houses. FHL is only for AWBs with HAWBs.`) : t(`ບໍ່ມີ AWB ຢູ່ ${st}.`, `No AWBs at ${st}.`)) : type === "FHL" ? t("ສະແດງສະເພາະ AWB ທີ່ມີ HAWB", "Only AWBs with HAWBs are listed") : undefined}><Select value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t("ເລືອກ", "Choose")} options={options} disabled={options.length === 0} /></Field>
    </div>
  </Dialog>;
}

function Viewer({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useDb(); const t = useT(); const lang = useLang(); const can = useCan(); const [edit, setEdit] = useState(false); const [body, setBody] = useState(""); const [askDel, setAskDel] = useState(false);
  const m = d.messages.find((x) => x.id === id); if (!m) return null;
  const perm = can("messages.manage"); const draft = m.status === "draft"; const msg = m;
  async function copy() { try { await navigator.clipboard.writeText(msg.body); toast(t("ຄັດລອກຂໍ້ຄວາມແລ້ວ", "Message copied")); } catch { toast(t("Browser ບໍ່ອະນຸຍາດໃຫ້ຄັດລອກ. ເລືອກຂໍ້ຄວາມແລ້ວກົດ Ctrl+C ແທນ.", "The browser blocked copying. Select the text and press Ctrl+C instead."), "warn"); } }
  function regen() { const a = d.awbs.find((x) => x.id === msg.awbId); const next = msg.type === "FFM" ? buildFfm(d, msg.flightId!) : a ? (msg.type === "FWB" ? buildFwb(d, a) : buildFhl(d, a)) : msg.body; updateMessage(msg.id, { body: next }); setEdit(false); toast(t("ສ້າງຂໍ້ຄວາມຄືນຈາກຂໍ້ມູນລ່າສຸດແລ້ວ", "Rebuilt from the latest data")); }
  return <Dialog open size="lg" onClose={onClose} title={`${m.type} · ${m.ref}`} footer={<>
    {perm && <Button variant="danger" icon={Trash2} onClick={() => setAskDel(true)}>{t("ລຶບ", "Delete")}</Button>}
    <span className="flex-1" />
    {edit ? <><Button onClick={() => setEdit(false)}>{t("ຍົກເລີກການແກ້ໄຂ", "Discard edits")}</Button><Button variant="primary" icon={Save} onClick={() => { updateMessage(m.id, { body }); setEdit(false); toast(t("ບັນທຶກຂໍ້ຄວາມແລ້ວ", "Message saved")); }}>{t("ບັນທຶກ", "Save")}</Button></> : <>
      <Button icon={Copy} onClick={copy}>{t("ຄັດລອກ", "Copy")}</Button>
      <Button icon={Download} onClick={() => download(m)}>{t("ດາວໂຫຼດ .txt", "Download .txt")}</Button>
      {perm && draft && <Button icon={RefreshCw} onClick={regen}>{t("ສ້າງຄືນ", "Rebuild")}</Button>}
      {perm && draft && <Button icon={Pencil} onClick={() => { setBody(m.body); setEdit(true); }}>{t("ແກ້ໄຂ", "Edit")}</Button>}
      {perm && (draft ? <Button variant="primary" icon={Check} onClick={() => { updateMessage(m.id, { status: "exported" }); toast(t("ໝາຍວ່າສົ່ງອອກແລ້ວ", "Marked as exported")); }}>{t("ໝາຍວ່າສົ່ງອອກແລ້ວ", "Mark exported")}</Button> : <Button icon={RotateCcw} onClick={() => updateMessage(m.id, { status: "draft" })}>{t("ກັບເປັນຮ່າງ", "Back to draft")}</Button>)}
    </>}
  </>}>
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><Badge tone={draft ? "warn" : "ok"}>{draft ? t("ຮ່າງ", "Draft") : t("ສົ່ງອອກແລ້ວ", "Exported")}</Badge><span className="text-ink-2">{userName(d, m.by, lang)} · <span className="tnum">{fmtDateTime(m.createdAt)}</span></span><span className="font-mono text-xs text-ink-2">{fileName(m)}</span></div>
    {edit ? <Field label={t("ເນື້ອໃນຂໍ້ຄວາມ", "Message body")}><Textarea rows={16} spellCheck={false} className="font-mono text-[13px] leading-5" value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      : <pre className="max-h-[50vh] overflow-auto rounded border border-line bg-surface-2 p-3 font-mono text-[13px] leading-5">{m.body}</pre>}
    <Confirm open={askDel} onClose={() => setAskDel(false)} danger title={t(`ລຶບ ${m.type} ${m.ref}?`, `Delete ${m.type} ${m.ref}?`)} confirmLabel={t("ລຶບຂໍ້ຄວາມ", "Delete message")} onConfirm={() => { deleteMessage(m.id); toast(t("ລຶບຂໍ້ຄວາມແລ້ວ", "Message deleted")); onClose(); }} />
  </Dialog>;
}

export default function Messages() {
  const d = useDb(); const t = useT(); const lang = useLang(); const can = useCan(); const st = d.session.station; const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<"draft" | "exported">("draft"); const [type, setType] = useState(""); const [gen, setGen] = useState(false); const [view, setView] = useState<string | null>(null); const [del, setDel] = useState<CargoMessage | null>(null);
  const perm = can("messages.manage");
  useEffect(() => { const o = params.get("open"); if (o) { setView(o); setParams({}, { replace: true }); } /* eslint-disable-next-line */ }, []);
  const all = useMemo(() => d.messages.filter((m) => (m.flightId ? d.flights.find((f) => f.id === m.flightId)?.origin : d.awbs.find((a) => a.id === m.awbId)?.origin) === st), [d.messages, d.flights, d.awbs, st]);
  const rows = all.filter((m) => m.status === tab && (!type || m.type === type));
  const cols: Col<CargoMessage>[] = [
    { key: "type", header: t("ປະເພດ", "Type"), mono: true, render: (m) => <span className="font-semibold">{m.type}</span>, sort: (m) => m.type },
    { key: "ref", header: t("ອ້າງອີງ", "Reference"), render: (m) => m.flightId ? <Link to={`/export/dispatch/${m.flightId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[13px] font-semibold text-brand whitespace-nowrap hover:underline">{m.ref}</Link> : <Link to={`/export/awb/${m.awbId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[13px] font-semibold text-brand whitespace-nowrap hover:underline">{m.ref}</Link>, sort: (m) => m.ref },
    { key: "preview", header: t("ເນື້ອໃນ", "Content"), render: (m) => <span className="line-clamp-1 font-mono text-xs text-ink-2">{m.body.split("\n").slice(1, 3).join(" ")}</span> },
    { key: "by", header: t("ຜູ້ສ້າງ", "Created by"), render: (m) => userName(d, m.by, lang) },
    { key: "at", header: t("ເວລາ", "Created"), render: (m) => <span className="tnum whitespace-nowrap">{fmtDateTime(m.createdAt)}</span>, sort: (m) => m.createdAt },
    { key: "st", header: t("ສະຖານະ", "Status"), render: (m) => m.status === "draft" ? <Badge tone="warn">{t("ຮ່າງ", "Draft")}</Badge> : <Badge tone="ok">{t("ສົ່ງອອກແລ້ວ", "Exported")}</Badge> },
    { key: "act", header: "", align: "right", render: (m) => <span className="inline-flex" onClick={(e) => e.stopPropagation()}><IconButton icon={Download} label={t(`ດາວໂຫຼດ ${m.ref}`, `Download ${m.ref}`)} onClick={() => download(m)} />{perm && <IconButton icon={Trash2} label={t(`ລຶບ ${m.ref}`, `Delete ${m.ref}`)} onClick={() => setDel(m)} />}</span> },
  ];
  return <>
    <PageHeader title={t("ຂໍ້ຄວາມ FFM, FWB, FHL", "FFM, FWB and FHL messages")} subtitle={t("ສ້າງຮ່າງຂໍ້ຄວາມ Cargo-IMP ຈາກຂໍ້ມູນ MAWB, HAWB ແລະ Manifest.", "Cargo-IMP drafts built from MAWB, HAWB and manifest data.")} actions={perm && <Button variant="primary" icon={FilePlus2} onClick={() => setGen(true)}>{t("ສ້າງຮ່າງຂໍ້ຄວາມ", "Generate draft")}</Button>} />
    <div className="mb-3"><Callout title={t("ສົ່ງອອກເປັນໄຟລ໌", "Exported as files")}>{t("ຮ່າງຂໍ້ຄວາມຖືກສົ່ງອອກເປັນໄຟລ໌ .txt ເພື່ອນໍາໄປໃຊ້ຕໍ່. ການສົ່ງກົງຜ່ານເຄືອຂ່າຍການບິນເປັນຕົວເລືອກເພີ່ມເຕີມ.", "Drafts are exported as .txt files because direct sending over airline networks is an optional extra.")}</Callout></div>
    <Tabs value={tab} onChange={setTab} tabs={[{ key: "draft", label: t("ຮ່າງ", "Drafts"), count: all.filter((m) => m.status === "draft").length }, { key: "exported", label: t("ສົ່ງອອກແລ້ວ", "Exported"), count: all.filter((m) => m.status === "exported").length }]} />
    <Panel flush>
      <DataTable rows={rows} columns={cols} rowKey={(m) => m.id} minWidth={860} defaultSort={{ key: "at", dir: "desc" }} onRowClick={(m) => setView(m.id)} search={(m) => `${m.type} ${m.ref} ${m.body}`}
        filters={<Select aria-label={t("ປະເພດ", "Type")} className="w-auto" value={type} onChange={(e) => setType(e.target.value)} placeholder={t("ທຸກປະເພດ", "All types")} options={["FFM", "FWB", "FHL"].map((x) => ({ value: x, label: x }))} />}
        empty={<Empty icon={Send} title={tab === "draft" ? t(`ຍັງບໍ່ມີຮ່າງຂໍ້ຄວາມຢູ່ ${st}`, `No drafts at ${st} yet`) : t("ຍັງບໍ່ມີຂໍ້ຄວາມທີ່ສົ່ງອອກ", "Nothing exported yet")} action={perm && tab === "draft" ? <Button icon={FilePlus2} onClick={() => setGen(true)}>{t("ສ້າງຮ່າງຂໍ້ຄວາມ", "Generate draft")}</Button> : undefined}>{tab === "draft" ? t("ສ້າງ FFM ຈາກຖ້ຽວບິນ, ສ້າງ FWB ຫຼື FHL ຈາກ AWB.", "Generate an FFM from a flight, or an FWB or FHL from an AWB.") : t("ຂໍ້ຄວາມຈະຍ້າຍມາຢູ່ນີ້ ເມື່ອໝາຍວ່າສົ່ງອອກແລ້ວ.", "Messages move here when marked exported.")}</Empty>} />
    </Panel>
    {!perm && <p className="mt-2 text-xs text-ink-2">{t("ບົດບາດຂອງທ່ານເບິ່ງ ແລະ ດາວໂຫຼດໄດ້. ພະນັກງານຮັບສິນຄ້າ ເປັນຜູ້ສ້າງ ແລະ ແກ້ໄຂຂໍ້ຄວາມ.", "Your role can view and download. Acceptance officers generate and edit messages.")}</p>}
    {gen && <GenerateDialog onClose={() => setGen(false)} onDone={(id) => { setGen(false); setTab("draft"); setView(id); }} />}
    {view && <Viewer id={view} onClose={() => setView(null)} />}
    <Confirm open={!!del} onClose={() => setDel(null)} danger title={t(`ລຶບ ${del?.type} ${del?.ref}?`, `Delete ${del?.type} ${del?.ref}?`)} confirmLabel={t("ລຶບຂໍ້ຄວາມ", "Delete message")} onConfirm={() => { if (del) { deleteMessage(del.id); toast(t("ລຶບຂໍ້ຄວາມແລ້ວ", "Message deleted")); } }} />
  </>;
}
