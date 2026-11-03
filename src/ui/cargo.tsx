import { Link } from "react-router-dom";
import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";
import type { Awb, Db, FlightStatus, StageCode } from "@/lib/types";
import { STAGES } from "@/lib/pricing";
import { useT, type T } from "@/lib/i18n";
import { cx, Badge, type Tone } from "./kit";

export const STAGE_NAMES: Record<StageCode, [string, string]> = {
  BKD: ["ຈອງພື້ນທີ່", "Booked"], RCS: ["ຮັບເຄື່ອງ", "Accepted"], SCR: ["ກວດ X-Ray", "Screened"], MAN: ["ເຂົ້າ Manifest", "Manifested"], DEP: ["ອອກບິນ", "Departed"],
  ARR: ["ມາຮອດ", "Arrived"], RCF: ["ເຂົ້າສາງ", "In warehouse"], NFD: ["ແຈ້ງລູກຄ້າ", "Notified"], CUS: ["ຜ່ານພາສີ", "Customs cleared"], DLV: ["ມອບແລ້ວ", "Delivered"],
};
export const stageName = (t: T, s: StageCode) => t(STAGE_NAMES[s][0], STAGE_NAMES[s][1]);
function stagesFor(a: Awb): StageCode[] { const domestic = !a.customs && a.direction === "export"; return STAGES.filter((s) => { if (a.direction === "export" && (s === "CUS")) return false; if (a.direction === "import" && ["BKD", "RCS", "SCR", "MAN", "DEP"].includes(s)) return false; if (a.direction === "transit" && ["BKD", "RCS", "SCR", "NFD", "CUS", "DLV"].includes(s)) return false; return domestic ? true : true; }) as StageCode[]; }
/** The signature element: an AWB's journey as a strip of IATA stage codes. */
export function AwbStrip({ awb, size = "sm" }: { awb: Awb; size?: "sm" | "lg" }) {
  const t = useT(); const list = stagesFor(awb); const cur = list.indexOf(awb.stage); const voided = awb.status === "voided";
  if (size === "lg") return <ol className="flex flex-wrap gap-1" aria-label={t("ຂັ້ນຕອນ", "Stages")}>{list.map((s, i) => { const done = i <= cur && !voided; const e = [...awb.events].reverse().find((x) => x.code === s); return <li key={s} className={cx("min-w-[86px] flex-1 rounded-sm border px-2 py-1.5", done ? (i === cur ? "border-brand bg-brand text-white" : "border-brand/30 bg-brand-soft text-brand") : "border-line bg-surface-2 text-ink-3")} aria-current={i === cur ? "step" : undefined}><div className="font-mono text-[13px] font-semibold leading-4">{s}</div><div className="text-xs leading-4">{stageName(t, s)}</div>{e && <div className={cx("tnum text-xs leading-4 opacity-90")}>{new Date(e.ts).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })} {new Date(e.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>}</li>; })}</ol>;
  return <span className="inline-flex items-center gap-1.5" title={stageName(t, awb.stage)}><span className="inline-flex gap-px" aria-hidden>{list.map((s, i) => <span key={s} className={cx("h-3 w-1.5", voided ? "bg-[var(--line)]" : i < cur ? "bg-brand/40" : i === cur ? "bg-brand" : "bg-[var(--line)]")} />)}</span><span className="font-mono text-xs font-semibold">{voided ? "VOID" : awb.stage}</span></span>;
}
export function AwbLink({ awb }: { awb: Awb }) { return <Link to={`/export/awb/${awb.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[13px] font-semibold text-brand whitespace-nowrap hover:underline">{awb.no}</Link>; }
export function Route({ from, to }: { from: string; to: string }) { return <span className="font-mono text-[13px] font-semibold whitespace-nowrap">{from}<span className="px-1 font-normal text-ink-3" aria-hidden>→</span><span className="sr-only"> to </span>{to}</span>; }
export function ShcTags({ codes }: { codes: string[] }) { if (!codes.length) return null; return <span className="inline-flex gap-1">{codes.map((c) => <span key={c} className="rounded-sm bg-warn-soft px-1 font-mono text-xs font-semibold text-warn">{c}</span>)}</span>; }
export const SHC_LIST: { code: string; lo: string; en: string }[] = [
  { code: "PER", lo: "ສິນຄ້າເນົ່າເສຍງ່າຍ", en: "Perishable" }, { code: "VAL", lo: "ສິນຄ້າມີຄ່າ", en: "Valuable" }, { code: "AVI", lo: "ສັດມີຊີວິດ", en: "Live animals" }, { code: "PHA", lo: "ຢາ ແລະ ເວດຊະພັນ", en: "Pharmaceuticals" }, { code: "DGR", lo: "ສິນຄ້າອັນຕະລາຍ", en: "Dangerous goods" }, { code: "HEA", lo: "ສິນຄ້າໜັກ", en: "Heavy cargo" }, { code: "FRG", lo: "ສິນຄ້າແຕກງ່າຍ", en: "Fragile" },
];
export function FlightStatusBadge({ status }: { status: FlightStatus }) { const t = useT(); const m: Record<FlightStatus, [Tone, string, string]> = { open: ["info", "ເປີດຮັບ", "Open"], closed: ["warn", "ປິດຮັບ", "Closed"], departed: ["neutral", "ອອກບິນແລ້ວ", "Departed"], arrived: ["ok", "ມາຮອດແລ້ວ", "Arrived"], cancelled: ["bad", "ຍົກເລີກ", "Cancelled"] }; const [tone, lo, en] = m[status]; return <Badge tone={tone}>{t(lo, en)}</Badge>; }
export function ApprovalBadge({ status }: { status: "pending" | "approved" | "rejected" }) { const t = useT(); return status === "approved" ? <Badge tone="ok">{t("ອະນຸມັດແລ້ວ", "Approved")}</Badge> : status === "pending" ? <Badge tone="warn">{t("ລໍຖ້າອະນຸມັດ", "Pending approval")}</Badge> : <Badge tone="bad">{t("ບໍ່ອະນຸມັດ", "Rejected")}</Badge>; }
export const customerName = (d: Db, id?: string) => { const c = d.customers.find((x) => x.id === id); return c ? (d.session.lang === "en" ? c.nameEn : c.name) : "—"; };
export const userName = (d: Db, id?: string, lang: "lo" | "en" = "lo") => { const u = d.users.find((x) => x.id === id); return u ? (lang === "lo" ? u.nameLo : u.nameEn) : "—"; };
export const flightLabel = (d: Db, id?: string) => { const f = d.flights.find((x) => x.id === id); return f ? `${f.no} ${f.date.slice(8)}/${f.date.slice(5, 7)}` : "—"; };
export function Barcode({ value, height = 46, width = 1.5 }: { value: string; height?: number; width?: number }) { const ref = useRef<SVGSVGElement>(null); useEffect(() => { if (ref.current) JsBarcode(ref.current, value, { format: "CODE128", height, width, margin: 0, fontSize: 13, font: "monospace", displayValue: true }); }, [value, height, width]); return <svg ref={ref} role="img" aria-label={value} />; }
