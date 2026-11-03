import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Ban, Check, Clock, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { Badge, BarMeter, Button, Callout, Checkbox, Col, Confirm, DataTable, Dialog, Dl, Empty, Field, Input, PageHeader, Panel, Select, StatRow, Tabs, toast, type Tone } from "@/ui/kit";
import { AwbLink, flightLabel, Route, SHC_LIST, ShcTags, userName } from "@/ui/cargo";
import type { Booking, BookingStatus, Db, Flight, Lang } from "@/lib/types";
import { fmtDate, fmtDateTime, kg, num, pad, todayIso } from "@/lib/format";
import { createBooking, decideBooking, deleteBooking, flightCapacity, updateBooking } from "@/lib/mock/booking";

const part = (s: string, lang: Lang) => { const p = s.split(" / "); return lang === "lo" ? p[0] : p[p.length - 1]; };
const STATUS: Record<BookingStatus, [Tone, string, string]> = { requested: ["warn", "ລໍຖ້າອະນຸມັດ", "Requested"], confirmed: ["ok", "ຢືນຢັນແລ້ວ", "Confirmed"], waitlisted: ["info", "ລໍຖ້າພື້ນທີ່", "Waitlisted"], rejected: ["bad", "ປະຕິເສດ", "Rejected"], cancelled: ["neutral", "ຍົກເລີກ", "Cancelled"], converted: ["ok", "ອອກ AWB ແລ້ວ", "AWB issued"] };
const ORDER: BookingStatus[] = ["requested", "confirmed", "waitlisted", "converted", "rejected", "cancelled"];
function isFuture(f: Flight) { const n = new Date(); const today = todayIso(); return f.date > today || (f.date === today && f.std > `${pad(n.getHours())}:${pad(n.getMinutes())}`); }
/** Space on a flight, leaving out this booking's own weight when it is already counted as confirmed. */
function spaceFor(d: Db, flightId: string, weightKg: number, volumeM3: number, excludeId?: string) {
  const cap = flightCapacity(d, flightId); const own = d.bookings.find((b) => b.id === excludeId && b.flightId === flightId && b.status === "confirmed");
  const base = cap.usedKg - (own?.weightKg ?? 0); const remaining = cap.maxKg - base; const after = base + weightKg;
  const usedM3 = d.awbs.filter((a) => a.flightId === flightId && a.status === "active" && a.direction !== "import").reduce((s, a) => s + a.volumeKg / 166.67, 0) + d.bookings.filter((b) => b.flightId === flightId && b.status === "confirmed" && b.id !== excludeId).reduce((s, b) => s + b.volumeM3, 0);
  return { cap, base, remaining, after, over: after > cap.maxKg, usedM3, overM3: usedM3 + volumeM3 > cap.maxM3 };
}

function SpaceMeter({ flightId, weightKg, volumeM3, excludeId }: { flightId: string; weightKg: number; volumeM3: number; excludeId?: string }) {
  const d = useDb(); const t = useT(); const s = spaceFor(d, flightId, weightKg, volumeM3, excludeId); const { cap } = s;
  return <div className="rounded border border-line bg-surface-2 p-3">
    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4 text-sm"><span className="font-medium">{t("ພື້ນທີ່ຖ້ຽວບິນ", "Flight space")} <span className="font-mono text-[13px]">{flightLabel(d, flightId)} · {cap.aircraft?.nameEn}</span></span><span className="tnum">{t("ລວມການຈອງນີ້", "With this booking")} <b>{num(s.after)}</b> / {num(cap.maxKg)} kg</span></div>
    <BarMeter value={s.after} max={cap.maxKg} label={t("ພື້ນທີ່ໃຊ້", "Space used")} />
    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-2 sm:grid-cols-4"><div>AWB <span className="tnum font-medium text-ink">{kg(cap.awbKg)}</span></div><div>{t("ການຈອງຢືນຢັນ", "Confirmed bookings")} <span className="tnum font-medium text-ink">{kg(s.base - cap.awbKg - cap.mailKg)}</span></div><div>{t("ຖົງເມ", "Mail")} <span className="tnum font-medium text-ink">{kg(cap.mailKg)}</span></div><div>{t("ຍັງເຫຼືອ", "Remaining")} <span className="tnum font-semibold text-ink">{kg(s.remaining)}</span></div></dl>
    {s.over && <div className="mt-2"><Callout tone="warn" title={t(`ເກີນພື້ນທີ່ຍັງເຫຼືອ ${kg(s.after - cap.maxKg)}`, `Exceeds the remaining space by ${kg(s.after - cap.maxKg)}`)}>{t("ໃສ່ໃນລາຍການລໍຖ້າ ຫຼື ເລືອກຖ້ຽວບິນອື່ນ.", "Waitlist it or choose another flight.")}</Callout></div>}
    {s.overM3 && <div className="mt-2"><Callout tone="warn" title={t("ເກີນບໍລິມາດ", "Exceeds the hold volume")}>{t(`ໃຊ້ແລ້ວ ${num(s.usedM3, 1)} m³ ຈາກ ${cap.maxM3} m³. ກວດຂະໜາດສິນຄ້າກັບຜູ້ຈັດການ.`, `${num(s.usedM3, 1)} m³ of ${cap.maxM3} m³ is used. Check the dimensions with the manager.`)}</Callout></div>}
  </div>;
}

function SpecialFlag({ codes }: { codes: string[] }) {
  const t = useT(); if (!codes.length) return null;
  return <Callout tone="warn" title={t(`ສິນຄ້າພິເສດ ${codes.join(", ")}: ຕ້ອງໄດ້ຮັບການອະນຸມັດ`, `Special cargo ${codes.join(", ")}: needs approval`)}>{t("ຜູ້ຈັດການພະແນກຕ້ອງກວດເງື່ອນໄຂການຮັບຂົນສົ່ງ ແລະ ພື້ນທີ່ເກັບຮັກສາກ່ອນຢືນຢັນ.", "The Cargo Manager checks acceptance conditions and storage before confirming.")}</Callout>;
}

function BookingForm({ booking, presetCustomer, onClose }: { booking?: Booking; presetCustomer?: string; onClose: () => void }) {
  const d = useDb(); const t = useT(); const st = booking?.origin ?? d.session.station;
  const [customerId, setCustomer] = useState(booking?.customerId ?? presetCustomer ?? ""); const [dest, setDest] = useState(booking?.dest ?? ""); const [flightId, setFlight] = useState(booking?.flightId ?? "");
  const [pieces, setPieces] = useState(booking ? String(booking.pieces) : ""); const [weight, setWeight] = useState(booking ? String(booking.weightKg) : ""); const [volume, setVolume] = useState(booking ? String(booking.volumeM3) : "");
  const [commodity, setCommodity] = useState(booking?.commodity ?? ""); const [shc, setShc] = useState<string[]>(booking?.shc ?? []); const [tried, setTried] = useState(false);
  const flights = d.flights.filter((f) => f.origin === st && (f.id === booking?.flightId || (f.status === "open" && isFuture(f)))).sort((a, b) => `${a.date}${a.std}`.localeCompare(`${b.date}${b.std}`));
  const dests = [...new Set(flights.map((f) => f.dest))].sort(); const shown = flights.filter((f) => !dest || f.dest === dest);
  const f = d.flights.find((x) => x.id === flightId); const kgN = Number(weight) || 0; const m3N = Number(volume) || 0; const pcsN = Number(pieces) || 0;
  const errors = { customer: !customerId, flight: !f, pieces: pcsN < 1 || !Number.isInteger(pcsN), weight: kgN <= 0, volume: m3N <= 0, commodity: !commodity.trim() };
  function save() {
    setTried(true); if (Object.values(errors).some(Boolean) || !f) return;
    const body = { customerId, flightId: f.id, origin: f.origin, dest: f.dest, pieces: pcsN, weightKg: kgN, volumeM3: m3N, commodity: commodity.trim(), shc };
    if (booking) { updateBooking(booking.id, body); toast(t(`ບັນທຶກ ${booking.no} ແລ້ວ`, `${booking.no} updated`)); } else { const b = createBooking({ ...body, channel: "counter" }); toast(t(`ສ້າງການຈອງ ${b.no} ແລ້ວ. ລໍຖ້າອະນຸມັດ.`, `Booking ${b.no} created, waiting for approval.`)); }
    onClose();
  }
  return <Dialog open size="lg" onClose={onClose} title={booking ? t(`ແກ້ໄຂ ${booking.no}`, `Edit ${booking.no}`) : t(`ຈອງພື້ນທີ່ໃໝ່ ຈາກ ${st}`, `New booking from ${st}`)} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{booking ? t("ບັນທຶກ", "Save changes") : t("ສ້າງການຈອງ", "Create booking")}</Button></>}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field className="sm:col-span-2" label={t("ລູກຄ້າ", "Customer")} required error={tried && errors.customer ? t("ເລືອກລູກຄ້າ", "Choose a customer") : undefined}><Select value={customerId} onChange={(e) => setCustomer(e.target.value)} placeholder={t("ເລືອກລູກຄ້າ", "Choose a customer")} options={d.customers.filter((c) => c.active || c.id === customerId).map((c) => ({ value: c.id, label: `${c.code} · ${t(c.name, c.nameEn)}` }))} /></Field>
      <Field label={t("ປາຍທາງ", "Destination")}><Select value={dest} onChange={(e) => { setDest(e.target.value); if (f && e.target.value && f.dest !== e.target.value) setFlight(""); }} placeholder={t("ທຸກປາຍທາງ", "All destinations")} options={dests.map((x) => ({ value: x, label: x }))} /></Field>
      <Field label={t("ຖ້ຽວບິນ", "Flight")} required error={tried && errors.flight ? t("ເລືອກຖ້ຽວບິນທີ່ເປີດຮັບ", "Choose an open flight") : undefined} hint={shown.length ? undefined : t(`ບໍ່ມີຖ້ຽວບິນເປີດຮັບຈາກ ${st}`, `No open flights from ${st}`)}><Select value={flightId} onChange={(e) => { setFlight(e.target.value); const x = d.flights.find((y) => y.id === e.target.value); if (x) setDest(x.dest); }} placeholder={t("ເລືອກຖ້ຽວບິນ", "Choose a flight")} options={shown.map((x) => ({ value: x.id, label: `${x.no} → ${x.dest} ${fmtDate(x.date)} ${x.std} · ${num(flightCapacity(d, x.id).remainingKg)} kg` }))} /></Field>
      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <Field label={t("ຈໍານວນກ່ອງ", "Pieces")} required error={tried && errors.pieces ? t("ຢ່າງໜ້ອຍ 1", "At least 1") : undefined}><Input type="number" min={1} value={pieces} onChange={(e) => setPieces(e.target.value)} /></Field>
        <Field label={t("ນໍ້າໜັກ (kg)", "Weight (kg)")} required error={tried && errors.weight ? t("ປ້ອນນໍ້າໜັກ", "Enter the weight") : undefined}><Input type="number" min={0} step={0.5} value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
        <Field label={t("ບໍລິມາດ (m³)", "Volume (m³)")} required error={tried && errors.volume ? t("ປ້ອນບໍລິມາດ", "Enter the volume") : undefined}><Input type="number" min={0} step={0.1} value={volume} onChange={(e) => setVolume(e.target.value)} /></Field>
      </div>
      <Field className="sm:col-span-2" label={t("ສິນຄ້າ", "Commodity")} required error={tried && errors.commodity ? t("ປ້ອນລາຍລະອຽດສິນຄ້າ", "Describe the goods") : undefined}><Input value={commodity} onChange={(e) => setCommodity(e.target.value)} /></Field>
      <div className="sm:col-span-2"><span className="box-label mb-1 block">{t("ລະຫັດສິນຄ້າພິເສດ SHC", "Special handling codes (SHC)")}</span><div className="flex flex-wrap gap-x-4 gap-y-1">{SHC_LIST.map((s) => <Checkbox key={s.code} label={`${s.code} ${t(s.lo, s.en)}`} checked={shc.includes(s.code)} onChange={(v) => setShc((x) => v ? [...x, s.code] : x.filter((c) => c !== s.code))} />)}</div></div>
      {f && <div className="sm:col-span-2"><SpaceMeter flightId={f.id} weightKg={kgN} volumeM3={m3N} excludeId={booking?.id} /></div>}
      {shc.length > 0 && <div className="sm:col-span-2"><SpecialFlag codes={shc} /></div>}
    </div>
  </Dialog>;
}

function ReviewDialog({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (b: Booking) => void }) {
  const d = useDb(); const t = useT(); const lang = useLang(); const can = useCan();
  const [ask, setAsk] = useState<"confirmed" | "waitlisted" | "rejected" | "cancelled" | "delete" | null>(null);
  const b = d.bookings.find((x) => x.id === id);
  if (!b) return null;
  const c = d.customers.find((x) => x.id === b.customerId); const f = d.flights.find((x) => x.id === b.flightId); const awb = d.awbs.find((a) => a.id === b.awbId); const s = spaceFor(d, b.flightId, b.weightKg, b.volumeM3, b.id);
  const approver = can("booking.approve"); const manage = can("booking.manage"); const open = ["requested", "waitlisted", "confirmed"].includes(b.status);
  const decide = (st: "confirmed" | "waitlisted" | "rejected" | "cancelled", reason?: string) => { decideBooking(b.id, st, reason); toast(t(`${b.no}: ${STATUS[st][1]}`, `${b.no}: ${STATUS[st][2]}`), st === "rejected" ? "warn" : "ok"); };
  return <Dialog open size="lg" onClose={onClose} title={b.no} footer={<>
    {manage && b.status !== "converted" && <Button variant="danger" icon={Trash2} onClick={() => setAsk("delete")}>{t("ລຶບ", "Delete")}</Button>}
    {manage && open && <Button icon={Pencil} onClick={() => onEdit(b)}>{t("ແກ້ໄຂ", "Edit")}</Button>}
    <span className="flex-1" />
    {approver && open && <Button icon={Ban} onClick={() => setAsk("cancelled")}>{t("ຍົກເລີກການຈອງ", "Cancel booking")}</Button>}
    {approver && (b.status === "requested" || b.status === "waitlisted") && <Button variant="danger" icon={X} onClick={() => setAsk("rejected")}>{t("ປະຕິເສດ", "Reject")}</Button>}
    {approver && (b.status === "requested" || b.status === "confirmed") && <Button icon={Clock} onClick={() => setAsk("waitlisted")}>{t("ໃສ່ລາຍການລໍຖ້າ", "Waitlist")}</Button>}
    {approver && (b.status === "requested" || b.status === "waitlisted") && <Button variant="success" icon={Check} onClick={() => { if (s.over || s.overM3) setAsk("confirmed"); else decide("confirmed"); }}>{t("ອະນຸມັດ", "Approve")}</Button>}
    {b.status === "confirmed" && can("awb.issue") && <Link to={`/export/awb/new?booking=${b.id}`}><Button variant="primary" icon={FileText}>{t("ອອກ AWB", "Issue AWB")}</Button></Link>}
  </>}>
    <div className="mb-3 flex flex-wrap items-center gap-2"><Badge tone={STATUS[b.status][0]}>{t(STATUS[b.status][1], STATUS[b.status][2])}</Badge><Badge noIcon>{b.channel === "portal" ? "Portal" : t("ເຄົາເຕີ", "Counter")}</Badge></div>
    <Dl cols={3} items={[
      { label: t("ລູກຄ້າ", "Customer"), value: c ? <Link className="text-brand hover:underline" to={`/crm/${c.id}`}>{t(c.name, c.nameEn)}</Link> : "—" },
      { label: t("ຖ້ຽວບິນ", "Flight"), value: f ? <span className="font-mono text-[13px]">{f.no} {fmtDate(f.date)} {f.std}</span> : "—" },
      { label: t("ເສັ້ນທາງ", "Route"), value: <Route from={b.origin} to={b.dest} /> },
      { label: t("ຈໍານວນກ່ອງ", "Pieces"), value: <span className="tnum">{b.pieces}</span> },
      { label: t("ນໍ້າໜັກ", "Weight"), value: kg(b.weightKg) },
      { label: t("ບໍລິມາດ", "Volume"), value: <span className="tnum">{b.volumeM3} m³</span> },
      { label: t("ສິນຄ້າ", "Commodity"), value: <span className="inline-flex flex-wrap items-center gap-1.5">{part(b.commodity, lang)}<ShcTags codes={b.shc} /></span> },
      { label: t("ວັນທີຮັບຄໍາຂໍ", "Requested"), value: <span className="tnum">{fmtDateTime(b.createdAt)}</span> },
      { label: t("ຜູ້ຕັດສິນ", "Decided by"), value: b.decidedBy ? `${userName(d, b.decidedBy, lang)} · ${fmtDateTime(b.decidedAt)}` : b.decidedAt ? t("ລູກຄ້າທາງ Portal", "Customer on the portal") : t("ຍັງບໍ່ຕັດສິນ", "Not decided yet") },
    ]} />
    {b.reason && <div className="mt-3"><Callout tone={b.status === "rejected" ? "bad" : b.status === "waitlisted" ? "info" : "neutral"} title={t("ເຫດຜົນ", "Reason")}>{part(b.reason, lang)}</Callout></div>}
    {awb && <div className="mt-3"><Callout tone="ok" title={t("ອອກ AWB ແລ້ວ", "AWB issued")}><AwbLink awb={awb} /></Callout></div>}
    {open && <div className="mt-3"><SpaceMeter flightId={b.flightId} weightKg={b.weightKg} volumeM3={b.volumeM3} excludeId={b.id} /></div>}
    {open && b.shc.length > 0 && <div className="mt-3"><SpecialFlag codes={b.shc} /></div>}
    {open && !approver && <div className="mt-3"><Callout title={t("ຕ້ອງໃຫ້ຜູ້ຈັດການອະນຸມັດ", "Approval is for the Cargo Manager")}>{t("ບົດບາດຂອງທ່ານສ້າງ ແລະ ແກ້ໄຂການຈອງໄດ້. ການອະນຸມັດ, ລາຍການລໍຖ້າ, ການປະຕິເສດ ແລະ ການຍົກເລີກ ຕ້ອງໃຊ້ສິດຜູ້ຈັດການ.", "Your role can create and edit bookings. Approving, waitlisting, rejecting and cancelling need manager rights.")}</Callout></div>}
    {b.status === "confirmed" && !can("awb.issue") && <p className="mt-3 text-xs text-ink-2">{t("ພະນັກງານຮັບສິນຄ້າ ເປັນຜູ້ອອກ AWB ຈາກການຈອງນີ້.", "An Acceptance Officer issues the AWB from this booking.")}</p>}
    <Confirm open={ask === "confirmed"} onClose={() => setAsk(null)} title={t(`ອະນຸມັດ ${b.no} ທັງທີ່ເກີນພື້ນທີ່?`, `Approve ${b.no} over capacity?`)} body={t(`ຈະເກີນພື້ນທີ່ຖ້ຽວບິນ ${kg(Math.max(0, s.after - s.cap.maxKg))}. ສິນຄ້າບາງສ່ວນອາດຕ້ອງອ໋ອບໂຫຼດ.`, `This goes ${kg(Math.max(0, s.after - s.cap.maxKg))} over the flight's space. Some cargo may have to be offloaded.`)} confirmLabel={t("ອະນຸມັດທັງທີ່ເກີນ", "Approve anyway")} onConfirm={() => decide("confirmed")} />
    <Confirm open={ask === "waitlisted"} onClose={() => setAsk(null)} title={t(`ໃສ່ ${b.no} ໃນລາຍການລໍຖ້າ`, `Waitlist ${b.no}`)} reasonLabel={t("ເຫດຜົນ (ລູກຄ້າເຫັນໃນ Portal)", "Reason (the customer sees it on the portal)")} confirmLabel={t("ໃສ່ລາຍການລໍຖ້າ", "Waitlist")} onConfirm={(r) => decide("waitlisted", r)} />
    <Confirm open={ask === "rejected"} onClose={() => setAsk(null)} danger title={t(`ປະຕິເສດ ${b.no}`, `Reject ${b.no}`)} reasonLabel={t("ເຫດຜົນ (ລູກຄ້າເຫັນໃນ Portal)", "Reason (the customer sees it on the portal)")} confirmLabel={t("ປະຕິເສດການຈອງ", "Reject booking")} onConfirm={(r) => decide("rejected", r)} />
    <Confirm open={ask === "cancelled"} onClose={() => setAsk(null)} danger title={t(`ຍົກເລີກ ${b.no}`, `Cancel ${b.no}`)} body={t("ພື້ນທີ່ຈະຖືກຄືນໃຫ້ຖ້ຽວບິນ.", "The space goes back to the flight.")} reasonLabel={t("ເຫດຜົນ", "Reason")} confirmLabel={t("ຍົກເລີກການຈອງ", "Cancel booking")} onConfirm={(r) => decide("cancelled", r)} />
    <Confirm open={ask === "delete"} onClose={() => setAsk(null)} danger title={t(`ລຶບ ${b.no}?`, `Delete ${b.no}?`)} body={t("ການຈອງນີ້ຈະຖືກລຶບອອກຈາກລະບົບ ແລະ ບັນທຶກໃນ Audit Trail.", "This booking is removed and the deletion is kept in the audit trail.")} confirmLabel={t("ລຶບການຈອງ", "Delete booking")} onConfirm={() => { deleteBooking(b.id); toast(t("ລຶບການຈອງແລ້ວ", "Booking deleted")); onClose(); }} />
  </Dialog>;
}

export default function Bookings() {
  const d = useDb(); const t = useT(); const lang = useLang(); const can = useCan(); const st = d.session.station; const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<BookingStatus>("requested"); const [form, setForm] = useState<{ booking?: Booking; customer?: string } | null>(null); const [review, setReview] = useState<string | null>(null);
  useEffect(() => { if (params.get("new") && can("booking.manage")) { setForm({ customer: params.get("customer") ?? undefined }); setParams({}, { replace: true }); } /* eslint-disable-next-line */ }, []);
  const all = useMemo(() => d.bookings.filter((b) => b.origin === st), [d.bookings, st]);
  const rows = all.filter((b) => b.status === tab);
  const count = (s: BookingStatus) => all.filter((b) => b.status === s).length;
  const requestedKg = all.filter((b) => b.status === "requested").reduce((s, b) => s + b.weightKg, 0);
  const confirmedKg = all.filter((b) => b.status === "confirmed").reduce((s, b) => s + b.weightKg, 0);
  const specials = all.filter((b) => b.status === "requested" && b.shc.length > 0).length;
  const cols: Col<Booking>[] = [
    { key: "no", header: t("ເລກການຈອງ", "Booking"), mono: true, render: (b) => <span className="font-semibold">{b.no}</span>, sort: (b) => b.createdAt },
    { key: "cust", header: t("ລູກຄ້າ", "Customer"), render: (b) => { const c = d.customers.find((x) => x.id === b.customerId); return <span className="line-clamp-1">{c ? t(c.name, c.nameEn) : "—"}</span>; } },
    { key: "ch", header: t("ຊ່ອງທາງ", "Channel"), render: (b) => <Badge noIcon>{b.channel === "portal" ? "Portal" : t("ເຄົາເຕີ", "Counter")}</Badge> },
    { key: "flight", header: t("ຖ້ຽວບິນ", "Flight"), render: (b) => <span className="whitespace-nowrap"><span className="font-mono text-[13px]">{flightLabel(d, b.flightId)}</span> <Route from={b.origin} to={b.dest} /></span>, sort: (b) => d.flights.find((f) => f.id === b.flightId)?.date ?? "" },
    { key: "comm", header: t("ສິນຄ້າ", "Commodity"), render: (b) => <span className="inline-flex items-center gap-1.5"><span className="line-clamp-1">{part(b.commodity, lang)}</span><ShcTags codes={b.shc} /></span> },
    { key: "pcs", header: t("ກ່ອງ", "Pcs"), align: "right", render: (b) => b.pieces },
    { key: "kg", header: "kg", align: "right", render: (b) => num(b.weightKg), sort: (b) => b.weightKg },
    { key: "m3", header: "m³", align: "right", render: (b) => b.volumeM3 },
    ...(tab === "requested" || tab === "waitlisted" || tab === "confirmed" ? [{ key: "space", header: t("ພື້ນທີ່ຍັງເຫຼືອ", "Space left"), align: "right" as const, render: (b: Booking) => { const s = spaceFor(d, b.flightId, b.weightKg, b.volumeM3, b.id); return <span className={s.over ? "whitespace-nowrap font-semibold text-bad" : "whitespace-nowrap"}>{kg(s.remaining)}{s.over && <span className="block text-xs font-medium">{t("ບໍ່ພໍ", "Not enough")}</span>}</span>; } }] : []),
    { key: "dec", header: t("ການຕັດສິນ", "Decision"), render: (b) => b.status === "converted" ? (d.awbs.find((a) => a.id === b.awbId) ? <AwbLink awb={d.awbs.find((a) => a.id === b.awbId)!} /> : "") : b.decidedAt ? <span className="block max-w-[240px] text-xs">{b.reason && <span className="line-clamp-2">{part(b.reason, lang)}</span>}<span className="text-ink-2">{b.decidedBy ? userName(d, b.decidedBy, lang) : t("ລູກຄ້າທາງ Portal", "Customer on the portal")}</span></span> : b.shc.length ? <Badge tone="warn">{t("ສິນຄ້າພິເສດ", "Special cargo")}</Badge> : <span className="text-xs text-ink-3">{t("ລໍຖ້າ", "Waiting")}</span> },
  ];
  return <>
    <PageHeader title={t("ການຈອງພື້ນທີ່", "Space bookings")} subtitle={t(`ຄໍາຂໍຈອງຈາກເຄົາເຕີ ແລະ Portal ສໍາລັບຖ້ຽວບິນອອກຈາກ ${st}`, `Requests from the counter and the portal for flights leaving ${st}`)} actions={can("booking.manage") && <Button variant="primary" icon={Plus} onClick={() => setForm({})}>{t("ຈອງພື້ນທີ່ໃໝ່", "New booking")}</Button>} />
    <StatRow items={[
      { label: t("ລໍຖ້າອະນຸມັດ", "Waiting for approval"), value: count("requested"), sub: kg(requestedKg), tone: count("requested") ? "warn" : undefined },
      { label: t("ຢືນຢັນແລ້ວ", "Confirmed"), value: count("confirmed"), sub: kg(confirmedKg) },
      { label: t("ລາຍການລໍຖ້າ", "On the waitlist"), value: count("waitlisted") },
      { label: t("ສິນຄ້າພິເສດລໍຖ້າອະນຸມັດ", "Special cargo to approve"), value: specials, tone: specials ? "warn" : undefined },
    ]} />
    <Tabs value={tab} onChange={setTab} tabs={ORDER.map((s) => ({ key: s, label: t(STATUS[s][1], STATUS[s][2]), count: count(s) }))} />
    <Panel flush>
      <DataTable rows={rows} columns={cols} rowKey={(b) => b.id} minWidth={1100} defaultSort={{ key: "no", dir: "desc" }} onRowClick={(b) => setReview(b.id)} search={(b) => { const c = d.customers.find((x) => x.id === b.customerId); return `${b.no} ${c?.name} ${c?.nameEn} ${b.commodity} ${b.dest} ${flightLabel(d, b.flightId)}`; }}
        empty={<Empty title={t(`ບໍ່ມີການຈອງສະຖານະ ${STATUS[tab][1]}`, `No ${STATUS[tab][2].toLowerCase()} bookings at ${st}`)} action={can("booking.manage") ? <Button icon={Plus} onClick={() => setForm({})}>{t("ຈອງພື້ນທີ່ໃໝ່", "New booking")}</Button> : undefined}>{t("ເລືອກແຖບອື່ນ ຫຼື ປ່ຽນສະຖານີ.", "Choose another tab or change station.")}</Empty>} />
    </Panel>
    {review && <ReviewDialog id={review} onClose={() => setReview(null)} onEdit={(b) => { setReview(null); setForm({ booking: b }); }} />}
    {form && <BookingForm booking={form.booking} presetCustomer={form.customer} onClose={() => setForm(null)} />}
  </>;
}
