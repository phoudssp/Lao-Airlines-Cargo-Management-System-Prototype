import { commit, getDb, me, nextId, nowIso, writeAudit } from "../store";
import { isoDate } from "../format";
import type { AwbStock, Db, ExchangeRate, Tariff } from "../types";

type Coll = "stations" | "roles" | "users" | "aircraft" | "routes" | "flights" | "currencies" | "zones" | "templates";
type KeyOf = Record<Coll, string>;
const KEYS: KeyOf = { stations: "code", roles: "id", users: "id", aircraft: "code", routes: "id", flights: "id", currencies: "code", zones: "id", templates: "id" };

/** Create or update a master record, keyed by its natural key. */
export function upsert<C extends Coll>(coll: C, item: Db[C][number], isNew: boolean) {
  commit((d) => {
    const list = d[coll] as any[]; const key = KEYS[coll]; const id = (item as any)[key];
    const i = list.findIndex((x) => x[key] === id);
    if (i >= 0) list[i] = item; else list.unshift(item);
    writeAudit(d, isNew ? "create" : "update", coll, String(id), `${isNew ? "ສ້າງ / Created" : "ແກ້ໄຂ / Updated"} ${coll} ${id}`);
  });
}
export function removeFrom(coll: Coll, id: string) {
  commit((d) => {
    const list = d[coll] as any[]; const key = KEYS[coll]; const i = list.findIndex((x) => x[key] === id);
    if (i >= 0) list.splice(i, 1);
    writeAudit(d, "delete", coll, id, `ລຶບ / Deleted ${coll} ${id}`);
  });
}
export const newId = (p: string) => nextId(p);

/** Why a station or other record may not be deleted; undefined means it is free to delete. */
export function stationInUse(code: string) { const d = getDb(); return d.awbs.some((a) => a.origin === code || a.dest === code) || d.flights.some((f) => f.origin === code || f.dest === code); }
export function flightInUse(id: string) { const d = getDb(); return d.awbs.some((a) => a.flightId === id) || d.loads.some((l) => l.flightId === id) || d.bookings.some((b) => b.flightId === id); }

// ---- Exchange rates: every change needs approval ----
export function requestRate(input: { currency: string; toLak: number; effectiveFrom: string; note?: string }) {
  const r: ExchangeRate = { id: nextId("XR"), ...input, status: "pending", requestedBy: me(), createdAt: nowIso() };
  commit((d) => { d.rates.unshift(r); writeAudit(d, "request_rate", "ExchangeRate", r.id, `ຂໍປ່ຽນອັດຕາ / Requested ${input.currency} = ${input.toLak}`); });
  return r;
}
export function decideRate(id: string, ok: boolean, note?: string) {
  commit((d) => { const r = d.rates.find((x) => x.id === id); if (!r) return; r.status = ok ? "approved" : "rejected"; r.decidedBy = me(d); if (note) r.note = note; writeAudit(d, ok ? "approve_rate" : "reject_rate", "ExchangeRate", id, `${r.currency} = ${r.toLak}`); });
}
export function deleteRate(id: string) { commit((d) => { d.rates = d.rates.filter((r) => r.id !== id); writeAudit(d, "delete", "ExchangeRate", id, "ລຶບຄໍາຂໍ / Deleted request"); }); }

// ---- AWB ranges ----
export function allocateStock(input: Omit<AwbStock, "id" | "nextSerial" | "voided" | "createdAt" | "active">) {
  const overlap = getDb().awbStock.some((s) => s.prefix === input.prefix && input.from <= s.to && input.to >= s.from);
  if (overlap) return { ok: false as const, error: "overlap" as const };
  if (input.to < input.from) return { ok: false as const, error: "range" as const };
  const s: AwbStock = { ...input, id: nextId("ST"), nextSerial: input.from, voided: 0, createdAt: nowIso(), active: true };
  commit((d) => { d.awbStock.unshift(s); writeAudit(d, "allocate_awb", "AwbStock", s.id, `${input.prefix} ${input.from}-${input.to} → ${input.assignee}`); });
  return { ok: true as const, stock: s };
}
export function updateStock(id: string, patch: Partial<AwbStock>) { commit((d) => { const s = d.awbStock.find((x) => x.id === id); if (s) { Object.assign(s, patch); writeAudit(d, "update", "AwbStock", id, "ແກ້ໄຂຊ່ວງເລກ / Range updated"); } }); }
export function deleteStock(id: string) { commit((d) => { d.awbStock = d.awbStock.filter((s) => s.id !== id); writeAudit(d, "delete", "AwbStock", id, "ລຶບຊ່ວງເລກ / Range deleted"); }); }

// ---- Tariffs: every new or changed rate waits for approval and carries an effective date ----
export function submitTariff(input: Omit<Tariff, "id" | "status" | "requestedBy" | "decidedBy">) {
  const t: Tariff = { ...input, id: nextId("TF"), status: "pending", requestedBy: me() };
  commit((d) => { d.tariffs.unshift(t); writeAudit(d, "request_tariff", "Tariff", t.id, `${t.code}: ${t.rate} ${t.currency}`); });
  return t;
}
/** Approving a rate closes the previous rate with the same code the day before the new one starts. */
export function decideTariff(id: string, ok: boolean, note?: string) {
  commit((d) => {
    const t = d.tariffs.find((x) => x.id === id); if (!t) return;
    t.status = ok ? "approved" : "rejected"; t.decidedBy = me(d); if (note) t.note = note;
    if (ok) d.tariffs.filter((x) => x.id !== id && x.code === t.code && x.status === "approved" && !x.effectiveTo && x.effectiveFrom < t.effectiveFrom).forEach((x) => { const e = new Date(`${t.effectiveFrom}T00:00:00`); e.setDate(e.getDate() - 1); x.effectiveTo = isoDate(e); });
    writeAudit(d, ok ? "approve_tariff" : "reject_tariff", "Tariff", id, `${t.code}: ${t.rate} ${t.currency}`);
  });
}
export function deleteTariff(id: string) { commit((d) => { d.tariffs = d.tariffs.filter((t) => t.id !== id); writeAudit(d, "delete", "Tariff", id, "ລຶບອັດຕາ / Tariff deleted"); }); }

// ---- Flight schedule copy: one audit line for the whole batch ----
export function copyFlights(ids: string[], date: string) {
  commit((d) => {
    const src = d.flights.filter((f) => ids.includes(f.id));
    src.forEach((f) => d.flights.unshift({ ...f, id: nextId("F"), date, status: "open" }));
    writeAudit(d, "copy_schedule", "Flight", date, `ສໍາເນົາຕາຕະລາງ ${src.length} ຖ້ຽວ ໄປວັນທີ ${date} / Copied ${src.length} flights to ${date}`);
  });
}

// ---- Notice templates: notices use the first template of a type, so the active one is kept first and only one is active per type ----
export function saveTemplate(item: Db["templates"][number], isNew: boolean) {
  commit((d) => {
    const i = d.templates.findIndex((x) => x.id === item.id);
    if (i >= 0) d.templates[i] = item; else d.templates.unshift(item);
    if (item.active) d.templates.forEach((x) => { if (x.key === item.key && x.id !== item.id) x.active = false; });
    d.templates = [...d.templates.filter((x) => x.active), ...d.templates.filter((x) => !x.active)];
    writeAudit(d, isNew ? "create" : "update", "templates", item.id, `${isNew ? "ສ້າງ / Created" : "ແກ້ໄຂ / Updated"} ${item.nameEn}`);
  });
}
