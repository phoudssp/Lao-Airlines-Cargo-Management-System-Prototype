import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, CalendarPlus, Pencil, Plane, Plus, RotateCcw, Trash2 } from "lucide-react";
import { getDb, useCan, useDb } from "@/lib/store";
import { useName, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Checkbox, Col, Confirm, DataTable, Dialog, Empty, Field, IconButton, Input, MonoCode, PageHeader, Panel, Select, Tabs, toast } from "@/ui/kit";
import { FlightStatusBadge, Route } from "@/ui/cargo";
import type { Aircraft, Db, Flight, RouteDef, Scope } from "@/lib/types";
import { dateAdd, fmtDate, num, todayIso } from "@/lib/format";
import { scopeOf } from "@/lib/pricing";
import { copyFlights, flightInUse, newId, removeFrom, upsert } from "@/lib/mock/master";
import { setFlightStatus } from "@/lib/mock/awb";
import { flightCapacity } from "@/lib/mock/booking";

type T = (lo: string, en: string) => string;
const scopeLabel = (t: T, s: Scope) => (s === "domestic" ? t("ພາຍໃນ", "Domestic") : t("ຕ່າງປະເທດ", "International"));
const scopeOptions = (t: T) => [{ value: "domestic", label: t("ພາຍໃນ", "Domestic") }, { value: "international", label: t("ຕ່າງປະເທດ", "International") }];
const activeRoute = (d: Db, o: string, x: string) => d.routes.find((r) => r.origin === o && r.dest === x && r.active);
const REQ = (t: T) => t("ກະລຸນາປ້ອນຂໍ້ມູນນີ້", "Enter this field");

function flightRefs(d: Db, id: string, t: T) {
  const list: [number, string, string][] = [
    [d.awbs.filter((a) => a.flightId === id || a.nextFlightId === id).length, "AWB", "AWBs"],
    [d.loads.filter((l) => l.flightId === id).length, "ລາຍການໃນ Manifest", "manifest lines"],
    [d.bookings.filter((b) => b.flightId === id).length, "ການຈອງ", "bookings"],
    [d.mail.filter((m) => m.flightId === id).length, "ຖົງເມ", "mail dispatches"],
  ];
  return list.filter(([n]) => n > 0).map(([n, lo, en]) => t(`${lo} ${n} ລາຍການ`, `${n} ${en}`));
}

export default function Flights() {
  const d = useDb(); const t = useT(); const can = useCan();
  const [tab, setTab] = useState<"flights" | "routes" | "aircraft">("flights");
  const manage = can("master.manage");
  return <>
    <PageHeader title={t("ຖ້ຽວບິນ ແລະ ເສັ້ນທາງ", "Flights and routes")} subtitle={t("ຕາຕະລາງບິນ ເສັ້ນທາງ ແລະ ຄວາມຈຸສິນຄ້າສູງສຸດຂອງແຕ່ລະແບບເຮືອບິນ.", "The flight schedule, routes and the maximum cargo capacity of each aircraft type.")} />
    {!manage && <div className="mb-3"><Callout tone="info">{t("ທ່ານເບິ່ງໄດ້ຢ່າງດຽວ. ການແກ້ໄຂຕ້ອງມີສິດຈັດການຂໍ້ມູນພື້ນຖານ.", "You can view this page. Changes need the Manage master data permission.")}</Callout></div>}
    <Tabs value={tab} onChange={setTab} tabs={[{ key: "flights", label: t("ຕາຕະລາງບິນ", "Flight schedule") }, { key: "routes", label: t("ເສັ້ນທາງ", "Routes"), count: d.routes.length }, { key: "aircraft", label: t("ເຮືອບິນ", "Aircraft"), count: d.aircraft.length }]} />
    {tab === "flights" ? <FlightsTab manage={manage} /> : tab === "routes" ? <RoutesTab manage={manage} /> : <AircraftTab manage={manage} />}
  </>;
}

// ---------- Flight schedule ----------
function FlightsTab({ manage }: { manage: boolean }) {
  const d = useDb(); const t = useT(); const can = useCan();
  const [date, setDate] = useState(todayIso()); const [station, setStation] = useState(d.session.station); const [scope, setScope] = useState("");
  const [edit, setEdit] = useState<Flight | "new" | null>(null); const [copy, setCopy] = useState(false); const [cancel, setCancel] = useState<Flight | null>(null); const [del, setDel] = useState<Flight | null>(null);
  const canCancel = manage || can("flight.dispatch");
  const rows = useMemo(() => d.flights.filter((f) => (!date || f.date === date) && (!station || f.origin === station || f.dest === station) && (!scope || f.scope === scope)), [d.flights, date, station, scope]);
  const cols: Col<Flight>[] = [
    { key: "no", header: t("ຖ້ຽວບິນ", "Flight"), render: (f) => <Link to={`/export/dispatch/${f.id}`} className="font-mono text-[13px] font-semibold text-brand hover:underline">{f.no}</Link>, sort: (f) => f.no },
    { key: "date", header: t("ວັນທີ", "Date"), render: (f) => <span className="tnum whitespace-nowrap">{fmtDate(f.date)}</span>, sort: (f) => `${f.date} ${f.std}` },
    { key: "std", header: "STD", render: (f) => <span className="tnum">{f.std}</span>, sort: (f) => f.std },
    { key: "sta", header: "STA", render: (f) => <span className="tnum">{f.sta}</span>, sort: (f) => f.sta },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (f) => <Route from={f.origin} to={f.dest} />, sort: (f) => f.origin + f.dest },
    { key: "ac", header: t("ເຮືອບິນ", "Aircraft"), mono: true, render: (f) => f.aircraft, sort: (f) => f.aircraft },
    { key: "scope", header: t("ຂອບເຂດ", "Scope"), render: (f) => scopeLabel(t, f.scope), sort: (f) => f.scope },
    { key: "load", header: t("ສິນຄ້າ / ຄວາມຈຸ", "Cargo / capacity"), align: "right", render: (f) => { const c = flightCapacity(d, f.id); return <span className={"whitespace-nowrap " + (c.maxKg && c.usedKg > c.maxKg ? "text-bad font-medium" : "")}>{num(c.usedKg)} / {num(c.maxKg)} kg</span>; }, sort: (f) => flightCapacity(d, f.id).pct },
    { key: "status", header: t("ສະຖານະ", "Status"), render: (f) => <FlightStatusBadge status={f.status} />, sort: (f) => f.status },
    ...(manage || canCancel ? [{ key: "act", header: "", align: "right" as const, render: (f: Flight) => <span className="inline-flex justify-end">
      {manage && (f.status === "open" || f.status === "closed") && <IconButton icon={Pencil} label={t(`ແກ້ໄຂ ${f.no}`, `Edit ${f.no}`)} onClick={() => setEdit(f)} />}
      {canCancel && (f.status === "open" || f.status === "closed") && <IconButton icon={Ban} label={t(`ຍົກເລີກ ${f.no}`, `Cancel ${f.no}`)} onClick={() => setCancel(f)} />}
      {canCancel && f.status === "cancelled" && <IconButton icon={RotateCcw} label={t(`ເປີດ ${f.no} ຄືນ`, `Reinstate ${f.no}`)} onClick={() => { setFlightStatus(f.id, "open"); toast(t(`ເປີດ ${f.no} ຄືນແລ້ວ`, `${f.no} reinstated`)); }} />}
      {manage && <IconButton icon={Trash2} label={t(`ລຶບ ${f.no}`, `Delete ${f.no}`)} onClick={() => setDel(f)} />}
    </span> }] : []),
  ];
  const cancelRefs = cancel ? flightRefs(d, cancel.id, t) : [];
  const delRefs = del ? flightRefs(d, del.id, t) : [];
  const delBlocked = !!del && (flightInUse(del.id) || delRefs.length > 0);
  return <>
    <Panel flush>
      <DataTable rows={rows} columns={cols} rowKey={(f) => f.id} minWidth={1060} pageSize={15} defaultSort={{ key: "date", dir: "asc" }} search={(f) => `${f.no} ${f.origin} ${f.dest} ${f.aircraft}`}
        filters={<>
          <Input aria-label={t("ວັນທີ", "Date")} type="date" className="w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select aria-label={t("ສະຖານີ", "Station")} className="w-auto" value={station} onChange={(e) => setStation(e.target.value)} placeholder={t("ທຸກສະຖານີ", "All stations")} options={d.stations.map((s) => ({ value: s.code, label: s.code }))} />
          <Select aria-label={t("ຂອບເຂດ", "Scope")} className="w-auto" value={scope} onChange={(e) => setScope(e.target.value)} placeholder={t("ພາຍໃນ ແລະ ຕ່າງປະເທດ", "Domestic and international")} options={scopeOptions(t)} />
        </>}
        toolbar={manage && <><Button icon={CalendarPlus} onClick={() => setCopy(true)}>{t("ສໍາເນົາຕາຕະລາງ", "Copy schedule")}</Button><Button variant="primary" icon={Plus} onClick={() => setEdit("new")}>{t("ເພີ່ມຖ້ຽວບິນ", "Add flight")}</Button></>}
        empty={<Empty icon={Plane} title={t("ບໍ່ມີຖ້ຽວບິນຕາມຕົວກອງນີ້", "No flights match these filters")} action={manage ? <Button icon={CalendarPlus} onClick={() => setCopy(true)}>{t("ສໍາເນົາຕາຕະລາງມາວັນທີນີ້", "Copy a schedule to this date")}</Button> : undefined}>{t("ລອງປ່ຽນວັນທີ ຫຼື ສະຖານີ.", "Try another date or station.")}</Empty>} />
    </Panel>
    {edit && <FlightForm flight={edit === "new" ? undefined : edit} defaultDate={date || todayIso()} defaultOrigin={station} onClose={() => setEdit(null)} />}
    {copy && <CopyDialog initialTarget={date && date >= todayIso() ? date : ""} station={station} scope={scope} onClose={() => setCopy(false)} onDone={(target) => setDate(target)} />}
    <Confirm open={!!cancel} onClose={() => setCancel(null)} danger title={t(`ຍົກເລີກຖ້ຽວບິນ ${cancel?.no ?? ""}?`, `Cancel flight ${cancel?.no ?? ""}?`)} confirmLabel={t("ຍົກເລີກຖ້ຽວບິນ", "Cancel flight")} body={<>
      <p>{cancel && `${fmtDate(cancel.date)} ${cancel.std} · ${cancel.origin} → ${cancel.dest}`}</p>
      {cancelRefs.length > 0 && <div className="mt-2"><Callout tone="warn" title={t("ຖ້ຽວບິນນີ້ມີສິນຄ້າຢູ່", "This flight has cargo on it")}><span className="tnum">{cancelRefs.join(", ")}</span>. {t("ຫຼັງຍົກເລີກ ໃຫ້ຍ້າຍສິນຄ້າໄປຖ້ຽວອື່ນໃນໜ້າຖ້ຽວບິນ ແລະ Manifest.", "After cancelling, move the cargo to another flight on the Flights and manifest screen.")}</Callout></div>}
    </>} onConfirm={() => { if (cancel) { setFlightStatus(cancel.id, "cancelled"); toast(t(`ຍົກເລີກ ${cancel.no} ແລ້ວ`, `${cancel.no} cancelled`)); } }} />
    <Dialog open={delBlocked} onClose={() => setDel(null)} size="sm" title={t(`ລຶບ ${del?.no ?? ""} ບໍ່ໄດ້`, `${del?.no ?? ""} cannot be deleted`)} footer={<Button onClick={() => setDel(null)}>{t("ປິດ", "Close")}</Button>}>
      <p className="mb-2 text-sm">{t("ຖ້ຽວບິນນີ້ຍັງຖືກໃຊ້ຢູ່ໃນຂໍ້ມູນຕໍ່ໄປນີ້. ຖ້າບໍ່ບິນແລ້ວ ໃຫ້ຍົກເລີກຖ້ຽວບິນແທນການລຶບ.", "These records still use this flight. If it will not operate, cancel the flight instead of deleting it.")}</p>
      <ul className="tnum list-disc space-y-0.5 pl-5 text-sm">{delRefs.map((x) => <li key={x}>{x}</li>)}</ul>
    </Dialog>
    <Confirm open={!!del && !delBlocked} onClose={() => setDel(null)} danger title={t(`ລຶບຖ້ຽວບິນ ${del?.no ?? ""}?`, `Delete flight ${del?.no ?? ""}?`)} body={del && `${fmtDate(del.date)} ${del.std} · ${del.origin} → ${del.dest}. ${t("ບໍ່ມີ AWB ຫຼື ການຈອງໃນຖ້ຽວນີ້.", "No AWB or booking uses this flight.")}`} confirmLabel={t("ລຶບຖ້ຽວບິນ", "Delete flight")} onConfirm={() => { if (del) { removeFrom("flights", del.id); toast(t(`ລຶບ ${del.no} ແລ້ວ`, `${del.no} deleted`)); } }} />
  </>;
}

function FlightForm({ flight, defaultDate, defaultOrigin, onClose }: { flight?: Flight; defaultDate: string; defaultOrigin: string; onClose: () => void }) {
  const d = useDb(); const t = useT(); const name = useName();
  const [f, setF] = useState<Flight>(flight ?? { id: "", no: "QV", date: defaultDate, std: "", sta: "", origin: defaultOrigin, dest: "", aircraft: d.aircraft[0]?.code ?? "", status: "open", scope: "domestic" });
  const [tried, setTried] = useState(false);
  const set = (p: Partial<Flight>) => setF((x) => ({ ...x, ...p }));
  const locked = !!flight && flightInUse(flight.id);
  const no = f.no.trim().toUpperCase();
  const routeOk = !f.origin || !f.dest || f.origin === f.dest || !!activeRoute(d, f.origin, f.dest) || (!!flight && flight.origin === f.origin && flight.dest === f.dest);
  const errs = {
    no: !/^[A-Z0-9]{2}\d{1,4}$/.test(no) ? t("ເລກຖ້ຽວບິນຕ້ອງມີລະຫັດສາຍການບິນ ແລະ ຕົວເລກ ເຊັ່ນ QV445", "Enter the airline code and number, such as QV445") : d.flights.some((x) => x.id !== f.id && x.no === no && x.date === f.date) ? t(`${no} ມີແລ້ວໃນວັນທີ ${fmtDate(f.date)}`, `${no} already exists on ${fmtDate(f.date)}`) : "",
    date: f.date ? "" : REQ(t), std: f.std ? "" : REQ(t), sta: f.sta ? "" : REQ(t), origin: f.origin ? "" : REQ(t),
    dest: !f.dest ? REQ(t) : f.dest === f.origin ? t("ຕົ້ນທາງ ແລະ ປາຍທາງຕ້ອງຕ່າງກັນ", "Origin and destination must differ") : !routeOk ? t(`ຍັງບໍ່ມີເສັ້ນທາງ ${f.origin}-${f.dest} ທີ່ເປີດໃຊ້. ກະລຸນາເພີ່ມໃນແຖບເສັ້ນທາງກ່ອນ`, `${f.origin}-${f.dest} is not an active route. Add it on the Routes tab first`) : "",
    aircraft: f.aircraft ? "" : REQ(t),
  };
  const e = (k: keyof typeof errs) => (tried ? errs[k] : "") || undefined;
  const cap = flight ? flightCapacity(d, flight.id) : undefined; const ac = d.aircraft.find((a) => a.code === f.aircraft);
  const overCap = !!cap && !!ac && cap.usedKg > ac.maxCargoKg;
  const save = () => {
    setTried(true); if (Object.values(errs).some(Boolean)) return;
    upsert("flights", { ...f, no, id: f.id || newId("F"), scope: scopeOf(getDb(), f.origin, f.dest) }, !flight);
    toast(flight ? t(`ບັນທຶກ ${no} ແລ້ວ`, `${no} saved`) : t(`ເພີ່ມຖ້ຽວບິນ ${no} ແລ້ວ`, `Flight ${no} added`)); onClose();
  };
  const stations = d.stations.filter((s) => s.active || s.code === f.origin || s.code === f.dest).map((s) => ({ value: s.code, label: `${s.code} · ${name(s)}` }));
  return <Dialog open onClose={onClose} title={flight ? t(`ແກ້ໄຂຖ້ຽວບິນ ${flight.no}`, `Edit flight ${flight.no}`) : t("ເພີ່ມຖ້ຽວບິນ", "Add flight")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{flight ? t("ບັນທຶກການແກ້ໄຂ", "Save changes") : t("ເພີ່ມຖ້ຽວບິນ", "Add flight")}</Button></>}>
    {locked && <div className="mb-3"><Callout tone="info">{t("ຖ້ຽວບິນນີ້ມີ AWB ຫຼື ການຈອງແລ້ວ ຈຶ່ງແກ້ໄດ້ສະເພາະເວລາ ແລະ ເຮືອບິນ.", "This flight already has AWBs or bookings, so only the times and aircraft can change.")}</Callout></div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("ເລກຖ້ຽວບິນ", "Flight number")} required error={e("no")}><Input className="font-mono" value={f.no} disabled={locked} onChange={(x) => set({ no: x.target.value.toUpperCase() })} /></Field>
      <Field label={t("ວັນທີ", "Date")} required error={e("date")}><Input type="date" value={f.date} disabled={locked} onChange={(x) => set({ date: x.target.value })} /></Field>
      <Field label={t("ເວລາອອກ STD", "Departure (STD)")} required error={e("std")}><Input type="time" value={f.std} onChange={(x) => set({ std: x.target.value })} /></Field>
      <Field label={t("ເວລາຮອດ STA", "Arrival (STA)")} required error={e("sta")}><Input type="time" value={f.sta} onChange={(x) => set({ sta: x.target.value })} /></Field>
      <Field label={t("ຕົ້ນທາງ", "Origin")} required error={e("origin")}><Select value={f.origin} disabled={locked} placeholder={t("ເລືອກສະຖານີ", "Choose a station")} onChange={(x) => set({ origin: x.target.value })} options={stations} /></Field>
      <Field label={t("ປາຍທາງ", "Destination")} required error={e("dest")}><Select value={f.dest} disabled={locked} placeholder={t("ເລືອກສະຖານີ", "Choose a station")} onChange={(x) => set({ dest: x.target.value })} options={stations} /></Field>
      <Field label={t("ເຮືອບິນ", "Aircraft")} required error={e("aircraft")} hint={ac ? t(`ຮັບສິນຄ້າໄດ້ສູງສຸດ ${num(ac.maxCargoKg)} kg, ${num(ac.maxCargoM3)} m³`, `Carries up to ${num(ac.maxCargoKg)} kg, ${num(ac.maxCargoM3)} m³`) : undefined}><Select value={f.aircraft} onChange={(x) => set({ aircraft: x.target.value })} options={d.aircraft.map((a) => ({ value: a.code, label: `${a.code} · ${a.nameEn}` }))} /></Field>
      <Field label={t("ຂອບເຂດ", "Scope")} hint={t("ກໍານົດຈາກສະຖານີຕົ້ນທາງ ແລະ ປາຍທາງ", "Set from the origin and destination")}><Input disabled value={f.origin && f.dest ? scopeLabel(t, scopeOf(d, f.origin, f.dest)) : ""} /></Field>
    </div>
    {overCap && cap && ac && <div className="mt-3"><Callout tone="warn">{t(`ສິນຄ້າໃນຖ້ຽວນີ້ ${num(cap.usedKg)} kg ເກີນຄວາມຈຸ ${ac.code} ${num(ac.maxCargoKg)} kg. ຖ້າບັນທຶກ ຕ້ອງຍ້າຍສິນຄ້າບາງສ່ວນອອກ.`, `The ${num(cap.usedKg)} kg on this flight exceeds the ${num(ac.maxCargoKg)} kg capacity of ${ac.code}. If you save this, some cargo must move to another flight.`)}</Callout></div>}
  </Dialog>;
}

function CopyDialog({ initialTarget, station, scope, onClose, onDone }: { initialTarget: string; station: string; scope: string; onClose: () => void; onDone: (target: string) => void }) {
  const d = useDb(); const t = useT();
  const [from, setFrom] = useState(todayIso()); const [target, setTarget] = useState(initialTarget && initialTarget !== todayIso() ? initialTarget : dateAdd(todayIso(), 7)); const [st, setSt] = useState(station); const [sc, setSc] = useState(scope);
  const sources = d.flights.filter((f) => f.date === from && f.status !== "cancelled" && (!st || f.origin === st || f.dest === st) && (!sc || f.scope === sc)).sort((a, b) => a.std.localeCompare(b.std));
  const skipReason = (f: Flight) => d.flights.some((x) => x.no === f.no && x.date === target) ? t("ມີຢູ່ແລ້ວໃນວັນປາຍທາງ", "Already on the target date") : !activeRoute(d, f.origin, f.dest) ? t("ເສັ້ນທາງປິດໃຊ້", "Route is inactive") : "";
  const will = sources.filter((f) => !skipReason(f));
  const dateErr = !target ? t("ກະລຸນາເລືອກວັນທີປາຍທາງ", "Choose the target date") : target === from ? t("ວັນປາຍທາງຕ້ອງຕ່າງຈາກວັນຕົ້ນທາງ", "The target date must differ from the source date") : target < todayIso() ? t("ສໍາເນົາໄປວັນທີຜ່ານມາແລ້ວບໍ່ໄດ້", "You cannot copy to a past date") : "";
  const run = () => { copyFlights(will.map((f) => f.id), target); toast(t(`ສໍາເນົາ ${will.length} ຖ້ຽວໄປວັນທີ ${fmtDate(target)} ແລ້ວ`, `${will.length} flights copied to ${fmtDate(target)}`)); onDone(target); onClose(); };
  return <Dialog open onClose={onClose} size="lg" title={t("ສໍາເນົາຕາຕະລາງໄປວັນອື່ນ", "Copy schedule to a date")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" disabled={!!dateErr || will.length === 0} onClick={run}>{t(`ສໍາເນົາ ${will.length} ຖ້ຽວ`, `Copy ${will.length} flights`)}</Button></>}>
    <div className="mb-3 grid gap-3 sm:grid-cols-4">
      <Field label={t("ຈາກວັນທີ", "From date")} required><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      <Field label={t("ໄປວັນທີ", "To date")} required error={dateErr || undefined}><Input type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
      <Field label={t("ສະຖານີ", "Station")}><Select value={st} onChange={(e) => setSt(e.target.value)} placeholder={t("ທຸກສະຖານີ", "All stations")} options={d.stations.map((s) => ({ value: s.code, label: s.code }))} /></Field>
      <Field label={t("ຂອບເຂດ", "Scope")}><Select value={sc} onChange={(e) => setSc(e.target.value)} placeholder={t("ທັງໝົດ", "All")} options={scopeOptions(t)} /></Field>
    </div>
    {sources.length === 0 ? <Empty icon={Plane} title={t("ບໍ່ມີຖ້ຽວບິນໃນວັນຕົ້ນທາງ", "No flights on the source date")}>{t("ລອງເລືອກວັນທີ ຫຼື ສະຖານີອື່ນ.", "Try another date or station.")}</Empty>
      : <div className="overflow-x-auto rounded border border-line"><table className="w-full min-w-[520px] text-sm"><thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-ink-2"><th className="px-3 py-1.5 font-semibold">{t("ຖ້ຽວບິນ", "Flight")}</th><th className="px-3 py-1.5 font-semibold">STD</th><th className="px-3 py-1.5 font-semibold">{t("ເສັ້ນທາງ", "Route")}</th><th className="px-3 py-1.5 font-semibold">{t("ເຮືອບິນ", "Aircraft")}</th><th className="px-3 py-1.5 font-semibold">{t("ຜົນ", "Result")}</th></tr></thead>
        <tbody>{sources.map((f) => { const r = skipReason(f); return <tr key={f.id} className="border-b border-line last:border-0"><td className="px-3 py-1.5"><MonoCode className="font-semibold">{f.no}</MonoCode></td><td className="tnum px-3 py-1.5">{f.std}</td><td className="px-3 py-1.5"><Route from={f.origin} to={f.dest} /></td><td className="px-3 py-1.5"><MonoCode>{f.aircraft}</MonoCode></td><td className="px-3 py-1.5">{r ? <Badge tone="warn">{r}</Badge> : <Badge tone="ok">{t("ຈະສໍາເນົາ", "Will copy")}</Badge>}</td></tr>; })}</tbody></table></div>}
  </Dialog>;
}

// ---------- Routes ----------
function RoutesTab({ manage }: { manage: boolean }) {
  const d = useDb(); const t = useT();
  const [scope, setScope] = useState(""); const [edit, setEdit] = useState<RouteDef | "new" | null>(null); const [del, setDel] = useState<RouteDef | null>(null);
  const flightsOn = (r: RouteDef) => d.flights.filter((f) => f.origin === r.origin && f.dest === r.dest).length;
  const rows = d.routes.filter((r) => !scope || r.scope === scope);
  const toggle = (r: RouteDef, active: boolean) => { upsert("routes", { ...r, active }, false); toast(active ? t(`ເປີດໃຊ້ ${r.origin}-${r.dest} ແລ້ວ`, `${r.origin}-${r.dest} is active`) : t(`ປິດໃຊ້ ${r.origin}-${r.dest} ແລ້ວ. ເພີ່ມຖ້ຽວບິນໃໝ່ໃນເສັ້ນທາງນີ້ບໍ່ໄດ້`, `${r.origin}-${r.dest} is inactive. New flights cannot use it.`)); };
  const cols: Col<RouteDef>[] = [
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (r) => <Route from={r.origin} to={r.dest} />, sort: (r) => r.origin + r.dest },
    { key: "scope", header: t("ຂອບເຂດ", "Scope"), render: (r) => scopeLabel(t, r.scope), sort: (r) => r.scope },
    { key: "flights", header: t("ຖ້ຽວບິນໃນລະບົບ", "Flights on file"), align: "right", render: (r) => flightsOn(r), sort: (r) => flightsOn(r) },
    { key: "active", header: t("ສະຖານະ", "Status"), render: (r) => <Checkbox label={r.active ? t("ເປີດໃຊ້", "Active") : t("ປິດໃຊ້", "Inactive")} checked={r.active} disabled={!manage} onChange={(v) => toggle(r, v)} /> },
    ...(manage ? [{ key: "act", header: "", align: "right" as const, render: (r: RouteDef) => <span className="inline-flex"><IconButton icon={Pencil} label={t(`ແກ້ໄຂ ${r.origin}-${r.dest}`, `Edit ${r.origin}-${r.dest}`)} onClick={() => setEdit(r)} /><IconButton icon={Trash2} label={t(`ລຶບ ${r.origin}-${r.dest}`, `Delete ${r.origin}-${r.dest}`)} onClick={() => setDel(r)} /></span> }] : []),
  ];
  const n = del ? flightsOn(del) : 0;
  return <>
    <Panel flush>
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.id} minWidth={640} pageSize={15} defaultSort={{ key: "route", dir: "asc" }} search={(r) => `${r.origin} ${r.dest}`}
        filters={<Select aria-label={t("ຂອບເຂດ", "Scope")} className="w-auto" value={scope} onChange={(e) => setScope(e.target.value)} placeholder={t("ທຸກຂອບເຂດ", "All scopes")} options={scopeOptions(t)} />}
        toolbar={manage && <Button variant="primary" icon={Plus} onClick={() => setEdit("new")}>{t("ເພີ່ມເສັ້ນທາງ", "Add route")}</Button>} />
    </Panel>
    {edit && <RouteForm route={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
    <Dialog open={!!del && n > 0} onClose={() => setDel(null)} size="sm" title={t("ລຶບເສັ້ນທາງນີ້ບໍ່ໄດ້", "This route cannot be deleted")} footer={<><Button onClick={() => setDel(null)}>{t("ປິດ", "Close")}</Button>{del?.active && <Button variant="primary" onClick={() => { toggle(del, false); setDel(null); }}>{t("ປິດໃຊ້ແທນ", "Deactivate instead")}</Button>}</>}>
      <p className="text-sm">{t(`ມີຖ້ຽວບິນ ${n} ຖ້ຽວໃນເສັ້ນທາງ ${del?.origin}-${del?.dest}. ໃຫ້ປິດໃຊ້ເສັ້ນທາງແທນການລຶບ.`, `${n} flights use ${del?.origin}-${del?.dest}. Deactivate the route instead of deleting it.`)}</p>
    </Dialog>
    <Confirm open={!!del && n === 0} onClose={() => setDel(null)} danger title={t(`ລຶບເສັ້ນທາງ ${del?.origin}-${del?.dest}?`, `Delete route ${del?.origin}-${del?.dest}?`)} body={t("ບໍ່ມີຖ້ຽວບິນໃນເສັ້ນທາງນີ້.", "No flight uses this route.")} confirmLabel={t("ລຶບເສັ້ນທາງ", "Delete route")} onConfirm={() => { if (del) { removeFrom("routes", del.id); toast(t("ລຶບເສັ້ນທາງແລ້ວ", "Route deleted")); } }} />
  </>;
}

function RouteForm({ route, onClose }: { route?: RouteDef; onClose: () => void }) {
  const d = useDb(); const t = useT(); const name = useName();
  const [f, setF] = useState<RouteDef>(route ?? { id: "", origin: d.session.station, dest: "", scope: "domestic", active: true });
  const [tried, setTried] = useState(false);
  const locked = !!route && d.flights.some((x) => x.origin === route.origin && x.dest === route.dest);
  const errs = {
    origin: f.origin ? "" : REQ(t),
    dest: !f.dest ? REQ(t) : f.dest === f.origin ? t("ຕົ້ນທາງ ແລະ ປາຍທາງຕ້ອງຕ່າງກັນ", "Origin and destination must differ") : d.routes.some((r) => r.id !== f.id && r.origin === f.origin && r.dest === f.dest) ? t(`ມີເສັ້ນທາງ ${f.origin}-${f.dest} ແລ້ວ`, `${f.origin}-${f.dest} already exists`) : "",
  };
  const save = () => {
    setTried(true); if (errs.origin || errs.dest) return;
    upsert("routes", { ...f, id: f.id || newId("RT"), scope: scopeOf(getDb(), f.origin, f.dest) }, !route);
    toast(route ? t("ບັນທຶກເສັ້ນທາງແລ້ວ", "Route saved") : t(`ເພີ່ມເສັ້ນທາງ ${f.origin}-${f.dest} ແລ້ວ`, `Route ${f.origin}-${f.dest} added`)); onClose();
  };
  const stations = d.stations.filter((s) => s.active || s.code === f.origin || s.code === f.dest).map((s) => ({ value: s.code, label: `${s.code} · ${name(s)}` }));
  return <Dialog open onClose={onClose} size="sm" title={route ? t("ແກ້ໄຂເສັ້ນທາງ", "Edit route") : t("ເພີ່ມເສັ້ນທາງ", "Add route")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{route ? t("ບັນທຶກການແກ້ໄຂ", "Save changes") : t("ເພີ່ມເສັ້ນທາງ", "Add route")}</Button></>}>
    {locked && <div className="mb-3"><Callout tone="info">{t("ເສັ້ນທາງນີ້ມີຖ້ຽວບິນແລ້ວ ຈຶ່ງປ່ຽນສະຖານີບໍ່ໄດ້.", "This route has flights, so its stations cannot change.")}</Callout></div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("ຕົ້ນທາງ", "Origin")} required error={tried && errs.origin || undefined}><Select value={f.origin} disabled={locked} placeholder={t("ເລືອກສະຖານີ", "Choose a station")} onChange={(e) => setF({ ...f, origin: e.target.value })} options={stations} /></Field>
      <Field label={t("ປາຍທາງ", "Destination")} required error={tried && errs.dest || undefined}><Select value={f.dest} disabled={locked} placeholder={t("ເລືອກສະຖານີ", "Choose a station")} onChange={(e) => setF({ ...f, dest: e.target.value })} options={stations} /></Field>
    </div>
    <p className="mt-2 text-xs text-ink-2">{t("ເສັ້ນທາງແຍກຕາມທິດ. ຂາກັບຕ້ອງເພີ່ມເປັນອີກເສັ້ນທາງໜຶ່ງ.", "Routes are one-way. Add the return leg as its own route.")}{f.origin && f.dest && f.origin !== f.dest ? ` ${t("ຂອບເຂດ", "Scope")}: ${scopeLabel(t, scopeOf(d, f.origin, f.dest))}.` : ""}</p>
    <div className="mt-3"><Checkbox label={t("ເປີດໃຊ້ເສັ້ນທາງນີ້", "This route is active")} checked={f.active} onChange={(v) => setF({ ...f, active: v })} /></div>
  </Dialog>;
}

// ---------- Aircraft ----------
function AircraftTab({ manage }: { manage: boolean }) {
  const d = useDb(); const t = useT();
  const [edit, setEdit] = useState<Aircraft | "new" | null>(null); const [del, setDel] = useState<Aircraft | null>(null);
  const flightsOf = (code: string) => d.flights.filter((f) => f.aircraft === code).length;
  const cols: Col<Aircraft>[] = [
    { key: "code", header: t("ລະຫັດ", "Code"), mono: true, render: (a) => <span className="font-semibold">{a.code}</span>, sort: (a) => a.code },
    { key: "name", header: t("ແບບເຮືອບິນ", "Aircraft type"), render: (a) => a.nameEn, sort: (a) => a.nameEn },
    { key: "kg", header: t("ນໍ້າໜັກສິນຄ້າສູງສຸດ", "Max cargo weight"), align: "right", render: (a) => `${num(a.maxCargoKg)} kg`, sort: (a) => a.maxCargoKg },
    { key: "m3", header: t("ບໍລິມາດສິນຄ້າສູງສຸດ", "Max cargo volume"), align: "right", render: (a) => `${num(a.maxCargoM3, a.maxCargoM3 % 1 ? 1 : 0)} m³`, sort: (a) => a.maxCargoM3 },
    { key: "flights", header: t("ຖ້ຽວບິນໃນລະບົບ", "Flights on file"), align: "right", render: (a) => flightsOf(a.code), sort: (a) => flightsOf(a.code) },
    ...(manage ? [{ key: "act", header: "", align: "right" as const, render: (a: Aircraft) => <span className="inline-flex"><IconButton icon={Pencil} label={t(`ແກ້ໄຂ ${a.code}`, `Edit ${a.code}`)} onClick={() => setEdit(a)} /><IconButton icon={Trash2} label={t(`ລຶບ ${a.code}`, `Delete ${a.code}`)} onClick={() => setDel(a)} /></span> }] : []),
  ];
  const n = del ? flightsOf(del.code) : 0;
  return <>
    <Panel flush>
      <DataTable rows={d.aircraft} columns={cols} rowKey={(a) => a.code} minWidth={640} defaultSort={{ key: "code", dir: "asc" }} search={(a) => `${a.code} ${a.nameEn}`} toolbar={manage && <Button variant="primary" icon={Plus} onClick={() => setEdit("new")}>{t("ເພີ່ມເຮືອບິນ", "Add aircraft")}</Button>} />
    </Panel>
    {edit && <AircraftForm aircraft={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
    <Dialog open={!!del && n > 0} onClose={() => setDel(null)} size="sm" title={t(`ລຶບ ${del?.code ?? ""} ບໍ່ໄດ້`, `${del?.code ?? ""} cannot be deleted`)} footer={<Button onClick={() => setDel(null)}>{t("ປິດ", "Close")}</Button>}>
      <p className="text-sm">{t(`ມີຖ້ຽວບິນ ${n} ຖ້ຽວໃຊ້ເຮືອບິນແບບນີ້. ກະລຸນາປ່ຽນເຮືອບິນຂອງຖ້ຽວເຫຼົ່ານັ້ນກ່ອນ.`, `${n} flights use this aircraft type. Change the aircraft on those flights first.`)}</p>
    </Dialog>
    <Confirm open={!!del && n === 0} onClose={() => setDel(null)} danger title={t(`ລຶບເຮືອບິນ ${del?.code ?? ""}?`, `Delete aircraft ${del?.code ?? ""}?`)} body={t("ບໍ່ມີຖ້ຽວບິນໃຊ້ເຮືອບິນແບບນີ້.", "No flight uses this aircraft type.")} confirmLabel={t("ລຶບເຮືອບິນ", "Delete aircraft")} onConfirm={() => { if (del) { removeFrom("aircraft", del.code); toast(t(`ລຶບ ${del.code} ແລ້ວ`, `${del.code} deleted`)); } }} />
  </>;
}

function AircraftForm({ aircraft, onClose }: { aircraft?: Aircraft; onClose: () => void }) {
  const d = useDb(); const t = useT();
  const [code, setCode] = useState(aircraft?.code ?? ""); const [nameEn, setName] = useState(aircraft?.nameEn ?? ""); const [kg, setKg] = useState(aircraft ? String(aircraft.maxCargoKg) : ""); const [m3, setM3] = useState(aircraft ? String(aircraft.maxCargoM3) : "");
  const [tried, setTried] = useState(false);
  const errs = {
    code: aircraft ? "" : !/^[A-Z0-9]{3}$/.test(code) ? t("ລະຫັດຕ້ອງມີ 3 ຕົວ ເຊັ່ນ AT7", "The code must be 3 characters, such as AT7") : d.aircraft.some((a) => a.code === code) ? t(`ມີລະຫັດ ${code} ແລ້ວ`, `${code} already exists`) : "",
    name: nameEn.trim() ? "" : REQ(t),
    kg: Number(kg) > 0 ? "" : t("ກະລຸນາປ້ອນນໍ້າໜັກທີ່ຫຼາຍກວ່າ 0", "Enter a weight above 0"),
    m3: Number(m3) > 0 ? "" : t("ກະລຸນາປ້ອນບໍລິມາດທີ່ຫຼາຍກວ່າ 0", "Enter a volume above 0"),
  };
  const save = () => {
    setTried(true); if (Object.values(errs).some(Boolean)) return;
    upsert("aircraft", { code, nameEn: nameEn.trim(), maxCargoKg: Number(kg), maxCargoM3: Number(m3) }, !aircraft);
    toast(aircraft ? t(`ບັນທຶກ ${code} ແລ້ວ`, `${code} saved`) : t(`ເພີ່ມເຮືອບິນ ${code} ແລ້ວ`, `Aircraft ${code} added`)); onClose();
  };
  return <Dialog open onClose={onClose} size="sm" title={aircraft ? t(`ແກ້ໄຂເຮືອບິນ ${aircraft.code}`, `Edit aircraft ${aircraft.code}`) : t("ເພີ່ມເຮືອບິນ", "Add aircraft")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{aircraft ? t("ບັນທຶກການແກ້ໄຂ", "Save changes") : t("ເພີ່ມເຮືອບິນ", "Add aircraft")}</Button></>}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("ລະຫັດ IATA", "IATA type code")} required error={tried && errs.code || undefined}><Input className="font-mono" maxLength={3} value={code} disabled={!!aircraft} onChange={(e) => setCode(e.target.value.toUpperCase())} /></Field>
      <Field label={t("ແບບເຮືອບິນ", "Aircraft type")} required error={tried && errs.name || undefined}><Input value={nameEn} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label={t("ນໍ້າໜັກສິນຄ້າສູງສຸດ (kg)", "Max cargo weight (kg)")} required error={tried && errs.kg || undefined}><Input type="number" min={0} value={kg} onChange={(e) => setKg(e.target.value)} /></Field>
      <Field label={t("ບໍລິມາດສິນຄ້າສູງສຸດ (m³)", "Max cargo volume (m³)")} required error={tried && errs.m3 || undefined}><Input type="number" min={0} step="0.1" value={m3} onChange={(e) => setM3(e.target.value)} /></Field>
    </div>
    <p className="mt-2 text-xs text-ink-2">{t("ຄ່ານີ້ໃຊ້ກວດຄວາມຈຸຕອນຈອງ ແລະ ເຮັດ Manifest ຂອງທຸກຖ້ຽວທີ່ໃຊ້ເຮືອບິນແບບນີ້.", "These limits drive the capacity checks at booking and on the manifest for every flight using this type.")}</p>
  </Dialog>;
}
