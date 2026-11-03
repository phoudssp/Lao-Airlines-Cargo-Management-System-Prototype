import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightLeft, Pencil, Plus, Snowflake, Trash2, Warehouse } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { bi, useName, useT } from "@/lib/i18n";
import { Badge, BarMeter, Button, Callout, Checkbox, Col, Confirm, cx, DataTable, Dialog, Empty, Field, Input, PageHeader, Panel, Select, StatRow, toast } from "@/ui/kit";
import { AwbLink, AwbStrip, Route, ShcTags } from "@/ui/cargo";
import type { Awb, Db, Zone, ZoneType } from "@/lib/types";
import { daysBetween, kg, num, todayIso } from "@/lib/format";
import { moveToZone, zoneLoad } from "@/lib/mock/ops";
import { newId, removeFrom, upsert } from "@/lib/mock/master";

const TYPES: { key: ZoneType; lo: string; en: string }[] = [{ key: "general", lo: "ສິນຄ້າທົ່ວໄປ", en: "General cargo" }, { key: "cold", lo: "ຫ້ອງເຢັນ", en: "Cold" }, { key: "valuable", lo: "ສິນຄ້າມີຄ່າ", en: "Valuables" }, { key: "dg", lo: "ສິນຄ້າອັນຕະລາຍ", en: "Dangerous goods" }, { key: "mail", lo: "ຖົງເມ", en: "Mail" }, { key: "transit", lo: "ຖ່າຍລໍາ", en: "Transit" }];
const daysIn = (a: Awb) => Math.max(0, daysBetween(a.arrivedAt ?? a.issuedAt, todayIso()));
const misplaced = (d: Db, st: string) => d.zones.filter((z) => z.station === st && z.type !== "cold").flatMap((z) => zoneLoad(d, z.id).list.filter((a) => a.shc.includes("PER")));

export default function Storage() {
  const d = useDb(); const t = useT(); const name = useName(); const can = useCan(); const st = d.session.station;
  const canEdit = can("wms.operate") || can("master.manage"); const canMove = can("wms.operate");
  const comm = (a: Awb) => a.commodity.split(" / ")[t("0", "1") === "0" ? 0 : 1] ?? a.commodity;
  const zones = useMemo(() => d.zones.filter((z) => z.station === st), [d.zones, st]);
  const [selId, setSel] = useState<string | null>(null); const [editing, setEditing] = useState<Zone | "new" | null>(null); const [askDelete, setAskDelete] = useState(false); const [moving, setMoving] = useState<string | null>(null); const [showCold, setShowCold] = useState(false);
  const loads = useMemo(() => Object.fromEntries(zones.map((z) => [z.id, zoneLoad(d, z.id)])), [d, zones]);
  const sel = zones.find((z) => z.id === selId) ?? zones.find((z) => loads[z.id]?.list.length) ?? zones[0];
  const totalCap = zones.filter((z) => z.active).reduce((s, z) => s + z.capacityKg, 0); const totalKg = zones.reduce((s, z) => s + (loads[z.id]?.kg ?? 0), 0); const totalAwb = zones.reduce((s, z) => s + (loads[z.id]?.list.length ?? 0), 0);
  const wrongPlace = misplaced(d, st);
  const list = sel ? loads[sel.id]?.list ?? [] : [];
  const mailHere = sel?.type === "mail" ? d.mail.filter((m) => (m.status === "received" && m.origin === st) || (m.status === "arrived" && m.dest === st)) : [];
  const cols: Col<Awb>[] = [
    { key: "no", header: t("ເລກ AWB", "AWB number"), render: (a) => <AwbLink awb={a} />, sort: (a) => a.no },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (a) => <Route from={a.origin} to={a.dest} /> },
    { key: "comm", header: t("ສິນຄ້າ", "Commodity"), render: (a) => <span className="inline-flex flex-wrap items-center gap-1.5"><span className="line-clamp-1">{comm(a)}</span><ShcTags codes={a.shc} />{a.shc.includes("PER") && sel?.type !== "cold" && <Badge tone="bad">{t("ຕ້ອງເກັບຫ້ອງເຢັນ", "Needs cold zone")}</Badge>}</span> },
    { key: "pcs", header: t("ກ່ອງ", "Pcs"), align: "right", render: (a) => a.pieces, sort: (a) => a.pieces },
    { key: "kg", header: t("ນໍ້າໜັກ", "Gross"), align: "right", render: (a) => kg(a.grossKg), sort: (a) => a.grossKg },
    { key: "days", header: t("ວັນໃນສາງ", "Days in store"), align: "right", render: (a) => <span className={cx(daysIn(a) > 85 ? "font-semibold text-bad" : daysIn(a) > 30 && "text-warn")}>{daysIn(a)}</span>, sort: daysIn },
    { key: "stage", header: t("ສະຖານະ", "Status"), render: (a) => <AwbStrip awb={a} /> },
    { key: "act", header: "", align: "right", render: (a) => <Button size="sm" icon={ArrowRightLeft} disabled={!canMove} title={canMove ? undefined : t("ບົດບາດຂອງທ່ານຍ້າຍສິນຄ້າບໍ່ໄດ້", "Your role cannot move cargo")} onClick={() => setMoving(a.id)}>{t("ຍ້າຍໂຊນ", "Move")}</Button> },
  ];
  return <>
    <PageHeader title={t("ໂຊນ ແລະ ຕໍາແໜ່ງໃນສາງ", "Zones and storage")} subtitle={t(`ການໃຊ້ພື້ນທີ່ສາງ ຢູ່ສະຖານີ ${st}, ວັດເປັນນໍ້າໜັກທຽບກັບຄວາມຈຸ`, `Warehouse space at ${st}, measured as weight against capacity`)} actions={canEdit ? <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>{t("ເພີ່ມໂຊນ", "Add zone")}</Button> : undefined} />
    <StatRow items={[
      { label: t("ໃຊ້ພື້ນທີ່ແລ້ວ", "Space in use"), value: totalCap ? `${num((totalKg / totalCap) * 100)}%` : "—", sub: t(`${num(totalKg)} ຈາກ ${num(totalCap)} kg`, `${num(totalKg)} of ${num(totalCap)} kg`), tone: totalCap && totalKg / totalCap >= 0.95 ? "bad" : totalCap && totalKg / totalCap >= 0.8 ? "warn" : undefined },
      { label: t("AWB ໃນສາງ", "AWBs in store"), value: totalAwb },
      { label: t("ໂຊນທີ່ໃກ້ເຕັມ", "Zones nearly full"), value: zones.filter((z) => z.active && (loads[z.id]?.kg ?? 0) / z.capacityKg >= 0.8).length, sub: t("ຕັ້ງແຕ່ 80% ຂຶ້ນໄປ", "80% or more") },
      { label: t("ສິນຄ້າເນົ່າເສຍງ່າຍ ຢູ່ນອກຫ້ອງເຢັນ", "Perishables outside cold"), value: wrongPlace.length, tone: wrongPlace.length ? "bad" : "ok" },
    ]} />
    {wrongPlace.length > 0 && <div className="mb-4"><Callout tone="bad" title={t(`ສິນຄ້າເນົ່າເສຍງ່າຍ ${wrongPlace.length} AWB ຢູ່ນອກຫ້ອງເຢັນ`, `${wrongPlace.length} perishable AWB(s) outside a cold zone`)} action={<Button size="sm" icon={Snowflake} onClick={() => setShowCold(true)}>{t("ກວດ ແລະ ຍ້າຍ", "Review and move")}</Button>}>{t("ຍ້າຍເຂົ້າຫ້ອງເຢັນໂດຍໄວ ເພື່ອປ້ອງກັນສິນຄ້າເສຍ.", "Move them to a cold zone soon so the cargo does not spoil.")}</Callout></div>}
    {zones.length === 0 ? <Panel><Empty icon={Warehouse} title={t(`ສະຖານີ ${st} ຍັງບໍ່ມີໂຊນ`, `${st} has no zones yet`)} action={canEdit ? <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>{t("ເພີ່ມໂຊນທໍາອິດ", "Add the first zone")}</Button> : undefined}>{t("ເພີ່ມໂຊນເພື່ອກໍານົດຕໍາແໜ່ງວາງສິນຄ້າ ແລະ ຕິດຕາມການໃຊ້ພື້ນທີ່.", "Add zones to place cargo and track space use.")}</Empty></Panel> : <>
      <Panel flush title={t("ຜັງສາງ", "Warehouse layout")} className="mb-4">
        {TYPES.filter((ty) => zones.some((z) => z.type === ty.key)).map((ty) => <div key={ty.key} className="border-b border-line last:border-0">
          <div className="bg-surface-2 px-4 py-1 text-xs font-semibold text-ink-2">{t(ty.lo, ty.en)}</div>
          <div className="grid gap-px bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-4">{zones.filter((z) => z.type === ty.key).map((z) => { const l = loads[z.id]; const pct = z.capacityKg ? (l.kg / z.capacityKg) * 100 : 0; const on = sel?.id === z.id; return <button key={z.id} onClick={() => setSel(z.id)} aria-pressed={on} className={cx("min-w-0 px-4 py-2.5 text-left transition-colors", on ? "bg-brand-soft" : "bg-surface hover:bg-surface-2")}>
            <div className="flex items-baseline justify-between gap-2"><span className="font-mono text-[15px] font-semibold">{z.code}</span><span className={cx("tnum text-sm font-semibold", pct > 100 || pct >= 95 ? "text-bad" : pct >= 80 ? "text-warn" : "text-ink")}>{num(pct)}%</span></div>
            <div className="mb-1.5 truncate text-sm text-ink-2">{name(z)}</div>
            <BarMeter value={l.kg} max={z.capacityKg} label={`${z.code} ${num(pct)}%`} />
            <div className="tnum mt-1 flex justify-between gap-2 text-xs text-ink-2"><span>{num(l.kg)} / {num(z.capacityKg)} kg</span><span>{!z.active ? t("ປິດໃຊ້", "Inactive") : pct > 100 ? t("ເກີນຄວາມຈຸ", "Over capacity") : `${l.list.length} AWB`}</span></div>
          </button>; })}</div>
        </div>)}
      </Panel>
      {sel && <Panel flush title={<span><span className="font-mono">{sel.code}</span> · {name(sel)}</span>} actions={canEdit && <>
        {list.length > 0 && <span className="text-xs text-ink-2">{t(`ຍ້າຍສິນຄ້າ ${list.length} AWB ອອກກ່ອນ ຈຶ່ງລຶບໄດ້`, `Move ${list.length} AWB(s) out before deleting`)}</span>}
        <Button size="sm" icon={Pencil} onClick={() => setEditing(sel)}>{t("ແກ້ໄຂໂຊນ", "Edit zone")}</Button>
        <Button size="sm" variant="danger" icon={Trash2} disabled={list.length > 0} onClick={() => setAskDelete(true)}>{t("ລຶບໂຊນ", "Delete zone")}</Button>
      </>}>
        {mailHere.length > 0 && <div className="border-b border-line px-4 py-2 text-sm text-ink-2">{t(`ມີຖົງເມ ${mailHere.reduce((s, m) => s + m.bags, 0)} ຖົງ (${kg(mailHere.reduce((s, m) => s + m.weightKg, 0))}) ໃນຫ້ອງນີ້.`, `${mailHere.reduce((s, m) => s + m.bags, 0)} mail bags (${kg(mailHere.reduce((s, m) => s + m.weightKg, 0))}) are in this room.`)} <Link to="/wms/mail" className="font-medium text-brand hover:underline">{t("ເບິ່ງຖົງເມ", "View mail bags")}</Link></div>}
        <DataTable key={sel.id} rows={list} columns={cols} rowKey={(a) => a.id} pageSize={10} minWidth={960} defaultSort={{ key: "days", dir: "desc" }} search={(a) => `${a.prefix}${a.serial} ${a.commodity} ${a.dest}`} empty={<Empty title={t("ໂຊນນີ້ວ່າງຢູ່", "This zone is empty")}>{t("ສິນຄ້າຈະປາກົດຢູ່ນີ້ ເມື່ອຮັບເຂົ້າສາງ ຫຼື ຍ້າຍມາໂຊນນີ້.", "Cargo shows here once it is received into or moved to this zone.")}</Empty>} />
      </Panel>}
    </>}
    {editing && <ZoneDialog zone={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={(id) => setSel(id)} />}
    {sel && <Confirm open={askDelete} onClose={() => setAskDelete(false)} danger title={t(`ລຶບໂຊນ ${sel.code}?`, `Delete zone ${sel.code}?`)} body={t("ໂຊນນີ້ບໍ່ມີສິນຄ້າແລ້ວ. ການລຶບນີ້ບັນທຶກໄວ້ໃນ Audit Trail.", "This zone holds no cargo. The deletion is kept in the audit trail.")} confirmLabel={t("ລຶບໂຊນ", "Delete zone")} onConfirm={() => { if (zoneLoad(d, sel.id).list.length) { toast(t("ໂຊນນີ້ຍັງມີສິນຄ້າ. ຍ້າຍອອກກ່ອນ.", "This zone still holds cargo. Move it out first."), "bad"); return; } removeFrom("zones", sel.id); setSel(null); toast(t("ລຶບໂຊນແລ້ວ", "Zone deleted")); }} />}
    {moving && <MoveDialog awbId={moving} onClose={() => setMoving(null)} />}
    {showCold && <ColdDialog onClose={() => setShowCold(false)} />}
  </>;
}

function ZoneDialog({ zone, onClose, onSaved }: { zone?: Zone; onClose: () => void; onSaved: (id: string) => void }) {
  const d = useDb(); const t = useT(); const st = d.session.station;
  const [code, setCode] = useState(zone?.code ?? ""); const [nameLo, setLo] = useState(zone?.nameLo ?? ""); const [nameEn, setEn] = useState(zone?.nameEn ?? ""); const [type, setType] = useState<ZoneType>(zone?.type ?? "general"); const [cap, setCap] = useState(String(zone?.capacityKg ?? "")); const [active, setActive] = useState(zone?.active ?? true); const [tried, setTried] = useState(false);
  const clean = code.trim().toUpperCase(); const dup = d.zones.some((z) => z.station === st && z.code === clean && z.id !== zone?.id); const capN = Number(cap);
  const errs = { code: !clean || dup, lo: !nameLo.trim(), en: !nameEn.trim(), cap: !(capN > 0) };
  function save() { setTried(true); if (Object.values(errs).some(Boolean)) return; const id = zone?.id ?? newId("Z"); upsert("zones", { id, station: st, code: clean, nameLo: nameLo.trim(), nameEn: nameEn.trim(), type, capacityKg: capN, active }, !zone); onSaved(id); toast(zone ? t("ບັນທຶກໂຊນແລ້ວ", "Zone saved") : t("ເພີ່ມໂຊນແລ້ວ", "Zone added")); onClose(); }
  return <Dialog open onClose={onClose} title={zone ? t(`ແກ້ໄຂໂຊນ ${zone.code}`, `Edit zone ${zone.code}`) : t(`ເພີ່ມໂຊນທີ່ ${st}`, `Add a zone at ${st}`)} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{zone ? t("ບັນທຶກ", "Save") : t("ເພີ່ມໂຊນ", "Add zone")}</Button></>}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("ລະຫັດໂຊນ", "Zone code")} required error={tried && errs.code ? (dup ? t(`ລະຫັດ ${clean} ມີແລ້ວໃນສະຖານີນີ້. ໃຊ້ລະຫັດອື່ນ.`, `${clean} already exists at this station. Use another code.`) : t("ໃສ່ລະຫັດໂຊນ ເຊັ່ນ A2.", "Enter a code such as A2.")) : undefined}><Input className="font-mono" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
      <Field label={t("ປະເພດ", "Type")}><Select value={type} onChange={(e) => setType(e.target.value as ZoneType)} options={TYPES.map((x) => ({ value: x.key, label: t(x.lo, x.en) }))} /></Field>
      <Field label={t("ຊື່ພາສາລາວ", "Lao name")} required error={tried && errs.lo ? t("ໃສ່ຊື່ພາສາລາວ.", "Enter the Lao name.") : undefined}><Input value={nameLo} onChange={(e) => setLo(e.target.value)} /></Field>
      <Field label={t("ຊື່ພາສາອັງກິດ", "English name")} required error={tried && errs.en ? t("ໃສ່ຊື່ພາສາອັງກິດ.", "Enter the English name.") : undefined}><Input value={nameEn} onChange={(e) => setEn(e.target.value)} /></Field>
      <Field label={t("ຄວາມຈຸ (kg)", "Capacity (kg)")} required error={tried && errs.cap ? t("ໃສ່ຄວາມຈຸທີ່ຫຼາຍກວ່າ 0.", "Enter a capacity above 0.") : undefined}><Input type="number" min={1} value={cap} onChange={(e) => setCap(e.target.value)} /></Field>
      <div className="self-end pb-2"><Checkbox label={t("ເປີດໃຊ້ໂຊນນີ້", "Zone is in use")} checked={active} onChange={setActive} /></div>
    </div>
  </Dialog>;
}

function MoveDialog({ awbId, onClose }: { awbId: string; onClose: () => void }) {
  const d = useDb(); const t = useT(); const a = d.awbs.find((x) => x.id === awbId)!; const st = d.session.station;
  const options = d.zones.filter((z) => z.station === st && z.active && z.id !== a.zoneId); const [to, setTo] = useState(""); const z = options.find((x) => x.id === to); const load = z ? zoneLoad(d, z.id).kg : 0;
  return <Dialog open size="sm" onClose={onClose} title={t(`ຍ້າຍ ${a.no}`, `Move ${a.no}`)} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" disabled={!to} onClick={() => { moveToZone(a.id, to); toast(t(`ຍ້າຍໄປໂຊນ ${z?.code} ແລ້ວ`, `Moved to zone ${z?.code}`)); onClose(); }}>{t("ຍ້າຍສິນຄ້າ", "Move cargo")}</Button></>}>
    <div className="grid gap-3">
      <p className="text-sm">{t(`${a.pieces} ກ່ອງ, ${kg(a.grossKg)}. ປະຈຸບັນຢູ່ໂຊນ ${d.zones.find((x) => x.id === a.zoneId)?.code ?? "—"}.`, `${a.pieces} pieces, ${kg(a.grossKg)}. Now in zone ${d.zones.find((x) => x.id === a.zoneId)?.code ?? "—"}.`)}</p>
      <Field label={t("ຍ້າຍໄປໂຊນ", "Move to zone")} required><Select value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("ເລືອກໂຊນ", "Choose a zone")} options={options.map((x) => ({ value: x.id, label: `${x.code} · ${t(x.nameLo, x.nameEn)} (${num(zoneLoad(d, x.id).kg)}/${num(x.capacityKg)} kg)` }))} /></Field>
      {z && load + a.grossKg > z.capacityKg && <Callout tone="warn">{t(`ໂຊນ ${z.code} ຈະເກີນຄວາມຈຸ.`, `Zone ${z.code} goes over capacity.`)}</Callout>}
      {z && a.shc.includes("PER") && z.type !== "cold" && <Callout tone="bad">{t("ສິນຄ້ານີ້ເນົ່າເສຍງ່າຍ ຄວນເກັບໃນຫ້ອງເຢັນ.", "This cargo is perishable and belongs in a cold zone.")}</Callout>}
    </div>
  </Dialog>;
}

function ColdDialog({ onClose }: { onClose: () => void }) {
  const d = useDb(); const t = useT(); const st = d.session.station; const can = useCan(); const canMove = can("wms.operate");
  const list = misplaced(d, st); const cold = d.zones.filter((z) => z.station === st && z.active && z.type === "cold")[0];
  return <Dialog open size="lg" onClose={onClose} title={t("ສິນຄ້າເນົ່າເສຍງ່າຍ ຢູ່ນອກຫ້ອງເຢັນ", "Perishables outside a cold zone")} footer={<><Button onClick={onClose}>{t("ປິດ", "Close")}</Button>{cold && canMove && list.length > 0 && <Button variant="primary" icon={Snowflake} onClick={() => { list.forEach((a) => moveToZone(a.id, cold.id)); toast(t(`ຍ້າຍ ${list.length} AWB ເຂົ້າ ${cold.code} ແລ້ວ`, `Moved ${list.length} AWB(s) to ${cold.code}`)); onClose(); }}>{t(`ຍ້າຍທັງໝົດເຂົ້າ ${cold.code}`, `Move all to ${cold.code}`)}</Button>}</>}>
    {!cold && <div className="mb-3"><Callout tone="warn">{t("ສະຖານີນີ້ບໍ່ມີຫ້ອງເຢັນ. ເພີ່ມໂຊນປະເພດຫ້ອງເຢັນກ່ອນ.", "This station has no cold zone. Add a zone of type Cold first.")}</Callout></div>}
    {list.length === 0 ? <Empty title={t("ສິນຄ້າເນົ່າເສຍງ່າຍທັງໝົດຢູ່ຫ້ອງເຢັນແລ້ວ", "All perishables are in a cold zone")} /> : <ul className="divide-y divide-line">{list.map((a) => <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"><AwbLink awb={a} /><span className="font-mono text-[13px]">{d.zones.find((z) => z.id === a.zoneId)?.code}</span><span className="min-w-0 flex-1">{bi(t, a.commodity)}</span><span className="tnum text-ink-2">{kg(a.grossKg)}</span>{cold && <Button size="sm" disabled={!canMove} onClick={() => { moveToZone(a.id, cold.id); toast(t(`ຍ້າຍເຂົ້າ ${cold.code} ແລ້ວ`, `Moved to ${cold.code}`)); }}>{t(`ຍ້າຍເຂົ້າ ${cold.code}`, `Move to ${cold.code}`)}</Button>}</li>)}</ul>}
  </Dialog>;
}
