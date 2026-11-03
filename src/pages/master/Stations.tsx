import { useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useName, useT } from "@/lib/i18n";
import { Badge, BarMeter, Button, Callout, Checkbox, Col, Confirm, DataTable, Dialog, Dl, Field, IconButton, Input, MonoCode, PageHeader, Panel, Select, toast } from "@/ui/kit";
import type { Scope, Station } from "@/lib/types";
import { num } from "@/lib/format";
import { removeFrom, stationInUse, upsert } from "@/lib/mock/master";

const BLANK: Station = { code: "", nameLo: "", nameEn: "", countryEn: "Laos", scope: "domestic", branchLo: "", branchEn: "", phone: "", active: true };

export default function Stations() {
  const d = useDb(); const t = useT(); const name = useName(); const can = useCan();
  const manage = can("master.manage");
  const [scope, setScope] = useState(""); const [status, setStatus] = useState("");
  const [edit, setEdit] = useState<Station | "new" | null>(null); const [view, setView] = useState<string | null>(null); const [del, setDel] = useState<Station | null>(null);

  const ranges = (code: string) => d.awbStock.filter((s) => s.assigneeType === "station" && s.assignee === code);
  const remaining = (code: string) => ranges(code).filter((s) => s.active).reduce((n, s) => n + Math.max(0, s.to - s.nextSerial + 1), 0);
  const zones = (code: string) => d.zones.filter((z) => z.station === code);
  /** Everything that still points at a station, in words the user can act on. */
  const blockers = (code: string) => {
    const list: [number, string, string][] = [
      [d.awbs.filter((a) => a.origin === code || a.dest === code).length, "AWB", "AWBs"],
      [d.flights.filter((f) => f.origin === code || f.dest === code).length, "ຖ້ຽວບິນ", "flights"],
      [d.routes.filter((r) => r.origin === code || r.dest === code).length, "ເສັ້ນທາງ", "routes"],
      [d.users.filter((u) => u.station === code).length, "ຜູ້ໃຊ້", "users"],
      [zones(code).length, "ໂຊນໃນສາງ", "warehouse zones"],
      [ranges(code).length, "ຊ່ວງເລກ AWB", "AWB ranges"],
      [d.customers.filter((c) => c.station === code).length, "ລູກຄ້າ", "customers"],
    ];
    return list.filter(([n]) => n > 0).map(([n, lo, en]) => t(`${lo} ${num(n)} ລາຍການ`, `${num(n)} ${en}`));
  };
  const toggle = (s: Station, active: boolean) => {
    if (!active && s.code === d.session.station) { toast(t(`ທ່ານກໍາລັງເຮັດວຽກຢູ່ ${s.code}. ກະລຸນາປ່ຽນສະຖານີກ່ອນ ຈຶ່ງປິດໃຊ້ໄດ້`, `You are working at ${s.code}. Switch to another station first, then deactivate it.`), "warn"); return; }
    upsert("stations", { ...s, active }, false);
    toast(active ? t(`ເປີດໃຊ້ ${s.code} ແລ້ວ`, `${s.code} is active`) : t(`ປິດໃຊ້ ${s.code} ແລ້ວ`, `${s.code} is inactive`));
  };

  const rows = d.stations.filter((s) => (!scope || s.scope === scope) && (!status || (status === "active" ? s.active : !s.active)));
  const cols: Col<Station>[] = [
    { key: "code", header: t("ລະຫັດ IATA", "IATA code"), mono: true, render: (s) => <span className="font-semibold">{s.code}</span>, sort: (s) => s.code },
    { key: "name", header: t("ຊື່ສະຖານີ", "Station"), render: (s) => <span className="inline-flex items-center gap-1.5">{name(s)}{s.isHub && <Badge tone="info" noIcon>{t("ສູນກາງ", "Hub")}</Badge>}</span>, sort: (s) => s.nameEn },
    { key: "branch", header: t("ສໍານັກງານສາຂາ", "Branch office"), render: (s) => t(s.branchLo, s.branchEn) },
    { key: "phone", header: t("ໂທລະສັບ", "Phone"), render: (s) => <span className="tnum whitespace-nowrap">{s.phone}</span> },
    { key: "scope", header: t("ຂອບເຂດ", "Scope"), render: (s) => s.scope === "domestic" ? t("ພາຍໃນ", "Domestic") : t("ຕ່າງປະເທດ", "International"), sort: (s) => s.scope },
    { key: "ranges", header: t("ຊ່ວງເລກ AWB", "AWB ranges"), align: "right", render: (s) => <span className="whitespace-nowrap">{ranges(s.code).length}<span className="ml-1.5 text-xs text-ink-2">{t(`ເຫຼືອ ${num(remaining(s.code))}`, `${num(remaining(s.code))} left`)}</span></span>, sort: (s) => ranges(s.code).length },
    { key: "zones", header: t("ໂຊນ", "Zones"), align: "right", render: (s) => zones(s.code).length, sort: (s) => zones(s.code).length },
    { key: "active", header: t("ສະຖານະ", "Status"), render: (s) => <span onClick={(e) => e.stopPropagation()}><Checkbox label={s.active ? t("ເປີດໃຊ້", "Active") : t("ປິດໃຊ້", "Inactive")} checked={s.active} disabled={!manage} onChange={(v) => toggle(s, v)} /></span> },
    ...(manage ? [{ key: "act", header: "", align: "right" as const, render: (s: Station) => <span className="inline-flex" onClick={(e) => e.stopPropagation()}><IconButton icon={Pencil} label={t(`ແກ້ໄຂ ${s.code}`, `Edit ${s.code}`)} onClick={() => setEdit(s)} /><IconButton icon={Trash2} label={t(`ລຶບ ${s.code}`, `Delete ${s.code}`)} onClick={() => setDel(s)} /></span> }] : []),
  ];
  const viewing = d.stations.find((s) => s.code === view);
  const delBlock = del ? blockers(del.code) : [];
  const blocked = del ? stationInUse(del.code) || delBlock.length > 0 : false;

  return <>
    <PageHeader title={t("ສາຂາ ແລະ ສະຖານີ", "Stations and branches")} subtitle={t("ສະຖານີ ແລະ ສໍານັກງານສາຂາທີ່ໃຊ້ໃນທຸກໂມດູນ. ລະຫັດສະຖານີແມ່ນລະຫັດ IATA 3 ຕົວ.", "Stations and branch offices used across every module. The station code is the 3-letter IATA code.")} actions={manage && <Button variant="primary" icon={Plus} onClick={() => setEdit("new")}>{t("ເພີ່ມສະຖານີ", "Add station")}</Button>} />
    {!manage && <div className="mb-3"><Callout tone="info">{t("ທ່ານເບິ່ງໄດ້ຢ່າງດຽວ. ການແກ້ໄຂຕ້ອງມີສິດຈັດການຂໍ້ມູນພື້ນຖານ.", "You can view this list. Changes need the Manage master data permission.")}</Callout></div>}
    <Panel flush>
      <DataTable rows={rows} columns={cols} rowKey={(s) => s.code} minWidth={1060} pageSize={15} defaultSort={{ key: "code", dir: "asc" }} onRowClick={(s) => setView(s.code)}
        search={(s) => `${s.code} ${s.nameLo} ${s.nameEn} ${s.branchLo} ${s.branchEn} ${s.countryEn}`}
        filters={<>
          <Select aria-label={t("ຂອບເຂດ", "Scope")} className="w-auto" value={scope} onChange={(e) => setScope(e.target.value)} placeholder={t("ທຸກຂອບເຂດ", "All scopes")} options={[{ value: "domestic", label: t("ພາຍໃນ", "Domestic") }, { value: "international", label: t("ຕ່າງປະເທດ", "International") }]} />
          <Select aria-label={t("ສະຖານະ", "Status")} className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t("ທຸກສະຖານະ", "All statuses")} options={[{ value: "active", label: t("ເປີດໃຊ້", "Active") }, { value: "inactive", label: t("ປິດໃຊ້", "Inactive") }]} />
        </>} />
    </Panel>

    {edit && <StationForm station={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}

    <Dialog open={!!viewing} onClose={() => setView(null)} size="lg" title={viewing ? `${viewing.code} · ${name(viewing)}` : ""} footer={viewing && manage ? <Button icon={Pencil} onClick={() => { setEdit(viewing); setView(null); }}>{t("ແກ້ໄຂ", "Edit")}</Button> : undefined}>
      {viewing && <div className="space-y-4">
        <Dl cols={3} items={[
          { label: t("ສໍານັກງານສາຂາ", "Branch office"), value: t(viewing.branchLo, viewing.branchEn) },
          { label: t("ປະເທດ", "Country"), value: viewing.countryEn },
          { label: t("ໂທລະສັບ", "Phone"), value: <span className="tnum">{viewing.phone}</span> },
        ]} />
        <div>
          <h3 className="mb-1 text-sm font-semibold">{t("ຊ່ວງເລກ AWB", "AWB ranges")}</h3>
          {ranges(viewing.code).length === 0 ? <p className="text-sm text-ink-2">{t("ຍັງບໍ່ມີຊ່ວງເລກ. ສະຖານີນີ້ຍັງອອກ AWB ບໍ່ໄດ້.", "No range yet, so this station cannot issue AWBs.")} <Link className="text-brand hover:underline" to="/master/awb-stock">{t("ຈັດສັນຊ່ວງເລກ", "Allocate a range")}</Link></p>
            : <ul className="space-y-2">{ranges(viewing.code).map((s) => { const total = s.to - s.from + 1; const used = s.nextSerial - s.from; return <li key={s.id} className="text-sm"><div className="mb-1 flex flex-wrap justify-between gap-x-3"><MonoCode>{s.prefix} {s.from}-{s.to}</MonoCode><span className="tnum text-xs text-ink-2">{t(`ໃຊ້ແລ້ວ ${num(used)} ຈາກ ${num(total)}`, `${num(used)} of ${num(total)} used`)}{!s.active && ` · ${t("ປິດໃຊ້", "Inactive")}`}</span></div><BarMeter value={used} max={total} label={`${used}/${total}`} /></li>; })}</ul>}
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">{t("ໂຊນໃນສາງ", "Warehouse zones")}</h3>
          {zones(viewing.code).length === 0 ? <p className="text-sm text-ink-2">{t("ສະຖານີນີ້ຍັງບໍ່ມີໂຊນໃນສາງ.", "This station has no warehouse zones yet.")}</p>
            : <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{zones(viewing.code).map((z) => <li key={z.id}><MonoCode className="font-semibold">{z.code}</MonoCode> {name(z)} <span className="tnum text-xs text-ink-2">{num(z.capacityKg)} kg</span></li>)}</ul>}
        </div>
      </div>}
    </Dialog>

    <Dialog open={!!del && blocked} onClose={() => setDel(null)} size="sm" title={t(`ລຶບ ${del?.code ?? ""} ບໍ່ໄດ້`, `${del?.code ?? ""} cannot be deleted`)} footer={<>
      <Button onClick={() => setDel(null)}>{t("ປິດ", "Close")}</Button>
      {del?.active && del.code !== d.session.station && <Button variant="primary" onClick={() => { toggle(del, false); setDel(null); }}>{t("ປິດໃຊ້ແທນ", "Deactivate instead")}</Button>}
    </>}>
      <p className="mb-2 text-sm">{t("ສະຖານີນີ້ຍັງຖືກໃຊ້ຢູ່ໃນຂໍ້ມູນຕໍ່ໄປນີ້. ການລຶບຈະເຮັດໃຫ້ປະຫວັດຂາດຫາຍ, ສະນັ້ນໃຫ້ປິດໃຊ້ແທນ.", "These records still use this station. Deleting it would break their history, so deactivate it instead.")}</p>
      <ul className="list-disc space-y-0.5 pl-5 text-sm tnum">{delBlock.map((x) => <li key={x}>{x}</li>)}</ul>
    </Dialog>
    <Confirm open={!!del && !blocked} onClose={() => setDel(null)} danger title={t(`ລຶບສະຖານີ ${del?.code ?? ""}?`, `Delete station ${del?.code ?? ""}?`)} body={t("ບໍ່ມີຂໍ້ມູນໃດໃຊ້ສະຖານີນີ້. ການລຶບຈະຖືກບັນທຶກໃນປະຫວັດການເຄື່ອນໄຫວ.", "No record uses this station. The deletion is written to the audit trail.")} confirmLabel={t("ລຶບສະຖານີ", "Delete station")} onConfirm={() => { if (del) { removeFrom("stations", del.code); toast(t(`ລຶບ ${del.code} ແລ້ວ`, `${del.code} deleted`)); } }} />
  </>;
}

function StationForm({ station, onClose }: { station?: Station; onClose: () => void }) {
  const d = useDb(); const t = useT();
  const [f, setF] = useState<Station>(station ?? BLANK); const [tried, setTried] = useState(false);
  const set = (p: Partial<Station>) => setF((x) => ({ ...x, ...p }));
  const inUse = !!station && stationInUse(station.code);
  const req = t("ກະລຸນາປ້ອນຂໍ້ມູນນີ້", "Enter this field");
  const codeErr = station ? "" : !/^[A-Z]{3}$/.test(f.code) ? t("ລະຫັດ IATA ຕ້ອງເປັນຕົວພິມໃຫຍ່ 3 ຕົວ ເຊັ່ນ VTE", "The IATA code must be 3 capital letters, such as VTE") : d.stations.some((s) => s.code === f.code) ? t(`ມີລະຫັດ ${f.code} ແລ້ວ. ກະລຸນາໃຊ້ລະຫັດອື່ນ ຫຼື ແກ້ໄຂສະຖານີເດີມ`, `${f.code} already exists. Use another code or edit the existing station`) : "";
  const errs = { code: codeErr, nameLo: f.nameLo.trim() ? "" : req, nameEn: f.nameEn.trim() ? "" : req, countryEn: f.countryEn.trim() ? "" : req, branchLo: f.branchLo.trim() ? "" : req, branchEn: f.branchEn.trim() ? "" : req, phone: f.phone.trim() ? "" : req };
  const save = () => {
    setTried(true); if (Object.values(errs).some(Boolean)) return;
    upsert("stations", { ...f, nameLo: f.nameLo.trim(), nameEn: f.nameEn.trim(), countryEn: f.countryEn.trim(), branchLo: f.branchLo.trim(), branchEn: f.branchEn.trim(), phone: f.phone.trim() }, !station);
    toast(station ? t(`ບັນທຶກ ${f.code} ແລ້ວ`, `${f.code} saved`) : t(`ເພີ່ມສະຖານີ ${f.code} ແລ້ວ`, `Station ${f.code} added`)); onClose();
  };
  const e = (k: keyof typeof errs) => (tried ? errs[k] : "") || undefined;
  return <Dialog open onClose={onClose} title={station ? t(`ແກ້ໄຂສະຖານີ ${station.code}`, `Edit station ${station.code}`) : t("ເພີ່ມສະຖານີ", "Add station")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{station ? t("ບັນທຶກການແກ້ໄຂ", "Save changes") : t("ເພີ່ມສະຖານີ", "Add station")}</Button></>}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("ລະຫັດ IATA", "IATA code")} required error={e("code")} hint={station ? t("ລະຫັດປ່ຽນບໍ່ໄດ້ ເພາະຂໍ້ມູນອື່ນອ້າງອີງເຖິງ", "The code cannot change because other records refer to it") : t("ຕົວພິມໃຫຍ່ 3 ຕົວ", "3 capital letters")}><Input className="font-mono" value={f.code} maxLength={3} disabled={!!station} onChange={(x) => set({ code: x.target.value.toUpperCase() })} /></Field>
      <Field label={t("ຂອບເຂດ", "Scope")} required hint={inUse ? t("ປ່ຽນບໍ່ໄດ້ ຂະນະທີ່ຖ້ຽວບິນ ຫຼື AWB ໃຊ້ສະຖານີນີ້ຢູ່", "Locked while flights or AWBs use this station") : undefined}><Select value={f.scope} disabled={inUse} onChange={(x) => set({ scope: x.target.value as Scope })} options={[{ value: "domestic", label: t("ພາຍໃນ", "Domestic") }, { value: "international", label: t("ຕ່າງປະເທດ", "International") }]} /></Field>
      <Field label={t("ຊື່ພາສາລາວ", "Name in Lao")} required error={e("nameLo")}><Input value={f.nameLo} onChange={(x) => set({ nameLo: x.target.value })} /></Field>
      <Field label={t("ຊື່ພາສາອັງກິດ", "Name in English")} required error={e("nameEn")}><Input value={f.nameEn} onChange={(x) => set({ nameEn: x.target.value })} /></Field>
      <Field label={t("ສໍານັກງານສາຂາ (ລາວ)", "Branch office (Lao)")} required error={e("branchLo")}><Input value={f.branchLo} onChange={(x) => set({ branchLo: x.target.value })} /></Field>
      <Field label={t("ສໍານັກງານສາຂາ (ອັງກິດ)", "Branch office (English)")} required error={e("branchEn")}><Input value={f.branchEn} onChange={(x) => set({ branchEn: x.target.value })} /></Field>
      <Field label={t("ປະເທດ", "Country")} required error={e("countryEn")}><Input value={f.countryEn} onChange={(x) => set({ countryEn: x.target.value })} /></Field>
      <Field label={t("ໂທລະສັບ", "Phone")} required error={e("phone")}><Input value={f.phone} onChange={(x) => set({ phone: x.target.value })} /></Field>
    </div>
    <div className="mt-3"><Checkbox label={t("ເປີດໃຊ້ສະຖານີນີ້", "This station is active")} checked={f.active} disabled={station?.code === d.session.station} onChange={(v) => set({ active: v })} /></div>
  </Dialog>;
}
