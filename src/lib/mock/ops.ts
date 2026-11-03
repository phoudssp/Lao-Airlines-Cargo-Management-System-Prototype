import { commit, getDb, me, nextId, nowIso, writeAudit } from "../store";
import type { Awb, Condition, CustomsRecord, Db, Irregularity, IrregularityType, MailBag, MessageTemplate } from "../types";
import { agingBand, scopeOf, storageFee } from "../pricing";
import { daysBetween, fmtDate, money, todayIso } from "../format";
import { advance } from "./awb";

// ---- Notifications: WhatsApp when the customer has it, otherwise a note telling staff to call ----
function fill(t: string, vals: Record<string, string>) { return t.replace(/\{(\w+)\}/g, (_, k) => vals[k] ?? ""); }
function pushNotice(d: Db, key: MessageTemplate["key"], a: Awb, customerId: string, vals: Record<string, string>, band?: string) {
  const c = d.customers.find((x) => x.id === customerId); const tpl = d.templates.find((t) => t.key === key); if (!c || !tpl) return;
  const body = fill(tpl.bodyLo, { name: c.contact, awb: a.no, pieces: String(a.pieces), ...vals });
  d.notifications.unshift(c.whatsapp
    ? { id: nextId("NT"), ts: nowIso(), channel: "whatsapp", templateKey: key, customerId, awbId: a.id, to: c.whatsapp, body, status: "sent", by: me(d), agingBand: band }
    : { id: nextId("NT"), ts: nowIso(), channel: "staff_note", templateKey: key, customerId, awbId: a.id, body: `ລູກຄ້າບໍ່ມີ WhatsApp: ໃຫ້ພະນັກງານໂທແຈ້ງ ${c.phone} / No WhatsApp: staff to call ${c.phone}`, status: "staff_note", by: me(d), agingBand: band });
  if (!c.whatsapp) a.staffNote = `ໂທແຈ້ງລູກຄ້າ ${c.phone} / Call customer ${c.phone}`;
}
export function notifyOffload(d: Db, a: Awb, flightNo: string, reason: string, next: string) { pushNotice(d, "offload", a, a.agentId ?? a.shipperId, { flight: flightNo, reason, next }); }
export function notifyArrival(awbId: string) {
  commit((d) => { const a = d.awbs.find((x) => x.id === awbId); if (!a) return; const fl = [...a.events].reverse().find((e) => e.flightNo)?.flightNo ?? ""; pushNotice(d, "arrival", a, a.consigneeId, { station: a.dest, flight: fl }); advance(d, a, "NFD"); writeAudit(d, "notify_arrival", "Awb", a.id, a.no); });
}
export function notifyAging(awbId: string) {
  commit((d) => { const a = d.awbs.find((x) => x.id === awbId); if (!a?.arrivedAt) return; const days = daysBetween(a.arrivedAt, todayIso()); const s = storageFee(d, { scope: scopeOf(d, a.origin, a.dest), chargeableKg: a.chargeableKg, arrivedAt: a.arrivedAt }); pushNotice(d, "aging", a, a.consigneeId, { days: String(days), fee: money(s.fee, s.currency) }, agingBand(days)); writeAudit(d, "notify_aging", "Awb", a.id, `${a.no}: ${days}`); });
}
export function markNoteDone(id: string) { commit((d) => { const n = d.notifications.find((x) => x.id === id); if (n) { n.status = "done"; const a = d.awbs.find((x) => x.id === n.awbId); if (a) a.staffNote = undefined; } }); }
export function deleteNotification(id: string) { commit((d) => { d.notifications = d.notifications.filter((n) => n.id !== id); }); }
export function setStaffNote(awbId: string, note: string) { commit((d) => { const a = d.awbs.find((x) => x.id === awbId); if (a) a.staffNote = note; }); }

// ---- Warehouse ----
/** Receive against the manifest, with the condition check. Faults and shortages open an irregularity automatically. */
export function receiveCargo(awbId: string, input: { pieces: number; condition: Condition; note?: string; zoneId?: string }) {
  commit((d) => {
    const a = d.awbs.find((x) => x.id === awbId); if (!a) return;
    a.receivedPieces = input.pieces; a.condition = input.condition; a.conditionNote = input.note; a.zoneId = input.zoneId ?? a.zoneId; a.arrivedAt = a.arrivedAt ?? nowIso(); a.station = d.session.station;
    if (a.stage === "DEP") advance(d, a, "ARR");
    advance(d, a, "RCF", { pieces: input.pieces, note: input.condition === "good" ? undefined : input.note });
    if (input.condition !== "good") addIrr(d, a, input.condition, input.pieces, input.note ?? "");
    if (input.pieces < a.pieces) addIrr(d, a, "short", a.pieces - input.pieces, `ຮັບຕົວຈິງ ${input.pieces}/${a.pieces} / Received ${input.pieces} of ${a.pieces}`);
    if (input.pieces > a.pieces) addIrr(d, a, "over", input.pieces - a.pieces, `ຮັບຕົວຈິງ ${input.pieces}/${a.pieces} / Received ${input.pieces} of ${a.pieces}`);
    writeAudit(d, "receive", "Awb", a.id, `${a.no}: ${input.pieces} ${input.condition}`);
  });
}
function addIrr(d: Db, a: Awb, type: IrregularityType, pieces: number, note: string) { d.irregularities.unshift({ id: nextId("IR"), no: `DMR-${(d.counters.IRN = (d.counters.IRN ?? 2700) + 1)}`, awbId: a.id, type, pieces, note, status: "open", station: d.session.station, reportedBy: me(d), reportedAt: nowIso() }); a.events.push({ id: nextId("EV"), code: "DIS", ts: nowIso(), station: d.session.station, userId: me(d), note, pieces }); }
export function createIrregularity(input: { awbId: string; type: IrregularityType; pieces: number; note: string }) { commit((d) => { const a = d.awbs.find((x) => x.id === input.awbId); if (a) addIrr(d, a, input.type, input.pieces, input.note); }); }
export function updateIrregularity(id: string, patch: Partial<Irregularity>) { commit((d) => { const r = d.irregularities.find((x) => x.id === id); if (r) { Object.assign(r, patch); writeAudit(d, "update", "Irregularity", id, `${r.no}: ${r.status}`); } }); }
export function deleteIrregularity(id: string) { commit((d) => { d.irregularities = d.irregularities.filter((r) => r.id !== id); }); }
export function moveToZone(awbId: string, zoneId: string) { commit((d) => { const a = d.awbs.find((x) => x.id === awbId); if (a) { a.zoneId = zoneId; writeAudit(d, "move_zone", "Awb", a.id, `${a.no} → ${zoneId}`); } }); }
export function zoneLoad(d: Db, zoneId: string) { const list = d.awbs.filter((a) => a.zoneId === zoneId && a.status === "active" && a.stage !== "DLV" && a.stage !== "DEP" && a.stage !== "ARR"); return { list, kg: list.reduce((s, a) => s + a.grossKg, 0) }; }
/** Transshipment or interline: release to the onward flight. */
export function transferOnward(awbId: string, flightId: string, partner?: string) {
  commit((d) => { const a = d.awbs.find((x) => x.id === awbId); const f = d.flights.find((x) => x.id === flightId); if (!a || !f) return; a.nextFlightId = flightId; a.flightId = flightId; d.loads.push({ id: nextId("L"), flightId, awbId, pieces: a.pieces, weightKg: a.grossKg, status: "loaded", scannedBy: me(d), scannedAt: nowIso() }); a.loadedPieces = a.pieces; a.zoneId = undefined; a.events.push({ id: nextId("EV"), code: "TFD", ts: nowIso(), station: d.session.station, userId: me(d), flightNo: f.no, note: partner, pieces: a.pieces }); a.stage = "MAN"; writeAudit(d, "transfer", "Awb", a.id, `${a.no} → ${f.no}`); });
}

// ---- Mail bags ----
export function saveMail(m: MailBag, isNew: boolean) { commit((d) => { const i = d.mail.findIndex((x) => x.id === m.id); if (i >= 0) d.mail[i] = m; else d.mail.unshift(m); writeAudit(d, isNew ? "create" : "update", "MailBag", m.id, m.no); }); }
export const newMailId = () => nextId("MB");
export function advanceMail(id: string, status: MailBag["status"]) { commit((d) => { const m = d.mail.find((x) => x.id === id); if (!m) return; m.status = status; if (!m.passNo && status !== "received") m.passNo = `MP-${(d.counters.MP = (d.counters.MP ?? 2700) + 1)}`; writeAudit(d, `mail_${status}`, "MailBag", id, m.no); }); }
export function deleteMail(id: string) { commit((d) => { d.mail = d.mail.filter((m) => m.id !== id); }); }

// ---- Import ----
export function saveCustoms(awbId: string, input: Pick<CustomsRecord, "declarationNo" | "status" | "note"> & { method?: CustomsRecord["method"] }) {
  commit((d) => { const a = d.awbs.find((x) => x.id === awbId); if (!a) return; a.customs = { method: "manual", ...input, updatedAt: nowIso(), updatedBy: me(d) }; if (input.status === "cleared") { a.events.push({ id: nextId("EV"), code: "CUS", ts: nowIso(), station: d.session.station, userId: me(d), note: input.declarationNo }); if (a.stage !== "DLV") a.stage = "CUS"; } writeAudit(d, "customs", "Awb", a.id, `${a.no}: ${input.status} ${input.declarationNo}`); });
}
/** Hand cargo to the receiver. Storage is priced by time, with no fee for same-day pickup. */
export function deliverCargo(awbId: string, input: { receiverName: string; receiverPhone: string; idNo?: string; documentsChecked: boolean; storageFee: number; storageDays: number; currency: string }) {
  commit((d) => { const a = d.awbs.find((x) => x.id === awbId); if (!a) return; a.delivery = { ...input, signedAt: nowIso(), pieces: a.pieces, by: me(d) }; a.deliveredPieces = a.pieces; a.deliveredAt = nowIso(); a.zoneId = undefined; a.staffNote = undefined; advance(d, a, "DLV", { pieces: a.pieces, note: input.receiverName }); writeAudit(d, "deliver", "Awb", a.id, `${a.no} → ${input.receiverName}`); });
}
/** Add the storage fee to the AWB and send it to the cashier. */
export function chargeStorage(awbId: string) {
  commit((d) => { const a = d.awbs.find((x) => x.id === awbId); if (!a?.arrivedAt) return; const s = storageFee(d, { scope: scopeOf(d, a.origin, a.dest), chargeableKg: a.chargeableKg, arrivedAt: a.arrivedAt }); if (!s.fee || a.charges.some((c) => c.kind === "storage" && c.id === `STO-${todayIso()}`)) return; a.charges = [...a.charges.filter((c) => c.kind !== "storage"), { id: `STO-${todayIso()}`, tariffId: s.tariff?.id, code: s.tariff?.code ?? "STO", nameLo: `ຄ່າຝາກສາງ ${s.days} ວັນ`, nameEn: `Storage ${s.days} day(s)`, amount: s.fee, currency: s.currency, kind: "storage" }]; a.paid = false; a.payMode = "cash"; writeAudit(d, "charge_storage", "Awb", a.id, `${a.no}: ${money(s.fee, s.currency)}`); });
}
export const fmtDep = (iso: string) => fmtDate(iso);
export { getDb };

// ---- Warehouse and import helpers shared by the staff screens and the scanner ----
/** Match a scanned or typed code against an AWB: full number, with or without spaces and dashes, or the serial alone. */
export function findAwbByCode(d: Db, code: string) { const s = code.replace(/[\s-]/g, ""); if (!s) return undefined; return d.awbs.find((a) => a.prefix + a.serial === s || a.serial === s); }
export const hasReceipt = (a: Awb) => a.events.some((e) => e.code === "RCF");
/** Cargo bound for this station that has not yet been received into the warehouse. */
export function awbsToReceive(d: Db, station: string) { return d.awbs.filter((a) => a.status === "active" && a.dest === station && ["DEP", "ARR", "NFD", "CUS"].includes(a.stage) && !hasReceipt(a)); }
/** Issue the mail warehouse pass without moving the bag along its lifecycle. */
export function issueMailPass(id: string) { commit((d) => { const m = d.mail.find((x) => x.id === id); if (!m || m.passNo) return; m.passNo = `MP-${(d.counters.MP = (d.counters.MP ?? 2700) + 1)}`; writeAudit(d, "mail_pass", "MailBag", id, `${m.no}: ${m.passNo}`); }); }

/** Documents staff check for customs. The list grows for cargo that needs a health or import permit. */
export function customsDocList(a: Awb): { key: string; lo: string; en: string }[] {
  const base = [{ key: "awb", lo: "ສໍາເນົາ AWB", en: "AWB copy" }, { key: "invoice", lo: "ໃບແຈ້ງໜີ້ສິນຄ້າ (Invoice)", en: "Commercial invoice" }, { key: "packing", lo: "ໃບບັນຊີບັນຈຸ (Packing list)", en: "Packing list" }, { key: "declaration", lo: "ແບບຟອມແຈ້ງພາສີ", en: "Customs declaration form" }];
  return a.shc.some((c) => ["PER", "PHA", "AVI"].includes(c)) ? [...base, { key: "permit", lo: "ໃບອະນຸຍາດ ຫຼື ໃບຢັ້ງຢືນສຸຂະພາບ", en: "Import permit or health certificate" }] : base;
}
export const awbDocs = (a: Awb) => (a as Awb & { docs?: string[] }).docs ?? [];
export function setAwbDoc(awbId: string, key: string, on: boolean) { commit((d) => { const a = d.awbs.find((x) => x.id === awbId) as (Awb & { docs?: string[] }) | undefined; if (!a) return; const cur = a.docs ?? []; a.docs = on ? [...new Set([...cur, key])] : cur.filter((k) => k !== key); writeAudit(d, "customs_doc", "Awb", a.id, `${a.no}: ${key} ${on ? "✓" : "✗"}`); }); }

/** What stands between this cargo and the receiver: receipt, customs, storage fee, payment. */
export function releaseCheck(d: Db, a: Awb) {
  const scope = scopeOf(d, a.origin, a.dest);
  const received = hasReceipt(a);
  const customsRequired = a.direction === "import" && scope === "international";
  const customsStatus = a.customs?.status;
  const customsOk = !customsRequired || customsStatus === "cleared";
  const storage = storageFee(d, { scope, chargeableKg: a.chargeableKg, arrivedAt: a.arrivedAt ?? todayIso() });
  const billed = a.charges.some((c) => c.kind === "storage" && c.id === `STO-${todayIso()}`);
  const storageState: "none" | "to_bill" | "at_cashier" | "paid" = storage.fee === 0 ? "none" : !billed ? "to_bill" : a.paid ? "paid" : "at_cashier";
  const storageOk = storageState === "none" || storageState === "paid";
  const paidOk = a.paid || a.payMode === "credit";
  return { scope, received, customsRequired, customsStatus, customsOk, storage, storageState, storageOk, paidOk, delivered: a.stage === "DLV", ready: a.status === "active" && a.stage !== "DLV" && received && customsOk && storageOk && paidOk };
}
