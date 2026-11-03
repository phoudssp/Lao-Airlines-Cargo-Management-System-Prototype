import { commit, getDb, me, nextId, nowIso, writeAudit } from "../store";
import type { Awb, AwbEvent, CargoMessage, ChargeLine, Condition, Db, House, MessageType, PieceLine, StageCode } from "../types";
import { awbNo, chargeable, pieceCount, STAGES, withCheckDigit } from "../pricing";
import { flightCapacity } from "./booking";
import { fmtDate } from "../format";
import { notifyOffload } from "./ops";

function ev(d: Db, a: Awb, code: AwbEvent["code"], extra: Partial<AwbEvent> = {}) { a.events.push({ id: nextId("EV"), code, ts: nowIso(), station: d.session.station, userId: me(d), ...extra }); }
export function advance(d: Db, a: Awb, stage: StageCode, extra: Partial<AwbEvent> = {}) { if (STAGES.indexOf(stage) > STAGES.indexOf(a.stage)) a.stage = stage; ev(d, a, stage, extra); }

/** Next free serial in the range assigned to the station. */
export function nextSerialFor(d: Db, station: string) { return d.awbStock.find((s) => s.active && s.assigneeType === "station" && s.assignee === station && s.nextSerial <= s.to); }

export interface AwbInput { bookingId?: string; shipperId: string; consigneeId: string; agentId?: string; origin: string; dest: string; flightId?: string; commodity: string; shc: string[]; lines: PieceLine[]; charges: ChargeLine[]; currency: string; payMode: "cash" | "credit"; houses?: House[] }
export function issueAwb(input: AwbInput) {
  const d0 = getDb(); const stock = nextSerialFor(d0, d0.session.station);
  if (!stock) return { ok: false as const, error: "no_stock" as const };
  const serial = withCheckDigit(stock.nextSerial);
  const c = chargeable(input.lines);
  const id = `AWB-${serial}`;
  const total = input.charges.reduce((s, x) => s + x.amount, 0);
  commit((d) => {
    const st = d.awbStock.find((s) => s.id === stock.id)!; st.nextSerial += 1;
    const a: Awb = { id, prefix: stock.prefix, serial, no: awbNo(stock.prefix, serial), direction: "export", status: "active", ...input, station: d.session.station, pieces: pieceCount(input.lines), grossKg: c.gross, volumeKg: Math.round(c.vol * 10) / 10, chargeableKg: c.chargeable, roundedTo: 0.5, total, paid: false, events: [], stage: "RCS", houses: input.houses ?? [], receivedPieces: pieceCount(input.lines), loadedPieces: 0, deliveredPieces: 0, condition: "good", issuedBy: me(d), issuedAt: nowIso(), offloadedPieces: 0 };
    if (input.bookingId) { const b = d.bookings.find((x) => x.id === input.bookingId); if (b) { b.status = "converted"; b.awbId = id; } ev(d, a, "BKD", { note: b?.no }); }
    ev(d, a, "RCS", { pieces: a.pieces });
    const z = d.zones.find((x) => x.station === d.session.station && x.type === (a.shc.includes("PER") ? "cold" : a.shc.includes("VAL") ? "valuable" : "general")); a.zoneId = z?.id;
    d.awbs.unshift(a); writeAudit(d, "issue_awb", "Awb", id, `${a.no} ${a.origin}-${a.dest} ${c.chargeable} kg`);
  });
  return { ok: true as const, id };
}
export function correctAwb(id: string, patch: Partial<Pick<Awb, "commodity" | "consigneeId" | "shipperId" | "flightId" | "lines" | "charges" | "shc" | "payMode" | "houses">>, reason: string) {
  commit((d) => {
    const a = d.awbs.find((x) => x.id === id); if (!a) return;
    Object.assign(a, patch);
    if (patch.lines) { const c = chargeable(patch.lines); a.pieces = pieceCount(patch.lines); a.grossKg = c.gross; a.volumeKg = Math.round(c.vol * 10) / 10; a.chargeableKg = c.chargeable; a.receivedPieces = a.pieces; }
    if (patch.charges) a.total = patch.charges.reduce((s, x) => s + x.amount, 0);
    ev(d, a, "EDIT", { note: reason }); writeAudit(d, "correct_awb", "Awb", id, `${a.no}: ${reason}`);
  });
}
export function voidAwb(id: string, reason: string) {
  commit((d) => { const a = d.awbs.find((x) => x.id === id); if (!a) return; a.status = "voided"; a.voidReason = reason; ev(d, a, "VOID", { note: reason }); const s = d.awbStock.find((x) => x.prefix === a.prefix && Number(a.serial.slice(0, 7)) >= x.from && Number(a.serial.slice(0, 7)) <= x.to); if (s) s.voided += 1; d.loads = d.loads.filter((l) => l.awbId !== id); writeAudit(d, "void_awb", "Awb", id, `${a.no}: ${reason}`); });
}
export function recordScreening(id: string, input: { result: "pass" | "fail"; method: "X-Ray" | "Physical" | "ETD"; machine?: string; note?: string }) {
  commit((d) => { const a = d.awbs.find((x) => x.id === id); if (!a) return; const fee = a.charges.find((c) => c.code.startsWith("XRY"))?.amount ?? 0; a.screening = { ...input, operator: me(d), at: nowIso(), fee }; if (input.result === "pass") advance(d, a, "SCR", { note: input.machine }); else ev(d, a, "DIS", { note: `X-Ray ບໍ່ຜ່ານ / Failed: ${input.note ?? ""}` }); writeAudit(d, "screening", "Awb", id, `${a.no}: ${input.result}`); });
}

// ---- Flight dispatch ----
export function planLoad(flightId: string, awbId: string) {
  commit((d) => { const a = d.awbs.find((x) => x.id === awbId)!; if (d.loads.some((l) => l.flightId === flightId && l.awbId === awbId && l.status !== "offloaded")) return; a.flightId = flightId; d.loads.push({ id: nextId("L"), flightId, awbId, pieces: a.pieces, weightKg: a.grossKg, status: "planned" }); const f = d.flights.find((x) => x.id === flightId); advance(d, a, "MAN", { flightNo: f?.no, pieces: a.pieces }); writeAudit(d, "plan_load", "FlightLoad", awbId, `${a.no} → ${f?.no}`); });
}
export type ScanOutcome = { kind: "ok" | "unknown" | "wrong_station" | "not_screened" | "not_paid" | "voided" | "over_capacity" | "already" | "closed"; awb?: Awb; expected?: string };
/** Scan a piece onto a flight. This is the check that blocks cargo from going to the wrong station. */
export function scanLoad(flightId: string, code: string): ScanOutcome {
  const d = getDb(); const f = d.flights.find((x) => x.id === flightId)!;
  const s = code.replace(/[\s-]/g, ""); const a = d.awbs.find((x) => x.prefix + x.serial === s);
  if (!a) return { kind: "unknown" };
  if (f.status !== "open") return { kind: "closed", awb: a };
  if (a.status === "voided") return { kind: "voided", awb: a };
  if (a.dest !== f.dest && !(a.direction === "transit")) return { kind: "wrong_station", awb: a, expected: a.dest };
  if (a.direction === "transit" && a.dest !== f.dest) return { kind: "wrong_station", awb: a, expected: a.dest };
  if (!a.screening || a.screening.result !== "pass") { if (a.direction !== "transit") return { kind: "not_screened", awb: a }; }
  if (a.payMode === "cash" && !a.paid) return { kind: "not_paid", awb: a };
  if (d.loads.some((l) => l.flightId === flightId && l.awbId === a.id && l.status === "loaded")) return { kind: "already", awb: a };
  const cap = flightCapacity(d, flightId); const isPlanned = a.flightId === flightId;
  if (!isPlanned && cap.remainingKg < a.grossKg) return { kind: "over_capacity", awb: a };
  commit((dd) => {
    const x = dd.awbs.find((y) => y.id === a.id)!; x.flightId = flightId;
    let l = dd.loads.find((y) => y.flightId === flightId && y.awbId === x.id);
    if (!l) { l = { id: nextId("L"), flightId, awbId: x.id, pieces: x.pieces, weightKg: x.grossKg, status: "planned" }; dd.loads.push(l); }
    l.status = "loaded"; l.scannedBy = me(dd); l.scannedAt = nowIso(); x.loadedPieces = x.pieces;
    advance(dd, x, "MAN", { flightNo: f.no, pieces: x.pieces, note: "ສະແກນຂຶ້ນເຮືອບິນ / Scanned on board" });
    writeAudit(dd, "scan_load", "FlightLoad", x.id, `${x.no} → ${f.no}`);
  });
  return { kind: "ok", awb: getDb().awbs.find((y) => y.id === a.id) };
}
/** Offload: record the cause, correct the manifest, notify the customer, rebook onto another flight. */
export function offload(loadId: string, reason: string, nextFlightId?: string) {
  commit((d) => {
    const l = d.loads.find((x) => x.id === loadId); if (!l) return; const a = d.awbs.find((x) => x.id === l.awbId)!; const f = d.flights.find((x) => x.id === l.flightId); const nf = d.flights.find((x) => x.id === nextFlightId);
    l.status = "offloaded"; l.reason = reason; a.loadedPieces = 0; a.offloadedPieces = l.pieces; a.offloadReason = reason; a.stage = "SCR";
    ev(d, a, "OFLD", { flightNo: f?.no, note: reason, pieces: l.pieces });
    if (nf) { a.flightId = nf.id; d.loads.push({ id: nextId("L"), flightId: nf.id, awbId: a.id, pieces: a.pieces, weightKg: a.grossKg, status: "planned" }); ev(d, a, "RBK", { flightNo: nf.no, note: `ຈອງຖ້ຽວໃໝ່ / Rebooked ${nf.no} ${fmtDate(nf.date)}` }); a.stage = "MAN"; } else a.flightId = undefined;
    notifyOffload(d, a, f?.no ?? "", reason, nf ? `${nf.no} ${fmtDate(nf.date)}` : "ລໍຖ້າຢືນຢັນ / to be confirmed");
    writeAudit(d, "offload", "FlightLoad", a.id, `${a.no} ${f?.no}: ${reason}`);
  });
}
export function removeFromManifest(loadId: string) { commit((d) => { const l = d.loads.find((x) => x.id === loadId); if (!l) return; const a = d.awbs.find((x) => x.id === l.awbId); d.loads = d.loads.filter((x) => x.id !== loadId); if (a) { a.flightId = undefined; a.stage = a.screening?.result === "pass" ? "SCR" : "RCS"; writeAudit(d, "unplan_load", "FlightLoad", a.id, a.no); } }); }
export function setFlightStatus(flightId: string, status: "open" | "closed" | "departed" | "arrived" | "cancelled") {
  commit((d) => {
    const f = d.flights.find((x) => x.id === flightId); if (!f) return; f.status = status;
    if (status === "departed") d.loads.filter((l) => l.flightId === flightId && l.status === "loaded").forEach((l) => { const a = d.awbs.find((x) => x.id === l.awbId); if (a) advance(d, a, "DEP", { flightNo: f.no, pieces: l.pieces }); });
    if (status === "arrived") d.loads.filter((l) => l.flightId === flightId && l.status === "loaded").forEach((l) => { const a = d.awbs.find((x) => x.id === l.awbId); if (a) { advance(d, a, "ARR", { flightNo: f.no, station: f.dest }); a.arrivedAt = nowIso(); a.station = f.dest; } });
    writeAudit(d, `flight_${status}`, "Flight", flightId, `${f.no} ${f.date}`);
  });
}

// ---- Cargo-IMP message drafts: generated from MAWB and HAWB data ----
function ddmon(iso: string) { const dt = new Date(`${iso.slice(0, 10)}T00:00:00`); return `${String(dt.getDate()).padStart(2, "0")}${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][dt.getMonth()]}`; }
const en = (s: string) => (s.split(" / ")[1] ?? s).toUpperCase();
export function buildFwb(d: Db, a: Awb) {
  const sh = d.customers.find((c) => c.id === a.shipperId); const co = d.customers.find((c) => c.id === a.consigneeId); const f = d.flights.find((x) => x.id === a.flightId);
  return [`FWB/17`, `${a.prefix}-${a.serial}${a.origin}${a.dest}/T${a.pieces}K${a.grossKg}${a.volumeKg ? `MC${(a.volumeKg / 166.67).toFixed(2)}` : ""}/${en(a.commodity)}`, f ? `FLT/${f.no}/${ddmon(f.date)}` : "", `RTG/${a.dest}QV`, `SHP`, `/${sh?.nameEn.toUpperCase()}`, `/${(sh?.address ?? "").toUpperCase().slice(0, 35)}`, `CNE`, `/${co?.nameEn.toUpperCase()}`, `CVD/${a.currency}//${a.payMode === "cash" ? "PP" : "CC"}/NVD/NCV/XXX`, `RTD/1/P${a.pieces}/K${a.grossKg}/CC/W${a.chargeableKg}/T${Math.round(a.charges[0]?.amount ?? 0)}/NG/${en(a.commodity)}`, a.shc.length ? `SPH/${a.shc.join("/")}` : "", `ISU/${ddmon(a.issuedAt)}${a.issuedAt.slice(2, 4)}/${a.station}`].filter(Boolean).join("\n");
}
export function buildFhl(d: Db, a: Awb) { return [`FHL/4`, `MBI/${a.prefix}-${a.serial}${a.origin}${a.dest}/T${a.pieces}K${a.grossKg}`, ...a.houses.map((h) => `HBS/${h.hawb}/${a.origin}${a.dest}/${h.pieces}/K${h.weightKg}//${h.commodity.toUpperCase()}\nSHP/${h.shipper.toUpperCase()}\nCNE/${h.consignee.toUpperCase()}`)].join("\n"); }
export function buildFfm(d: Db, flightId: string) {
  const f = d.flights.find((x) => x.id === flightId)!; const list = d.loads.filter((l) => l.flightId === flightId && l.status !== "offloaded").map((l) => d.awbs.find((a) => a.id === l.awbId)!).filter(Boolean);
  return [`FFM/8`, `1/${f.no}/${ddmon(f.date)}/${f.origin}`, f.dest, ...list.map((a) => `${a.prefix}-${a.serial}${a.origin}${a.dest}/T${a.pieces}K${a.grossKg}/${en(a.commodity).slice(0, 15)}${a.shc.length ? `/${a.shc.join("/")}` : ""}`), `LAST`].join("\n");
}
export function createMessage(type: MessageType, ref: { awbId?: string; flightId?: string }): CargoMessage {
  const d0 = getDb(); const a = d0.awbs.find((x) => x.id === ref.awbId);
  const body = type === "FFM" ? buildFfm(d0, ref.flightId!) : type === "FWB" ? buildFwb(d0, a!) : buildFhl(d0, a!);
  const label = type === "FFM" ? `${d0.flights.find((f) => f.id === ref.flightId)?.no} ${d0.flights.find((f) => f.id === ref.flightId)?.date}` : a!.no;
  const m: CargoMessage = { id: nextId("MSG"), type, ref: label, ...ref, body, status: "draft", createdAt: nowIso(), by: me() };
  commit((d) => { d.messages.unshift(m); writeAudit(d, "draft_message", "CargoMessage", m.id, `${type} ${label}`); });
  return m;
}
export function updateMessage(id: string, patch: Partial<CargoMessage>) { commit((d) => { const m = d.messages.find((x) => x.id === id); if (m) Object.assign(m, patch); }); }
export function deleteMessage(id: string) { commit((d) => { d.messages = d.messages.filter((m) => m.id !== id); }); }
export type { Condition };
/** Put an AWB that was offloaded from this flight back on the plan, reusing its load row. */
export function reinstateLoad(loadId: string) { commit((d) => { const l = d.loads.find((x) => x.id === loadId); if (!l) return; const a = d.awbs.find((x) => x.id === l.awbId); const f = d.flights.find((x) => x.id === l.flightId); l.status = "planned"; l.reason = undefined; if (a) { a.flightId = l.flightId; advance(d, a, "MAN", { flightNo: f?.no, pieces: l.pieces }); writeAudit(d, "plan_load", "FlightLoad", a.id, `${a.no} → ${f?.no}`); } }); }
