import { commit, getDb, me, nextId, nowIso, writeAudit } from "../store";
import type { Booking, Customer, Db } from "../types";

export function saveCustomer(c: Customer, isNew: boolean) {
  commit((d) => { const i = d.customers.findIndex((x) => x.id === c.id); if (i >= 0) d.customers[i] = c; else d.customers.unshift(c); writeAudit(d, isNew ? "create" : "update", "Customer", c.id, c.nameEn); });
}
export const newCustomerId = () => nextId("C");
export function customerInUse(id: string) { const d = getDb(); return d.awbs.some((a) => a.shipperId === id || a.consigneeId === id || a.agentId === id) || d.bookings.some((b) => b.customerId === id) || d.invoices.some((i) => i.customerId === id); }
export function deleteCustomer(id: string) { commit((d) => { d.customers = d.customers.filter((c) => c.id !== id); writeAudit(d, "delete", "Customer", id, "ລຶບລູກຄ້າ / Customer deleted"); }); }
export function customerHistory(d: Db, id: string) {
  return { awbs: d.awbs.filter((a) => a.shipperId === id || a.consigneeId === id || a.agentId === id), bookings: d.bookings.filter((b) => b.customerId === id), invoices: d.invoices.filter((i) => i.customerId === id), notifications: d.notifications.filter((n) => n.customerId === id) };
}

/** Space on a flight: aircraft limit, weight already committed by confirmed bookings and manifested AWBs. */
export function flightCapacity(d: Db, flightId: string) {
  const f = d.flights.find((x) => x.id === flightId); const ac = d.aircraft.find((a) => a.code === f?.aircraft);
  const maxKg = ac?.maxCargoKg ?? 0; const maxM3 = ac?.maxCargoM3 ?? 0;
  const awbs = d.awbs.filter((a) => a.flightId === flightId && a.status === "active" && a.direction !== "import");
  const awbKg = awbs.reduce((s, a) => s + a.grossKg, 0);
  const convertedIds = new Set(awbs.map((a) => a.bookingId).filter(Boolean));
  const confirmed = d.bookings.filter((b) => b.flightId === flightId && b.status === "confirmed" && !convertedIds.has(b.id));
  const bookedKg = confirmed.reduce((s, b) => s + b.weightKg, 0);
  const loadedKg = d.loads.filter((l) => l.flightId === flightId && l.status === "loaded").reduce((s, l) => s + l.weightKg, 0);
  const mailKg = d.mail.filter((m) => m.flightId === flightId).reduce((s, m) => s + m.weightKg, 0);
  const usedKg = awbKg + bookedKg + mailKg;
  return { flight: f, aircraft: ac, maxKg, maxM3, awbKg, bookedKg, loadedKg, mailKg, usedKg, remainingKg: maxKg - usedKg, pct: maxKg ? usedKg / maxKg : 0 };
}
export function createBooking(input: Omit<Booking, "id" | "no" | "status" | "createdAt">) {
  const seq = nextId("BK"); const no = `BK${new Date().toISOString().slice(2, 7).replace("-", "")}-${seq.split("-")[1]}`;
  const b: Booking = { ...input, id: seq, no, status: "requested", createdAt: nowIso() };
  commit((d) => { d.bookings.unshift(b); writeAudit(d, "create", "Booking", b.id, `${no} ${input.weightKg} kg`); });
  return b;
}
export function updateBooking(id: string, patch: Partial<Booking>) { commit((d) => { const b = d.bookings.find((x) => x.id === id); if (b) { Object.assign(b, patch); writeAudit(d, "update", "Booking", id, b.no); } }); }
export function decideBooking(id: string, status: "confirmed" | "waitlisted" | "rejected" | "cancelled", reason?: string) {
  commit((d) => { const b = d.bookings.find((x) => x.id === id); if (!b) return; b.status = status; b.reason = reason; b.decidedBy = me(d); b.decidedAt = nowIso(); writeAudit(d, status, "Booking", id, `${b.no}${reason ? `: ${reason}` : ""}`); });
}
export function deleteBooking(id: string) { commit((d) => { d.bookings = d.bookings.filter((b) => b.id !== id); writeAudit(d, "delete", "Booking", id, "ລຶບການຈອງ / Booking deleted"); }); }
export const portalLookup = (d: Db, q: string) => { const s = q.replace(/[\s-]/g, ""); return d.awbs.find((a) => a.status !== "voided" && (a.prefix + a.serial) === s); };
