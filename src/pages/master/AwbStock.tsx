import { useState } from "react";
import { Link } from "react-router-dom";
import { Ban, CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useName, useT } from "@/lib/i18n";
import { Badge, BarMeter, Button, Callout, Col, Confirm, DataTable, Dialog, Field, IconButton, Input, MonoCode, PageHeader, Panel, Select, StatRow, toast } from "@/ui/kit";
import { customerName } from "@/ui/cargo";
import type { AwbStock as Stock, Db } from "@/lib/types";
import { num } from "@/lib/format";
import { awbNo, withCheckDigit } from "@/lib/pricing";
import { allocateStock, deleteStock, updateStock } from "@/lib/mock/master";

const PREFIX = "627";
const LOW = 0.1;
const total = (s: Stock) => s.to - s.from + 1;
const used = (s: Stock) => s.nextSerial - s.from;
const left = (s: Stock) => Math.max(0, s.to - s.nextSerial + 1);
const isLow = (s: Stock) => s.active && left(s) / total(s) < LOW;
const fullNo = (s: Stock, serial: number) => awbNo(s.prefix, withCheckDigit(serial));
const issuedFrom = (d: Db, s: Stock) => d.awbs.filter((a) => a.prefix === s.prefix && Number(a.serial.slice(0, 7)) >= s.from && Number(a.serial.slice(0, 7)) <= s.to).length;
const isUnused = (d: Db, s: Stock) => used(s) === 0 && s.voided === 0 && issuedFrom(d, s) === 0;
const assigneeLabel = (d: Db, s: Pick<Stock, "assigneeType" | "assignee">) => (s.assigneeType === "station" ? s.assignee : customerName(d, s.assignee));

export default function AwbStock() {
  const d = useDb(); const t = useT(); const can = useCan();
  const manage = can("master.manage");
  const [type, setType] = useState(""); const [state, setState] = useState("");
  const [edit, setEdit] = useState<Stock | "new" | null>(null); const [off, setOff] = useState<Stock | null>(null); const [del, setDel] = useState<Stock | null>(null);
  const rows = d.awbStock.filter((s) => (!type || s.assigneeType === type) && (!state || (state === "active" ? s.active : state === "inactive" ? !s.active : isLow(s))));
  const low = d.awbStock.filter(isLow);
  const live = d.awbStock.filter((s) => s.active);
  const cols: Col<Stock>[] = [
    { key: "range", header: t("ຊ່ວງເລກ", "Range"), mono: true, render: (s) => <span className="font-semibold">{s.prefix} {s.from}-{s.to}</span>, sort: (s) => s.from },
    { key: "who", header: t("ມອບໃຫ້", "Assigned to"), render: (s) => s.assigneeType === "station" ? <span className="whitespace-nowrap"><MonoCode className="font-semibold">{s.assignee}</MonoCode> <span className="text-xs text-ink-2">{t("ສະຖານີ", "Station")}</span></span> : <span className="line-clamp-1">{customerName(d, s.assignee)} <span className="text-xs text-ink-2">{t("ຕົວແທນ", "Agent")}</span></span>, sort: (s) => assigneeLabel(d, s) },
    { key: "next", header: t("ເລກຖັດໄປ", "Next AWB"), mono: true, render: (s) => left(s) > 0 ? fullNo(s, s.nextSerial) : "—", sort: (s) => s.nextSerial },
    { key: "used", header: t("ໃຊ້ແລ້ວ", "Used"), align: "right", render: (s) => num(used(s)), sort: (s) => used(s) },
    { key: "left", header: t("ເຫຼືອ", "Remaining"), align: "right", render: (s) => num(left(s)), sort: (s) => left(s) },
    { key: "void", header: t("ຍົກເລີກ", "Voided"), align: "right", render: (s) => num(s.voided), sort: (s) => s.voided },
    { key: "meter", header: t("ການໃຊ້", "Usage"), width: "130px", render: (s) => <div className="flex items-center gap-2"><div className="flex-1"><BarMeter value={used(s)} max={total(s)} label={t(`ໃຊ້ແລ້ວ ${used(s)} ຈາກ ${total(s)}`, `${used(s)} of ${total(s)} used`)} /></div><span className="tnum text-xs text-ink-2">{Math.round((used(s) / total(s)) * 100)}%</span></div>, sort: (s) => used(s) / total(s) },
    { key: "status", header: t("ສະຖານະ", "Status"), render: (s) => !s.active ? <Badge>{t("ປິດໃຊ້", "Inactive")}</Badge> : left(s) === 0 ? <Badge tone="bad">{t("ໝົດແລ້ວ", "Used up")}</Badge> : isLow(s) ? <Badge tone="warn">{t("ໃກ້ໝົດ", "Running low")}</Badge> : <Badge tone="ok">{t("ໃຊ້ງານ", "Active")}</Badge>, sort: (s) => (s.active ? left(s) / total(s) : -1) },
    ...(manage ? [{ key: "act", header: "", align: "right" as const, render: (s: Stock) => <span className="inline-flex">
      <IconButton icon={Pencil} label={t("ແກ້ໄຂຊ່ວງເລກ", "Edit range")} onClick={() => setEdit(s)} />
      {s.active ? <IconButton icon={Ban} label={t("ປິດໃຊ້ຊ່ວງເລກ", "Deactivate range")} onClick={() => setOff(s)} /> : <IconButton icon={CheckCircle2} label={t("ເປີດໃຊ້ຊ່ວງເລກ", "Reactivate range")} onClick={() => { updateStock(s.id, { active: true }); toast(t("ເປີດໃຊ້ຊ່ວງເລກແລ້ວ", "Range reactivated")); }} />}
      <IconButton icon={Trash2} label={t("ລຶບຊ່ວງເລກ", "Delete range")} onClick={() => setDel(s)} />
    </span> }] : []),
  ];
  const lastOfStation = off && off.assigneeType === "station" && !d.awbStock.some((s) => s.id !== off.id && s.active && s.assigneeType === "station" && s.assignee === off.assignee && left(s) > 0);
  const delUnused = del ? isUnused(d, del) : false;
  const example = 4410123;
  return <>
    <PageHeader title={t("ຊ່ວງເລກ AWB", "AWB ranges")} subtitle={t(`ຈັດສັນເລກ AWB ຄໍານໍາໜ້າ ${PREFIX} ໃຫ້ສະຖານີ ຫຼື ຕົວແທນ.`, `Allocate AWB numbers with prefix ${PREFIX} to stations or agents.`)} actions={manage && <Button variant="primary" icon={Plus} onClick={() => setEdit("new")}>{t("ຈັດສັນຊ່ວງເລກ", "Allocate range")}</Button>} />
    <StatRow items={[
      { label: t("ຊ່ວງທີ່ໃຊ້ງານ", "Active ranges"), value: live.length, sub: t(`ຈາກທັງໝົດ ${d.awbStock.length}`, `of ${d.awbStock.length} in total`) },
      { label: t("ເລກທີ່ເຫຼືອ", "Numbers remaining"), value: num(live.reduce((n, s) => n + left(s), 0)) },
      { label: t("ໃຊ້ແລ້ວ", "Numbers used"), value: num(d.awbStock.reduce((n, s) => n + used(s), 0)) },
      { label: t("ຍົກເລີກ", "Voided"), value: num(d.awbStock.reduce((n, s) => n + s.voided, 0)) },
      { label: t("ໃກ້ໝົດ", "Running low"), value: low.length, tone: low.length ? "warn" : undefined, sub: t("ເຫຼືອບໍ່ເຖິງ 10%", "Under 10% left") },
    ]} />
    <div className="mb-4 space-y-2">
      {low.length > 0 && <Callout tone="warn" title={t("ຊ່ວງເລກໃກ້ໝົດ", "Ranges running low")} action={manage ? <Button size="sm" onClick={() => setEdit("new")}>{t("ຈັດສັນເພີ່ມ", "Allocate more")}</Button> : undefined}>{low.map((s) => t(`${assigneeLabel(d, s)} ເຫຼືອ ${num(left(s))} ເລກ`, `${assigneeLabel(d, s)} has ${num(left(s))} left`)).join(", ")}. {t("ກະລຸນາຈັດສັນຊ່ວງໃໝ່ກ່ອນເລກໝົດ.", "Allocate a new range before the numbers run out.")}</Callout>}
      <Callout tone="info" title={t("ໂຄງສ້າງເລກ AWB", "How AWB numbers work")}>{t(`ເລກລໍາດັບ 7 ຫຼັກ ບວກເລກກວດ 1 ຫຼັກ. ເລກກວດແມ່ນເສດທີ່ເຫຼືອຈາກການຫານເລກລໍາດັບດ້ວຍ 7. ຕົວຢ່າງ ${example} ÷ 7 ເຫຼືອ ${example % 7} ຈຶ່ງໄດ້ ${awbNo(PREFIX, withCheckDigit(example))}.`, `A 7-digit serial plus 1 check digit. The check digit is the remainder of the serial divided by 7. For example, ${example} ÷ 7 leaves ${example % 7}, giving ${awbNo(PREFIX, withCheckDigit(example))}.`)}</Callout>
      {!manage && <Callout tone="info">{t("ທ່ານເບິ່ງໄດ້ຢ່າງດຽວ. ການຈັດສັນຕ້ອງມີສິດຈັດການຂໍ້ມູນພື້ນຖານ.", "You can view this list. Allocating needs the Manage master data permission.")}</Callout>}
    </div>
    <Panel flush>
      <DataTable rows={rows} columns={cols} rowKey={(s) => s.id} minWidth={1100} defaultSort={{ key: "range", dir: "asc" }} search={(s) => `${s.prefix} ${s.from} ${s.to} ${assigneeLabel(d, s)}`}
        filters={<>
          <Select aria-label={t("ປະເພດຜູ້ຮັບ", "Assignee type")} className="w-auto" value={type} onChange={(e) => setType(e.target.value)} placeholder={t("ສະຖານີ ແລະ ຕົວແທນ", "Stations and agents")} options={[{ value: "station", label: t("ສະຖານີ", "Station") }, { value: "agent", label: t("ຕົວແທນ", "Agent") }]} />
          <Select aria-label={t("ສະຖານະ", "Status")} className="w-auto" value={state} onChange={(e) => setState(e.target.value)} placeholder={t("ທຸກສະຖານະ", "All statuses")} options={[{ value: "active", label: t("ໃຊ້ງານ", "Active") }, { value: "low", label: t("ໃກ້ໝົດ", "Running low") }, { value: "inactive", label: t("ປິດໃຊ້", "Inactive") }]} />
        </>} />
    </Panel>
    {edit && <StockForm stock={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
    <Confirm open={!!off} onClose={() => setOff(null)} danger title={t("ປິດໃຊ້ຊ່ວງເລກນີ້?", "Deactivate this range?")} confirmLabel={t("ປິດໃຊ້ຊ່ວງເລກ", "Deactivate range")} body={off && <>
      <p><MonoCode>{off.prefix} {off.from}-{off.to}</MonoCode> · {assigneeLabel(d, off)}. {t(`ເລກທີ່ເຫຼືອ ${num(left(off))} ເລກຈະບໍ່ຖືກອອກ ຈົນກວ່າຈະເປີດໃຊ້ຄືນ.`, `The ${num(left(off))} remaining numbers will not be issued until you reactivate it.`)}</p>
      {lastOfStation && <div className="mt-2"><Callout tone="warn">{t(`ນີ້ແມ່ນຊ່ວງສຸດທ້າຍຂອງ ${off.assignee}. ຫຼັງປິດໃຊ້ ສະຖານີນີ້ຈະອອກ AWB ບໍ່ໄດ້.`, `This is the last range for ${off.assignee}. The station cannot issue AWBs after this.`)}</Callout></div>}
    </>} onConfirm={() => { if (off) { updateStock(off.id, { active: false }); toast(t("ປິດໃຊ້ຊ່ວງເລກແລ້ວ", "Range deactivated")); } }} />
    <Dialog open={!!del && !delUnused} onClose={() => setDel(null)} size="sm" title={t("ລຶບຊ່ວງເລກນີ້ບໍ່ໄດ້", "This range cannot be deleted")} footer={<><Button onClick={() => setDel(null)}>{t("ປິດ", "Close")}</Button>{del?.active && <Button variant="primary" onClick={() => { setOff(del); setDel(null); }}>{t("ປິດໃຊ້ແທນ", "Deactivate instead")}</Button>}</>}>
      {del && <p className="text-sm">{t(`ຊ່ວງນີ້ຖືກໃຊ້ແລ້ວ ${num(used(del))} ເລກ ແລະ ຍົກເລີກ ${num(del.voided)} ເລກ. ເລກ AWB ຕ້ອງກວດສອບຍ້ອນຫຼັງໄດ້ ຈຶ່ງລຶບໄດ້ສະເພາະຊ່ວງທີ່ຍັງບໍ່ໄດ້ໃຊ້.`, `${num(used(del))} numbers from this range are used and ${num(del.voided)} are voided. AWB numbers must stay traceable, so only an unused range can be deleted.`)}</p>}
    </Dialog>
    <Confirm open={!!del && delUnused} onClose={() => setDel(null)} danger title={t("ລຶບຊ່ວງເລກນີ້?", "Delete this range?")} body={del && <><MonoCode>{del.prefix} {del.from}-{del.to}</MonoCode> · {t("ຍັງບໍ່ໄດ້ໃຊ້ເລກໃດ.", "No numbers have been used.")}</>} confirmLabel={t("ລຶບຊ່ວງເລກ", "Delete range")} onConfirm={() => { if (del) { deleteStock(del.id); toast(t("ລຶບຊ່ວງເລກແລ້ວ", "Range deleted")); } }} />
  </>;
}

function StockForm({ stock, onClose }: { stock?: Stock; onClose: () => void }) {
  const d = useDb(); const t = useT(); const name = useName();
  const nextFree = Math.max(0, ...d.awbStock.filter((s) => s.prefix === PREFIX).map((s) => s.to)) + 1;
  const [from, setFrom] = useState(String(stock?.from ?? nextFree)); const [to, setTo] = useState(stock ? String(stock.to) : "");
  const [type, setType] = useState<Stock["assigneeType"]>(stock?.assigneeType ?? "station"); const [assignee, setAssignee] = useState(stock?.assignee ?? "");
  const [tried, setTried] = useState(false); const [serverErr, setServerErr] = useState("");
  const a = Number(from); const b = Number(to);
  const has = stock ? used(stock) > 0 || stock.voided > 0 : false;
  const seven = (s: string) => /^\d{7}$/.test(s);
  const clash = seven(from) && seven(to) && a <= b ? d.awbStock.find((s) => s.id !== stock?.id && s.prefix === PREFIX && a <= s.to && b >= s.from) : undefined;
  const errs = {
    from: !seven(from) ? t("ກະລຸນາປ້ອນເລກລໍາດັບ 7 ຫຼັກ", "Enter a 7-digit serial") : "",
    to: !seven(to) ? t("ກະລຸນາປ້ອນເລກລໍາດັບ 7 ຫຼັກ", "Enter a 7-digit serial") : b < a ? t("ເລກສຸດທ້າຍຕ້ອງບໍ່ນ້ອຍກວ່າເລກທໍາອິດ", "The last serial cannot be lower than the first") : stock && b < stock.nextSerial - 1 ? t(`ເລກ ${stock.nextSerial - 1} ຖືກໃຊ້ແລ້ວ. ເລກສຸດທ້າຍຕ້ອງບໍ່ຕໍ່າກວ່ານີ້`, `Serial ${stock.nextSerial - 1} is already used, so the last serial cannot be lower`) : "",
    clash: clash ? t(`ຊ່ວງນີ້ທັບກັບ ${clash.prefix} ${clash.from}-${clash.to} ຂອງ ${assigneeLabel(d, clash)}. ເລກຫວ່າງຖັດໄປແມ່ນ ${nextFree}.`, `This overlaps ${clash.prefix} ${clash.from}-${clash.to} held by ${assigneeLabel(d, clash)}. The next free serial is ${nextFree}.`) : "",
    assignee: assignee ? "" : type === "station" ? t("ກະລຸນາເລືອກສະຖານີ", "Choose a station") : t("ກະລຸນາເລືອກຕົວແທນ", "Choose an agent"),
  };
  const size = seven(from) && seven(to) && b >= a ? b - a + 1 : 0;
  const save = () => {
    setTried(true); setServerErr(""); if (Object.values(errs).some(Boolean)) return;
    if (stock) {
      updateStock(stock.id, { from: a, to: b, assigneeType: type, assignee, nextSerial: has ? stock.nextSerial : a });
      toast(t("ບັນທຶກຊ່ວງເລກແລ້ວ", "Range saved")); onClose(); return;
    }
    const r = allocateStock({ prefix: PREFIX, from: a, to: b, assigneeType: type, assignee });
    if (!r.ok) { setServerErr(r.error === "overlap" ? t("ຊ່ວງນີ້ທັບກັບຊ່ວງທີ່ມີຢູ່ແລ້ວ. ກະລຸນາປ່ຽນເລກ.", "This range overlaps an existing one. Change the serials.") : t("ເລກສຸດທ້າຍຕ້ອງບໍ່ນ້ອຍກວ່າເລກທໍາອິດ.", "The last serial cannot be lower than the first.")); return; }
    toast(t(`ຈັດສັນ ${num(size)} ເລກແລ້ວ`, `${num(size)} numbers allocated`)); onClose();
  };
  const stations = d.stations.filter((s) => s.active || s.code === assignee).map((s) => ({ value: s.code, label: `${s.code} · ${name(s)}` }));
  const agents = d.customers.filter((c) => c.type === "agent" && (c.active || c.id === assignee)).map((c) => ({ value: c.id, label: `${c.code} · ${t(c.name, c.nameEn)}` }));
  return <Dialog open onClose={onClose} title={stock ? t("ແກ້ໄຂຊ່ວງເລກ", "Edit range") : t("ຈັດສັນຊ່ວງເລກ AWB", "Allocate an AWB range")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{stock ? t("ບັນທຶກການແກ້ໄຂ", "Save changes") : t("ຈັດສັນຊ່ວງເລກ", "Allocate range")}</Button></>}>
    {has && <div className="mb-3"><Callout tone="info">{t("ຊ່ວງນີ້ໃຊ້ໄປແລ້ວ ຈຶ່ງປ່ຽນເລກທໍາອິດບໍ່ໄດ້. ເລກທີ່ໃຊ້ແລ້ວຍັງເປັນຂອງຜູ້ຮັບເດີມ.", "This range is in use, so the first serial is locked. Numbers already issued stay with their AWBs.")}</Callout></div>}
    {tried && (errs.clash || serverErr) && <div className="mb-3"><Callout tone="bad" title={t("ຊ່ວງເລກນີ້ໃຊ້ບໍ່ໄດ້", "This range cannot be used")}>{errs.clash || serverErr}</Callout></div>}
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label={t("ຄໍານໍາໜ້າ", "Prefix")} hint={t("ລະຫັດສາຍການບິນ", "Airline code")}><Input className="font-mono" disabled value={PREFIX} /></Field>
      <Field label={t("ເລກທໍາອິດ", "First serial")} required error={tried && errs.from || undefined}><Input className="font-mono" inputMode="numeric" maxLength={7} value={from} disabled={has} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} /></Field>
      <Field label={t("ເລກສຸດທ້າຍ", "Last serial")} required error={tried && errs.to || undefined}><Input className="font-mono" inputMode="numeric" maxLength={7} value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))} /></Field>
    </div>
    <p className="tnum mt-2 text-xs text-ink-2">{size > 0 ? t(`${num(size)} ເລກ: ${awbNo(PREFIX, withCheckDigit(a))} ຫາ ${awbNo(PREFIX, withCheckDigit(b))}`, `${num(size)} numbers: ${awbNo(PREFIX, withCheckDigit(a))} to ${awbNo(PREFIX, withCheckDigit(b))}`) : t("ປ້ອນເລກລໍາດັບ 7 ຫຼັກ. ລະບົບເພີ່ມເລກກວດ modulo-7 ໃຫ້ເອງ.", "Enter 7-digit serials. The system adds the modulo-7 check digit.")}</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <Field label={t("ມອບໃຫ້", "Assign to")} required><Select value={type} onChange={(e) => { setType(e.target.value as Stock["assigneeType"]); setAssignee(""); }} options={[{ value: "station", label: t("ສະຖານີ", "Station") }, { value: "agent", label: t("ຕົວແທນ", "Agent") }]} /></Field>
      <Field label={type === "station" ? t("ສະຖານີ", "Station") : t("ຕົວແທນ", "Agent")} required error={tried && errs.assignee || undefined}><Select value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder={t("ເລືອກ", "Choose")} options={type === "station" ? stations : agents} /></Field>
    </div>
    {type === "agent" && agents.length === 0 && <p className="mt-2 text-sm text-ink-2">{t("ຍັງບໍ່ມີຕົວແທນ.", "There are no agents yet.")} <Link className="text-brand hover:underline" to="/crm">{t("ເພີ່ມໃນໜ້າລູກຄ້າ", "Add one under Customers")}</Link></p>}
  </Dialog>;
}
