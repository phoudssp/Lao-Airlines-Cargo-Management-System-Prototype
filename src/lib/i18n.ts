import { useDb } from "./store";
import type { Lang } from "./types";
export type T = (lo: string, en: string) => string;
export function useT(): T { const lang = useDb().session.lang; return (lo, en) => (lang === "lo" ? lo : en); }
export function useLang(): Lang { return useDb().session.lang; }
/** Pick the name in the current language from any record with nameLo / nameEn. */
export function useName() { const lang = useLang(); return (r?: { nameLo: string; nameEn: string }) => (r ? (lang === "lo" ? r.nameLo : r.nameEn) : "—"); }

/** Demo fields stored as "ລາວ / English": show the part for the current language. */
export const bi = (t: T, s: string) => { const p = s.split(" / "); return p.length === 2 ? t(p[0], p[1]) : s; };
