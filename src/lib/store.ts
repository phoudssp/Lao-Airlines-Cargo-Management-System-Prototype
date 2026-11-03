import { useSyncExternalStore } from "react";
import type { AuditEntry, Db, PermKey, Role, User } from "./types";
import { buildSeed, DB_VERSION } from "./seed";

const KEY = "qv-cargo-prototype";
let db: Db = load();
const subs = new Set<() => void>();

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const parsed = JSON.parse(raw) as Db; if (parsed.version === DB_VERSION) return parsed; }
  } catch { /* storage unavailable: run from memory */ }
  return buildSeed();
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ } }

export function getDb(): Db { return db; }
/** Apply a change to the data and notify every screen. */
export function commit(fn: (d: Db) => void) { fn(db); db = { ...db }; persist(); subs.forEach((s) => s()); }
export function resetDemo() { const keep = db.session; db = buildSeed(); db.session = keep; persist(); subs.forEach((s) => s()); }
function subscribe(cb: () => void) { subs.add(cb); return () => { subs.delete(cb); }; }
/** Read the whole data set; the component re-renders on every commit. */
export function useDb(): Db { return useSyncExternalStore(subscribe, () => db); }

export function nextId(prefix: string): string { db.counters[prefix] = (db.counters[prefix] ?? 1000) + 1; return `${prefix}-${db.counters[prefix]}`; }
export function nowIso() { return new Date().toISOString(); }
export function currentUser(d: Db = db): User | undefined { return d.users.find((u) => u.id === d.session.userId); }
export function roleOf(u: User | undefined, d: Db = db): Role | undefined { return d.roles.find((r) => r.id === u?.roleId); }
export function can(p: PermKey, d: Db = db): boolean { return !!roleOf(currentUser(d), d)?.perms.includes(p); }
export function useCan() { const d = useDb(); return (p: PermKey) => can(p, d); }
export function me(d: Db = db): string { return d.session.userId ?? "system"; }
export function writeAudit(d: Db, action: string, entity: string, entityId: string, detail: string) {
  const e: AuditEntry = { id: nextId("AUD"), ts: nowIso(), userId: me(d), station: d.session.station, action, entity, entityId, detail };
  d.audit.unshift(e);
}
export function setSession(partial: Partial<Db["session"]>) { commit((d) => { d.session = { ...d.session, ...partial }; }); }
