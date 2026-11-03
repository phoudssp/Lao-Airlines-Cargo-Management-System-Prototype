import { commit, getDb, me, nextId, nowIso, writeAudit } from "../store";
import type { Awb, CashShift, Db, Invoice, PayMethod, Receipt, ReceiptLine, Scope } from "../types";
import { rateToLak, scopeOf } from "../pricing";
import { dateAdd, todayIso } from "../format";

export interface PendingCharge { kind: "awb" | "mail"; id: string; ref: string; payer: string; customerId?: string; lines: ReceiptLine[]; amount: number; currency: string; scope: Scope; label: "freight" | "storage" | "mail" }
/** What the cashier still has to collect at this station. */
export function pendingCharges(d: Db, station: string): PendingCharge[] {
  const out: PendingCharge[] = [];
  d.awbs.filter((a) => a.status === "active" && !a.paid && a.payMode === "cash" && a.station === station).forEach((a) => {
    const isImport = a.direction === "import"; const billed = isImport ? a.charges.filter((c) => c.kind === "storage") : a.charges; if (!billed.length) return;
    const c = d.customers.find((x) => x.id === (isImport ? a.consigneeId : a.shipperId));
    const currency = billed[0].currency;
    out.push({ kind: "awb", id: a.id, ref: a.no, payer: c?.name ?? "—", customerId: c?.id, lines: billed.map((b) => ({ description: b.nameEn, ref: a.no, amount: b.amount, currency: b.currency })), amount: billed.reduce((s, b) => s + b.amount, 0), currency, scope: scopeOf(d, a.origin, a.dest), label: isImport ? "storage" : "freight" });
  });
  d.mail.filter((m) => !m.paid && (m.direction === "outbound" ? m.origin : m.dest) === station).forEach((m) => out.push({ kind: "mail", id: m.id, ref: m.no, payer: m.postOffice, lines: [{ description: `Mail bags ${m.bags} (${m.weightKg} kg)`, ref: m.no, amount: m.fee, currency: m.currency }], amount: m.fee, currency: m.currency, scope: m.scope, label: "mail" }));
  return out;
}
export function openShiftFor(d: Db, station: string, userId?: string) { return d.shifts.find((s) => s.station === station && s.status === "open" && (!userId || s.cashierId === userId)); }
export function openShift(input: { openingLak: number; openingUsd: number }) {
  const d0 = getDb(); const s: CashShift = { id: nextId("SH"), station: d0.session.station, cashierId: me(d0), date: todayIso(), openedAt: nowIso(), status: "open", ...input };
  commit((d) => { d.shifts.unshift(s); writeAudit(d, "open_shift", "CashShift", s.id, `${input.openingLak} LAK, ${input.openingUsd} USD`); }); return s;
}
export function takePayment(input: { items: PendingCharge[]; payCurrency: string; method: PayMethod; transferRef?: string; payerName: string }) {
  const d0 = getDb(); const shift = openShiftFor(d0, d0.session.station); if (!shift) return { ok: false as const, error: "no_shift" as const };
  const toLak = (a: number, c: string) => a * rateToLak(d0, c);
  const lak = input.items.reduce((s, i) => s + toLak(i.amount, i.currency), 0);
  const rate = rateToLak(d0, input.payCurrency); const total = input.payCurrency === "LAK" ? Math.round(lak) : Math.round((lak / rate) * 100) / 100;
  const n = (d0.counters.RCPT ?? d0.receipts.length) + 1;
  const id = nextId("RC");
  const r: Receipt = { id, no: `RV${todayIso().replace(/-/g, "").slice(2)}-${String(n).padStart(4, "0")}`, ts: nowIso(), station: d0.session.station, scope: input.items[0]?.scope ?? "domestic", cashierId: me(d0), customerId: input.items[0]?.customerId, payerName: input.payerName, awbIds: input.items.filter((i) => i.kind === "awb").map((i) => i.id), mailIds: input.items.filter((i) => i.kind === "mail").map((i) => i.id), lines: input.items.flatMap((i) => i.lines), total, currency: input.payCurrency, rateToLak: rate, lakEquivalent: Math.round(lak), method: input.method, transferRef: input.transferRef, shiftId: shift.id, status: "valid" };
  commit((d) => { d.counters.RCPT = n; d.receipts.unshift(r); r.awbIds.forEach((x) => { const a = d.awbs.find((y) => y.id === x); if (a) { a.paid = true; a.receiptId = id; a.events.push({ id: nextId("EV"), code: "PAY", ts: nowIso(), station: d.session.station, userId: me(d), note: r.no }); } }); r.mailIds.forEach((x) => { const m = d.mail.find((y) => y.id === x); if (m) m.paid = true; }); writeAudit(d, "payment", "Receipt", id, `${r.no}: ${total} ${input.payCurrency}`); });
  return { ok: true as const, id };
}
export function voidReceipt(id: string, reason: string) { commit((d) => { const r = d.receipts.find((x) => x.id === id); if (!r) return; r.status = "voided"; r.voidReason = reason; r.approvedBy = me(d); r.awbIds.forEach((x) => { const a = d.awbs.find((y) => y.id === x); if (a) { a.paid = false; a.receiptId = undefined; } }); r.mailIds.forEach((x) => { const m = d.mail.find((y) => y.id === x); if (m) m.paid = false; }); writeAudit(d, "void_receipt", "Receipt", id, `${r.no}: ${reason}`); }); }
export function refundReceipt(id: string, amount: number, reason: string) { commit((d) => { const r = d.receipts.find((x) => x.id === id); if (!r) return; r.status = "refunded"; r.refundAmount = amount; r.voidReason = reason; r.approvedBy = me(d); writeAudit(d, "refund", "Receipt", id, `${r.no}: ${amount} ${r.currency}, ${reason}`); }); }
/** Expected cash in the drawer: opening float plus valid cash receipts, by currency. */
export function shiftExpected(d: Db, shift: CashShift) {
  const list = d.receipts.filter((r) => r.shiftId === shift.id && r.status !== "voided");
  const cash = list.filter((r) => r.method === "cash");
  const sum = (c: string) => cash.filter((r) => r.currency === c).reduce((s, r) => s + r.total - (r.refundAmount ?? 0), 0);
  return { lak: shift.openingLak + sum("LAK"), usd: shift.openingUsd + sum("USD"), transferLak: list.filter((r) => r.method === "transfer").reduce((s, r) => s + r.lakEquivalent, 0), count: list.length, list };
}
export function closeShift(id: string, counted: { lak: number; usd: number; note?: string }) { commit((d) => { const s = d.shifts.find((x) => x.id === id); if (!s) return; const e = shiftExpected(d, s); s.expectedLak = e.lak; s.expectedUsd = e.usd; s.countedLak = counted.lak; s.countedUsd = counted.usd; s.note = counted.note; s.closedAt = nowIso(); s.status = "closed"; writeAudit(d, "close_shift", "CashShift", id, `${counted.lak} LAK / ${counted.usd} USD`); }); }
export function handOver(id: string, toUserId: string) { commit((d) => { const s = d.shifts.find((x) => x.id === id); if (!s) return; s.status = "handed_over"; s.handedTo = toUserId; s.approvedBy = toUserId; writeAudit(d, "hand_over", "CashShift", id, `→ ${toUserId}`); }); }

// ---- Credit accounts ----
export function creditUsed(d: Db, customerId: string) { const c = "LAK"; return d.invoices.filter((i) => i.customerId === customerId && ["issued", "partial"].includes(i.status)).reduce((s, i) => s + (i.amount - i.paidAmount) * rateToLak(d, i.currency), 0) + d.awbs.filter((a) => a.status === "active" && a.payMode === "credit" && !a.invoiceId && (a.agentId === customerId || a.shipperId === customerId)).reduce((s, a) => s + a.total * rateToLak(d, a.currency), 0) * (c ? 1 : 1); }
export function uninvoiced(d: Db, customerId: string): Awb[] { return d.awbs.filter((a) => a.status === "active" && a.payMode === "credit" && !a.invoiceId && (a.agentId === customerId || a.shipperId === customerId)); }
export function createInvoice(customerId: string, awbIds: string[], currency: string) {
  const d0 = getDb(); const c = d0.customers.find((x) => x.id === customerId)!; const list = awbIds.map((x) => d0.awbs.find((a) => a.id === x)!);
  const lines = list.map((a) => ({ description: a.commodity, ref: a.no, amount: a.total, currency: a.currency }));
  const lak = list.reduce((s, a) => s + a.total * rateToLak(d0, a.currency), 0); const amount = currency === "LAK" ? lak : lak / rateToLak(d0, currency);
  const seq = nextId("INV"); const inv: Invoice = { id: seq, no: `INV26-${seq.split("-")[1]}`, customerId, station: d0.session.station, awbIds, lines, amount, paidAmount: 0, currency, issueDate: todayIso(), dueDate: dateAdd(todayIso(), c.creditDays || 30), status: "draft", createdBy: me(d0) };
  commit((d) => { d.invoices.unshift(inv); awbIds.forEach((x) => { const a = d.awbs.find((y) => y.id === x); if (a) a.invoiceId = seq; }); writeAudit(d, "create", "Invoice", seq, inv.no); }); return inv;
}
export function issueInvoice(id: string) { commit((d) => { const i = d.invoices.find((x) => x.id === id); if (i) { i.status = "issued"; writeAudit(d, "issue_invoice", "Invoice", id, i.no); } }); }
export function payInvoice(id: string, amount: number) { commit((d) => { const i = d.invoices.find((x) => x.id === id); if (!i) return; i.paidAmount = Math.min(i.amount, i.paidAmount + amount); i.status = i.paidAmount >= i.amount - 0.005 ? "paid" : "partial"; writeAudit(d, "pay_invoice", "Invoice", id, `${i.no}: ${amount}`); }); }
export function cancelInvoice(id: string) { commit((d) => { const i = d.invoices.find((x) => x.id === id); if (!i) return; i.status = "cancelled"; i.awbIds.forEach((x) => { const a = d.awbs.find((y) => y.id === x); if (a) a.invoiceId = undefined; }); writeAudit(d, "cancel_invoice", "Invoice", id, i.no); }); }
export function deleteInvoice(id: string) { commit((d) => { const i = d.invoices.find((x) => x.id === id); i?.awbIds.forEach((x) => { const a = d.awbs.find((y) => y.id === x); if (a) a.invoiceId = undefined; }); d.invoices = d.invoices.filter((x) => x.id !== id); }); }

export function logExport(report: string, format: "Excel" | "PDF", filters: string, rows: number) { commit((d) => { d.exportLogs.unshift({ id: nextId("EX"), ts: nowIso(), report, format, filters, rows, by: me(d) }); }); }

/** Cashier asks a manager to take over a closed shift. It stays "closed" until that manager approves through handOver(). */
export function requestHandOver(id: string, toUserId: string) { commit((d) => { const s = d.shifts.find((x) => x.id === id); if (!s || s.status !== "closed") return; s.handedTo = toUserId; writeAudit(d, "request_hand_over", "CashShift", id, `→ ${toUserId}`); }); }
/** Correct a receipt's payer or transfer reference. Amounts never change here; the editor goes on the record. */
export function editReceipt(id: string, patch: { payerName: string; transferRef?: string }) { commit((d) => { const r = d.receipts.find((x) => x.id === id); if (!r) return; r.payerName = patch.payerName; r.transferRef = patch.transferRef; r.editedBy = me(d); writeAudit(d, "edit_receipt", "Receipt", id, `${r.no}: ${patch.payerName}`); }); }
