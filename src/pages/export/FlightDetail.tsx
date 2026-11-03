import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ban, CheckCircle2, FileDown, Lock, LockOpen, Mail, OctagonX, PackageMinus, PlaneTakeoff, Plus, Printer, ScanLine, Send, Trash2, TriangleAlert } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { Badge, BarMeter, Button, Callout, Col, Confirm, DataTable, Dialog, Empty, Field, IconButton, PageHeader, Panel, PrintSheet, Select, Textarea, toast, type Tone } from "@/ui/kit";
import { AwbLink, FlightStatusBadge, ShcTags, flightLabel, userName } from "@/ui/cargo";
import type { Awb, Db, Flight, FlightLoad, Lang, MailBag } from "@/lib/types";
import { fmtDate, fmtDateTime, fmtTime, kg, num, pad, todayIso } from "@/lib/format";
import { createMessage, offload, planLoad, reinstateLoad, removeFromManifest, scanLoad, setFlightStatus, type ScanOutcome } from "@/lib/mock/awb";
import { flightCapacity } from "@/lib/mock/booking";
import { exportExcel } from "@/lib/export";

const part = (s: string, lang: Lang) => { const p = s.split(" / "); return lang === "lo" ? p[0] : p[p.length - 1]; };
const OFFLOAD_CAUSES: [string, string, string][] = [
  ["weight", "ນໍ້າໜັກເກີນຂີດຈໍາກັດຖ້ຽວບິນ", "Flight weight limit exceeded"], ["space", "ພື້ນທີ່ໃນເຮືອບິນບໍ່ພໍ", "Not enough hold space"], ["priority", "ໃຫ້ພື້ນທີ່ແກ່ສິນຄ້າບູລິມະສິດ", "Priority cargo took the space"], ["aircraft", "ປ່ຽນເຄື່ອງບິນ", "Aircraft change"],
  ["damage", "ສິນຄ້າເສຍຫາຍ", "Cargo damaged"], ["docs", "ເອກະສານບໍ່ຄົບ", "Documents incomplete"], ["late", "ສິນຄ້າມາຊ້າ", "Cargo arrived late"], ["customer", "ລູກຄ້າຂໍຖອນ", "Customer request"], ["other", "ອື່ນໆ", "Other"],
];
/** Offload reasons are stored as "lo / en: note"; show the cause in the current language with the note. */
const reasonText = (s: string, lang: Lang) => { const [lo, en = ""] = s.split(" / "); const i = en.indexOf(": "); const note = i >= 0 ? en.slice(i + 2) : ""; return lang === "lo" ? `${lo}${note ? `: ${note}` : ""}` : en || lo; };
type ScanEntry = { outcome: ScanOutcome; code: string; at: string };
const isFuture = (f: Flight) => { const n = new Date(); return f.date > todayIso() || (f.date === todayIso() && f.std > `${pad(n.getHours())}:${pad(n.getMinutes())}`); };

function ScanResult({ entry, flight, d }: { entry: ScanEntry | null; flight: Flight; d: Db }) {
  const t = useT(); const lang = useLang();
  if (!entry) return <div className="flex h-full min-h-[116px] items-center justify-center rounded border border-dashed border-line-strong p-4 text-center text-ink-2"><span className="inline-flex items-center gap-2"><ScanLine size={20} aria-hidden />{t(`ສະແກນ Barcode ເທິງປ້າຍສິນຄ້າ. ລະບົບຈະກວດວ່າສິນຄ້າໄປ ${flight.dest} ແທ້.`, `Scan the barcode on the cargo label. The system checks that it really goes to ${flight.dest}.`)}</span></div>;
  const { outcome: o, code } = entry; const a = o.awb; const no = a?.no ?? code; const stName = (c?: string) => { const s = d.stations.find((x) => x.code === c); return s ? (lang === "lo" ? s.nameLo : s.nameEn) : ""; };
  if (o.kind === "ok") return <div role="status" className="rounded bg-ok p-4 text-white"><div className="flex items-center gap-2.5 text-xl font-semibold"><CheckCircle2 size={26} aria-hidden />{t("ຖືກຕ້ອງ: ຂຶ້ນເຮືອບິນໄດ້", "Correct: load it")}</div><div className="mt-1 font-mono text-lg font-semibold">{no}</div><div className="mt-0.5">{t(`${a?.pieces} ກ່ອງ · ${kg(a?.grossKg ?? 0)} · ໄປ ${flight.dest} ໂດຍ ${flight.no}`, `${a?.pieces} pcs · ${kg(a?.grossKg ?? 0)} · to ${flight.dest} on ${flight.no}`)}</div></div>;
  if (o.kind === "wrong_station") {
    const right = d.flights.filter((f) => f.origin === flight.origin && f.dest === o.expected && f.status === "open" && isFuture(f)).sort((x, y) => `${x.date}${x.std}`.localeCompare(`${y.date}${y.std}`))[0];
    return <div role="alert" className="rounded bg-bad p-4 text-white"><div className="flex items-center gap-2.5 text-2xl font-bold"><OctagonX size={30} aria-hidden />{t("ຢຸດ! ຫ້າມໂຫຼດ: ຜິດສະຖານີ", "STOP. DO NOT LOAD: WRONG STATION")}</div><div className="mt-2 text-lg font-semibold">{t("ສິນຄ້ານີ້ໄປ", "This cargo belongs to")} <span className="rounded-sm bg-white px-1.5 font-mono text-bad">{o.expected}</span> {stName(o.expected)}</div><div className="mt-0.5">{t(`ຖ້ຽວບິນ ${flight.no} ໄປ ${flight.dest} ${stName(flight.dest)}.`, `Flight ${flight.no} goes to ${flight.dest} ${stName(flight.dest)}.`)} <span className="font-mono font-semibold">{no}</span></div><div className="mt-1 text-sm">{right ? t(`ສົ່ງຄືນສາງ. ຖ້ຽວບິນຖັດໄປທີ່ຖືກຕ້ອງ: ${right.no} ${fmtDate(right.date)} ${right.std}.`, `Return it to the warehouse. Next correct flight: ${right.no} ${fmtDate(right.date)} ${right.std}.`) : t("ສົ່ງຄືນສາງ ແລະ ແຈ້ງຫົວໜ້າກະ.", "Return it to the warehouse and tell the shift supervisor.")}</div></div>;
  }
  const notes: Record<Exclude<ScanOutcome["kind"], "ok" | "wrong_station">, { tone: "bad" | "warn"; title: [string, string]; body: [string, string]; link?: { to: string; label: [string, string] } }> = {
    unknown: { tone: "bad", title: ["ບໍ່ຮູ້ຈັກ Barcode ນີ້", "Barcode not recognised"], body: [`ບໍ່ພົບ AWB ເລກ ${code}. ກວດປ້າຍສິນຄ້າ ແລ້ວສະແກນຄືນ ຫຼື ປ້ອນເລກດ້ວຍມື.`, `No AWB has the number ${code}. Check the label and scan again, or type the number.`] },
    not_screened: { tone: "bad", title: ["ຫ້າມໂຫຼດ: ຍັງບໍ່ຜ່ານການກວດ X-Ray", "Do not load: X-Ray not passed"], body: [`${no} ຕ້ອງມີຜົນຜ່ານການກວດກ່ອນຂຶ້ນເຮືອບິນ.`, `${no} needs a passed screening result before it can fly.`], link: { to: "/export/screening", label: ["ໄປໜ້າກວດ X-Ray", "Go to X-Ray"] } },
    not_paid: { tone: "bad", title: ["ຫ້າມໂຫຼດ: ຍັງບໍ່ຊໍາລະເງິນ", "Do not load: not paid"], body: [`${no} ເປັນ AWB ຈ່າຍສົດທີ່ຍັງບໍ່ໄດ້ຮັບເງິນ. ໃຫ້ລູກຄ້າຊໍາລະຢູ່ແຄັດເຊຍກ່ອນ.`, `${no} is a cash AWB with no payment. The customer must pay at the cashier first.`], link: { to: "/finance/cashier", label: ["ໄປແຄັດເຊຍ", "Go to cashier"] } },
    voided: { tone: "bad", title: ["ຫ້າມໂຫຼດ: AWB ຖືກຍົກເລີກ", "Do not load: AWB is void"], body: [`${no} ຖືກຍົກເລີກແລ້ວ. ແຍກສິນຄ້າອອກ ແລະ ແຈ້ງຫົວໜ້າກະ.`, `${no} was voided. Set the cargo aside and tell the shift supervisor.`] },
    over_capacity: { tone: "bad", title: ["ຫ້າມໂຫຼດ: ພື້ນທີ່ບໍ່ພໍ", "Do not load: not enough space"], body: [`${no} ໜັກ ${kg(a?.grossKg ?? 0)} ແຕ່ຍັງເຫຼືອ ${kg(flightCapacity(d, flight.id).remainingKg)}. ອ໋ອບໂຫຼດສິນຄ້າອື່ນກ່ອນ ຫຼື ໃຊ້ຖ້ຽວບິນຖັດໄປ.`, `${no} weighs ${kg(a?.grossKg ?? 0)} but only ${kg(flightCapacity(d, flight.id).remainingKg)} is left. Offload other cargo or use the next flight.`] },
    already: { tone: "warn", title: ["ສະແກນຂຶ້ນເຮືອບິນແລ້ວ", "Already scanned on board"], body: [`${no} ຢູ່ໃນ Manifest ຖ້ຽວນີ້ແລ້ວ. ບໍ່ໄດ້ນັບຊໍ້າ.`, `${no} is already on this manifest. It wasn't counted twice.`] },
    closed: { tone: "warn", title: ["ຖ້ຽວບິນບໍ່ເປີດຮັບສິນຄ້າ", "Flight isn't open for loading"], body: [`ສະຖານະ ${flight.no} ບໍ່ແມ່ນເປີດຮັບ. ເປີດຖ້ຽວບິນຄືນກ່ອນ ຖ້າຍັງບໍ່ອອກບິນ.`, `${flight.no} isn't open. Reopen it first if it hasn't departed.`] },
  };
  const n = notes[o.kind];
  return <div role="alert" className={n.tone === "bad" ? "rounded bg-bad-soft p-4 text-bad" : "rounded bg-warn-soft p-4 text-warn"}><div className="flex items-center gap-2.5 text-xl font-semibold">{n.tone === "bad" ? <OctagonX size={26} aria-hidden /> : <TriangleAlert size={26} aria-hidden />}{t(n.title[0], n.title[1])}</div><div className="mt-1 text-ink">{t(n.body[0], n.body[1])}</div>{n.link && <Link to={n.link.to} className="mt-1 inline-block text-sm font-medium text-brand hover:underline">{t(n.link.label[0], n.link.label[1])}</Link>}</div>;
}

function OffloadDialog({ load, flight, onClose, onDone }: { load: FlightLoad; flight: Flight; onClose: () => void; onDone: (text: string) => void }) {
  const d = useDb(); const t = useT(); const a = d.awbs.find((x) => x.id === load.awbId)!;
  const [cause, setCause] = useState(""); const [note, setNote] = useState(""); const [next, setNext] = useState(""); const [tried, setTried] = useState(false);
  const flights = d.flights.filter((f) => f.id !== flight.id && f.origin === flight.origin && f.dest === flight.dest && f.status === "open" && isFuture(f)).sort((x, y) => `${x.date}${x.std}`.localeCompare(`${y.date}${y.std}`));
  const cust = d.customers.find((c) => c.id === (a.agentId ?? a.shipperId)); const nf = d.flights.find((f) => f.id === next);
  const chosen = OFFLOAD_CAUSES.find((c) => c[0] === cause); const noteMissing = cause === "other" && !note.trim();
  const roomNext = nf ? flightCapacity(d, nf.id).remainingKg : 0;
  function submit() {
    setTried(true); if (!chosen || noteMissing) return;
    const reason = `${chosen[1]} / ${chosen[2]}${note.trim() ? `: ${note.trim()}` : ""}`;
    offload(load.id, reason, next || undefined);
    const noticeLine = cust?.whatsapp ? t(`ແຈ້ງ ${cust.name} ທາງ WhatsApp ${cust.whatsapp} ແລ້ວ.`, `${cust.nameEn} was notified on WhatsApp ${cust.whatsapp}.`) : t(`${cust?.name ?? ""} ບໍ່ມີ WhatsApp: ສ້າງໝາຍເຫດໃຫ້ພະນັກງານໂທ ${cust?.phone ?? ""} ແລ້ວ.`, `${cust?.nameEn ?? ""} has no WhatsApp: a note tells staff to call ${cust?.phone ?? ""}.`);
    onDone(`${t(`ແກ້ໄຂ Manifest ${flight.no} ແລ້ວ: ເອົາ ${a.no} ອອກ.`, `Manifest ${flight.no} corrected: ${a.no} removed.`)} ${noticeLine} ${nf ? t(`ຈອງຖ້ຽວໃໝ່ ${nf.no} ${fmtDate(nf.date)} ແລ້ວ.`, `Rebooked on ${nf.no} ${fmtDate(nf.date)}.`) : t("ຍັງບໍ່ມີຖ້ຽວໃໝ່: ສິນຄ້າລໍຖ້າຢູ່ສາງ.", "No new flight yet: the cargo waits in the warehouse.")}`);
    onClose();
  }
  return <Dialog open onClose={onClose} title={t(`ອ໋ອບໂຫຼດ ${a.no}`, `Offload ${a.no}`)} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="danger" icon={PackageMinus} onClick={submit}>{t("ອ໋ອບໂຫຼດ ແລະ ແຈ້ງລູກຄ້າ", "Offload and notify customer")}</Button></>}>
    <div className="grid gap-3">
      <p className="text-sm"><span className="tnum">{load.pieces} {t("ກ່ອງ", "pcs")} · {kg(load.weightKg)}</span> · {t(`ຈາກ ${flight.no} ໄປ ${flight.dest}`, `from ${flight.no} to ${flight.dest}`)}</p>
      <Field label={t("ສາເຫດ", "Cause")} required error={tried && !chosen ? t("ເລືອກສາເຫດ", "Choose a cause") : undefined}><Select value={cause} onChange={(e) => setCause(e.target.value)} placeholder={t("ເລືອກສາເຫດ", "Choose a cause")} options={OFFLOAD_CAUSES.map(([k, lo, en]) => ({ value: k, label: t(lo, en) }))} /></Field>
      <Field label={t("ໝາຍເຫດ", "Note")} required={cause === "other"} error={tried && noteMissing ? t("ອະທິບາຍສາເຫດ", "Describe the cause") : undefined}><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <Field label={t(`ຈອງຖ້ຽວໃໝ່ໄປ ${flight.dest}`, `Rebook onto another flight to ${flight.dest}`)} hint={flights.length ? undefined : t("ບໍ່ມີຖ້ຽວບິນອື່ນທີ່ເປີດຮັບ", "No other open flight")}><Select value={next} onChange={(e) => setNext(e.target.value)} placeholder={t("ຍັງບໍ່ຈອງ: ເກັບໄວ້ທີ່ສາງ", "Not yet: hold in the warehouse")} options={flights.map((f) => ({ value: f.id, label: `${f.no} ${fmtDate(f.date)} ${f.std} · ${num(flightCapacity(d, f.id).remainingKg)} kg` }))} /></Field>
      {nf && roomNext < load.weightKg && <Callout tone="warn" title={t("ຖ້ຽວນີ້ມີພື້ນທີ່ບໍ່ພໍ", "That flight doesn't have the space")}>{t(`ເຫຼືອ ${kg(roomNext)}. ເລືອກຖ້ຽວອື່ນ ຫຼື ກວດກັບຜູ້ຈັດການ.`, `${kg(roomNext)} left. Choose another flight or check with the manager.`)}</Callout>}
      <Callout title={t("ສິ່ງທີ່ລະບົບຈະເຮັດ", "What happens next")}>{t("Manifest ຖືກແກ້ໄຂ, AWB ບັນທຶກເຫດການ OFLD, ແລະ ", "The manifest is corrected, the AWB records an OFLD event, and ")}{cust?.whatsapp ? t(`ລູກຄ້າໄດ້ຮັບແຈ້ງທາງ WhatsApp ${cust.whatsapp}.`, `the customer is told on WhatsApp ${cust.whatsapp}.`) : t(`ລູກຄ້າບໍ່ມີ WhatsApp: ພະນັກງານຕ້ອງໂທ ${cust?.phone ?? ""}.`, `the customer has no WhatsApp: staff must call ${cust?.phone ?? ""}.`)}</Callout>
    </div>
  </Dialog>;
}

const th = "border border-black px-1.5 py-1 text-left font-semibold"; const td = "border border-black px-1.5 py-1";
function ManifestHead({ title, f, d }: { title: string; f: Flight; d: Db }) {
  const ac = d.aircraft.find((a) => a.code === f.aircraft); const o = d.stations.find((s) => s.code === f.origin); const de = d.stations.find((s) => s.code === f.dest);
  return <><div className="mb-2 flex items-end justify-between border-b-2 border-black pb-1.5"><div><div className="text-[11px] font-semibold">LAO AIRLINES STATE ENTERPRISE · CARGO DEPARTMENT</div><div className="text-xl font-bold tracking-wide">{title}</div></div><div className="text-right font-mono text-lg font-semibold">{f.no}</div></div>
    <div className="mb-2 grid grid-cols-4 gap-x-3 gap-y-1 text-[11px]">
      <div><div className="text-[9px]">Flight / ຖ້ຽວບິນ</div><b className="font-mono">{f.no}</b></div><div><div className="text-[9px]">Date / ວັນທີ</div><b>{fmtDate(f.date)}</b></div><div><div className="text-[9px]">Point of loading</div><b>{f.origin} {o?.nameEn}</b></div><div><div className="text-[9px]">Point of unloading</div><b>{f.dest} {de?.nameEn}</b></div>
      <div><div className="text-[9px]">Aircraft</div><b>{ac?.nameEn ?? f.aircraft}</b></div><div><div className="text-[9px]">STD / STA</div><b className="font-mono">{f.std} / {f.sta}</b></div><div><div className="text-[9px]">Station / ສະຖານີ</div><b>{f.origin}</b></div><div><div className="text-[9px]">Printed</div><b>{fmtDateTime(new Date().toISOString())}</b></div>
    </div></>;
}
const Signatures = ({ labels }: { labels: string[] }) => <div className="mt-8 grid gap-6 text-[11px]" style={{ gridTemplateColumns: `repeat(${labels.length}, 1fr)` }}>{labels.map((l) => <div key={l}><div className="mb-1 h-10 border-b border-black" /><div className="font-semibold">{l}</div><div className="mt-1">Name / ຊື່: ____________________</div><div className="mt-1">Time / ເວລາ: __________</div></div>)}</div>;
function CargoManifest({ f, d, rows, off }: { f: Flight; d: Db; rows: { l: FlightLoad; a: Awb }[]; off: { l: FlightLoad; a: Awb }[] }) {
  const pcs = rows.reduce((s, r) => s + r.l.pieces, 0); const w = rows.reduce((s, r) => s + r.l.weightKg, 0); const vol = rows.reduce((s, r) => s + r.a.volumeKg, 0);
  return <div className="text-black" style={{ fontFamily: "Noto Sans, Noto Sans Lao, sans-serif" }}>
    <ManifestHead title="CARGO MANIFEST" f={f} d={d} />
    <table className="w-full border-collapse text-[11px]"><thead><tr><th className={th}>#</th><th className={th}>AWB No.</th><th className={th}>Orig-Dest</th><th className={`${th} text-right`}>Pcs</th><th className={`${th} text-right`}>Gross kg</th><th className={th}>Nature of goods</th><th className={th}>SHC</th><th className={th}>Shipper / Consignee</th><th className={th}>Status</th></tr></thead>
      <tbody>{rows.map((r, i) => <tr key={r.l.id} className="break-inside-avoid"><td className={td}>{i + 1}</td><td className={`${td} whitespace-nowrap font-mono font-semibold`}>{r.a.no}{r.a.houses.length > 0 && <div className="font-sans text-[9px] font-normal">{r.a.houses.length} HAWB</div>}</td><td className={`${td} whitespace-nowrap font-mono`}>{r.a.origin}-{r.a.dest}</td><td className={`${td} text-right tnum`}>{r.l.pieces}</td><td className={`${td} text-right tnum`}>{num(r.l.weightKg, r.l.weightKg % 1 ? 1 : 0)}</td><td className={td}>{part(r.a.commodity, "en")}</td><td className={`${td} font-mono font-semibold`}>{r.a.shc.join(" ")}</td><td className={td}>{d.customers.find((c) => c.id === r.a.shipperId)?.nameEn}<br />{d.customers.find((c) => c.id === r.a.consigneeId)?.nameEn}</td><td className={td}>{r.l.status === "loaded" ? "LOADED" : "PLANNED"}</td></tr>)}
        {rows.length === 0 && <tr><td className={td} colSpan={9}>NIL CARGO</td></tr>}
        <tr className="font-bold"><td className={td} colSpan={3}>TOTAL · {rows.length} AWB</td><td className={`${td} text-right tnum`}>{pcs}</td><td className={`${td} text-right tnum`}>{num(w, w % 1 ? 1 : 0)}</td><td className={td} colSpan={4}>Volumetric {num(vol, 1)} kg</td></tr></tbody></table>
    {off.length > 0 && <div className="mt-3 text-[11px]"><b>Offloaded from this flight:</b> {off.map((r) => `${r.a.no} (${r.l.pieces} pcs, ${r.l.weightKg} kg): ${reasonText(r.l.reason ?? "", "en")}`).join("; ")}</div>}
    <Signatures labels={["Prepared by / ຜູ້ຈັດທໍາ", "Ramp supervisor / ຫົວໜ້າລານບິນ", "Captain or crew / ກັບຕັນ ຫຼື ລູກເຮືອ"]} />
    <p className="mt-3 text-[10px]">Copies: ground staff, flight crew, destination station {f.dest}.</p>
  </div>;
}
function MailManifest({ f, d, rows }: { f: Flight; d: Db; rows: MailBag[] }) {
  const bags = rows.reduce((s, m) => s + m.bags, 0); const w = rows.reduce((s, m) => s + m.weightKg, 0);
  return <div className="text-black" style={{ fontFamily: "Noto Sans, Noto Sans Lao, sans-serif" }}>
    <ManifestHead title="MAIL MANIFEST" f={f} d={d} />
    <table className="w-full border-collapse text-[11px]"><thead><tr><th className={th}>#</th><th className={th}>Dispatch No.</th><th className={th}>Orig-Dest</th><th className={th}>Category</th><th className={`${th} text-right`}>Bags</th><th className={`${th} text-right`}>Weight kg</th><th className={th}>Post office</th><th className={th}>Mail pass</th></tr></thead>
      <tbody>{rows.map((m, i) => <tr key={m.id}><td className={td}>{i + 1}</td><td className={`${td} font-mono font-semibold`}>{m.no}</td><td className={`${td} font-mono`}>{m.origin}-{m.dest}</td><td className={td}>{m.category}</td><td className={`${td} text-right tnum`}>{m.bags}</td><td className={`${td} text-right tnum`}>{m.weightKg}</td><td className={td}>{m.postOffice}</td><td className={`${td} font-mono`}>{m.passNo ?? ""}</td></tr>)}
        {rows.length === 0 && <tr><td className={td} colSpan={8}>NIL MAIL</td></tr>}
        <tr className="font-bold"><td className={td} colSpan={4}>TOTAL</td><td className={`${td} text-right tnum`}>{bags}</td><td className={`${td} text-right tnum`}>{w}</td><td className={td} colSpan={2} /></tr></tbody></table>
    <Signatures labels={["Post office / ໄປສະນີ", "Prepared by / ຜູ້ຈັດທໍາ", "Captain or crew / ກັບຕັນ ຫຼື ລູກເຮືອ"]} />
  </div>;
}

export default function FlightDetail() {
  const { id } = useParams(); const d = useDb(); const t = useT(); const lang = useLang(); const can = useCan(); const nav = useNavigate(); const st = d.session.station;
  const [code, setCode] = useState(""); const [log, setLog] = useState<ScanEntry[]>([]); const inputRef = useRef<HTMLInputElement>(null);
  const [off, setOff] = useState<FlightLoad | null>(null); const [notice, setNotice] = useState(""); const [remove, setRemove] = useState<FlightLoad | null>(null); const [print, setPrint] = useState<null | "cargo" | "mail">(null); const [ask, setAsk] = useState<null | "close" | "depart" | "reopen">(null);
  const f = d.flights.find((x) => x.id === id);
  const rows = useMemo(() => d.loads.filter((l) => l.flightId === id).map((l) => ({ l, a: d.awbs.find((x) => x.id === l.awbId) })).filter((r): r is { l: FlightLoad; a: Awb } => !!r.a), [d.loads, d.awbs, id]);
  if (!f) return <Empty title={t("ບໍ່ພົບຖ້ຽວບິນນີ້", "Flight not found")} action={<Link to="/export/dispatch"><Button>{t("ກັບໄປລາຍການຖ້ຽວບິນ", "Back to flights")}</Button></Link>} />;
  const flight = f; const cap = flightCapacity(d, f.id); const active = rows.filter((r) => r.l.status !== "offloaded"); const offloaded = rows.filter((r) => r.l.status === "offloaded");
  const planned = active.filter((r) => r.l.status === "planned"); const loaded = active.filter((r) => r.l.status === "loaded");
  const mail = d.mail.filter((m) => m.flightId === f.id);
  const here = f.origin === st; const canOp = can("flight.dispatch") && here; const isOpen = f.status === "open"; const editable = canOp && (f.status === "open" || f.status === "closed");
  const clean = (a: Awb) => a.screening?.result === "pass" && (a.payMode === "credit" || a.paid);
  const onFlightElsewhere = (a: Awb) => d.loads.some((l) => l.awbId === a.id && l.status !== "offloaded");
  const ready = d.awbs.filter((a) => a.status === "active" && a.direction === "export" && a.origin === f.origin && a.dest === f.dest && a.stage === "SCR" && a.screening?.result === "pass" && !onFlightElsewhere(a)).sort((a, b) => (a.flightId === f.id ? 0 : 1) - (b.flightId === f.id ? 0 : 1));
  const notScreened = d.awbs.filter((a) => a.status === "active" && a.direction === "export" && a.origin === f.origin && a.dest === f.dest && a.stage === "RCS").length;

  const sameOrigin = d.awbs.filter((a) => a.status === "active" && a.direction === "export" && a.origin === f.origin);
  const toHere = sameOrigin.filter((a) => a.dest === f.dest);
  const samples: { label: string; code: string; tone: Tone }[] = [];
  const push = (a: Awb | undefined, label: string, tone: Tone) => { if (a) samples.push({ label, code: a.prefix + a.serial, tone }); };
  push(planned.find((r) => clean(r.a))?.a, t("ຢູ່ໃນແຜນ", "On the plan"), "ok");
  push(ready.find(clean), t("ພ້ອມໂຫຼດ", "Ready to load"), "ok");
  const wrong = sameOrigin.find((a) => a.dest !== f.dest && a.screening?.result === "pass") ?? sameOrigin.find((a) => a.dest !== f.dest) ?? d.awbs.find((a) => a.status === "active" && a.dest !== f.dest);
  push(wrong, t(`ສິນຄ້າໄປ ${wrong?.dest}`, `Cargo for ${wrong?.dest}`), "bad");
  push(toHere.find((a) => a.screening?.result !== "pass"), t("ຍັງບໍ່ກວດ X-Ray", "Not screened"), "warn");
  push(toHere.find((a) => a.screening?.result === "pass" && a.payMode === "cash" && !a.paid), t("ຍັງບໍ່ຊໍາລະ", "Not paid"), "warn");
  push(loaded[0]?.a, t("ສະແກນແລ້ວ", "Already scanned"), "neutral");
  push(d.awbs.find((a) => a.status === "voided"), t("AWB ຍົກເລີກ", "Void AWB"), "neutral");
  samples.push({ label: t("ເລກບໍ່ຖືກຕ້ອງ", "Unknown number"), code: "62799999990", tone: "neutral" });

  function doScan(value: string) { const s = value.trim(); if (!s) return; const outcome = scanLoad(flight.id, s); setLog((x) => [{ outcome, code: s.replace(/[\s-]/g, ""), at: new Date().toISOString() }, ...x].slice(0, 6)); setCode(""); inputRef.current?.focus(); }
  function plan(a: Awb) { const prev = offloaded.find((r) => r.a.id === a.id); if (prev) reinstateLoad(prev.l.id); else planLoad(flight.id, a.id); toast(t(`ເພີ່ມ ${a.no} ເຂົ້າແຜນໂຫຼດແລ້ວ`, `${a.no} added to the plan`)); }
  function ffm() { const m = createMessage("FFM", { flightId: flight.id }); toast(t("ສ້າງຮ່າງ FFM ແລ້ວ", "FFM draft generated")); nav(`/export/messages?open=${m.id}`); }
  const excel = () => exportExcel(t("Manifest ຖ້ຽວບິນ", "Flight manifest"), `Manifest-${flight.no}-${flight.date}`, [{ header: "AWB", value: (r: { l: FlightLoad; a: Awb }) => r.a.no }, { header: "Origin", value: (r) => r.a.origin }, { header: "Destination", value: (r) => r.a.dest }, { header: "Pieces", value: (r) => r.l.pieces }, { header: "Gross kg", value: (r) => r.l.weightKg }, { header: "Commodity", value: (r) => part(r.a.commodity, "en") }, { header: "SHC", value: (r) => r.a.shc.join(" ") }, { header: "Shipper", value: (r) => d.customers.find((c) => c.id === r.a.shipperId)?.nameEn ?? "" }, { header: "Consignee", value: (r) => d.customers.find((c) => c.id === r.a.consigneeId)?.nameEn ?? "" }, { header: "Load status", value: (r) => r.l.status }, { header: "Offload reason", value: (r) => (r.l.status === "offloaded" ? r.l.reason ?? "" : "") }], rows, `${flight.no} ${flight.date}`);

  const readyCols: Col<Awb>[] = [
    { key: "no", header: "AWB", render: (a) => <div><AwbLink awb={a} /><div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-ink-2"><span className="line-clamp-1">{part(a.commodity, lang)}</span><ShcTags codes={a.shc} /></div><div className="mt-1 flex flex-wrap gap-1 empty:hidden">{a.payMode === "cash" && !a.paid && <Badge tone="warn">{t("ຍັງບໍ່ຊໍາລະ", "Unpaid")}</Badge>}{a.flightId && a.flightId !== flight.id ? <Badge noIcon>{t("ຈອງ", "Booked")} {flightLabel(d, a.flightId)}</Badge> : a.flightId === flight.id ? <Badge tone="info" noIcon>{t("ຖ້ຽວນີ້", "This flight")}</Badge> : null}</div></div> },
    { key: "w", header: t("ກ່ອງ / kg", "Pcs / kg"), align: "right", render: (a) => <span className="whitespace-nowrap">{a.pieces} · {num(a.grossKg)}</span>, sort: (a) => a.grossKg },
    { key: "act", header: "", align: "right", render: (a) => { const over = a.flightId !== flight.id && a.grossKg > cap.remainingKg; return editable ? <Button size="sm" icon={Plus} disabled={!isOpen || over} title={over ? t(`ພື້ນທີ່ເຫຼືອ ${kg(cap.remainingKg)}`, `Only ${kg(cap.remainingKg)} left`) : !isOpen ? t("ເປີດຖ້ຽວບິນຄືນກ່ອນ", "Reopen the flight first") : undefined} onClick={() => plan(a)}>{over ? t("ພື້ນທີ່ບໍ່ພໍ", "No space") : t("ເພີ່ມ", "Add")}</Button> : null; } },
  ];
  const statusBadge = (l: FlightLoad) => l.status === "loaded" ? <Badge tone="ok">{t("ຂຶ້ນເຮືອບິນແລ້ວ", "Loaded")}</Badge> : l.status === "planned" ? <Badge tone="warn">{t("ຢູ່ໃນແຜນ", "Planned")}</Badge> : <Badge tone="bad">{t("ອ໋ອບໂຫຼດ", "Offloaded")}</Badge>;
  const manCols: Col<{ l: FlightLoad; a: Awb }>[] = [
    { key: "no", header: "AWB", render: ({ a }) => <div><AwbLink awb={a} /><div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-ink-2"><span className="line-clamp-1">{part(a.commodity, lang)}</span><ShcTags codes={a.shc} /></div></div> },
    { key: "pcs", header: t("ກ່ອງ", "Pcs"), align: "right", render: ({ l }) => l.pieces },
    { key: "kg", header: "kg", align: "right", render: ({ l }) => num(l.weightKg, l.weightKg % 1 ? 1 : 0), sort: ({ l }) => l.weightKg },
    { key: "st", header: t("ສະຖານະ", "Load status"), render: ({ l }) => <div>{statusBadge(l)}{l.status === "loaded" && l.scannedAt && <div className="tnum mt-0.5 text-xs text-ink-2">{fmtTime(l.scannedAt)} · {userName(d, l.scannedBy, lang)}</div>}{l.status === "offloaded" && l.reason && <div className="mt-0.5 max-w-[220px] text-xs text-ink-2">{reasonText(l.reason, lang)}</div>}</div>, sort: ({ l }) => l.status },
    { key: "act", header: "", align: "right", render: ({ l }) => editable && l.status !== "offloaded" ? <span className="inline-flex items-center gap-1"><Button size="sm" icon={PackageMinus} onClick={() => setOff(l)}>{t("ອ໋ອບໂຫຼດ", "Offload")}</Button>{l.status === "planned" && <IconButton icon={Trash2} label={t("ເອົາອອກຈາກແຜນ", "Remove from plan")} onClick={() => setRemove(l)} />}</span> : null },
  ];
  const pctCls = cap.usedKg > cap.maxKg ? "text-bad" : "";
  const last = log[0] ?? null;
  return <>
    <PageHeader crumbs={[{ label: t("ຖ້ຽວບິນ ແລະ Manifest", "Flights & manifest"), to: "/export/dispatch" }, { label: `${f.no} ${fmtDate(f.date)}` }]} title={`${f.no} · ${f.origin} → ${f.dest}`} subtitle={`${fmtDate(f.date)} · STD ${f.std} · STA ${f.sta} · ${cap.aircraft?.nameEn ?? f.aircraft}`} actions={<>
      <FlightStatusBadge status={f.status} />
      <Button icon={Printer} onClick={() => setPrint("cargo")}>{t("ພິມ Cargo Manifest", "Print Cargo Manifest")}</Button>
      <Button icon={Mail} onClick={() => setPrint("mail")}>{t("ພິມ Mail Manifest", "Print Mail Manifest")}</Button>
      <Button icon={FileDown} onClick={excel}>{t("Manifest ເປັນ Excel", "Manifest to Excel")}</Button>
      {can("messages.manage") && <Button icon={Send} disabled={!active.length} title={!active.length ? t("ເພີ່ມສິນຄ້າໃນ Manifest ກ່ອນ", "Add cargo to the manifest first") : undefined} onClick={ffm}>{t("ສ້າງຮ່າງ FFM", "Generate FFM draft")}</Button>}
      {canOp && f.status === "open" && <Button variant="primary" icon={Lock} onClick={() => setAsk("close")}>{t("ປິດຖ້ຽວບິນ", "Close flight")}</Button>}
      {canOp && f.status === "closed" && <><Button icon={LockOpen} onClick={() => setAsk("reopen")}>{t("ເປີດຖ້ຽວບິນຄືນ", "Reopen flight")}</Button><Button variant="primary" icon={PlaneTakeoff} disabled={planned.length > 0} title={planned.length ? t("ຍັງມີ AWB ທີ່ບໍ່ໄດ້ສະແກນ", "Some AWBs aren't scanned yet") : undefined} onClick={() => setAsk("depart")}>{t("ບັນທຶກອອກບິນ", "Record departure")}</Button></>}
    </>} />
    {!can("flight.dispatch") && <div className="mb-3"><Callout title={t("ບົດບາດຂອງທ່ານເບິ່ງໄດ້ຢ່າງດຽວ", "Your role can view only")}>{t("ພະນັກງານຮັບສິນຄ້າ ແລະ ພະນັກງານສາງ ເປັນຜູ້ຈັດການໂຫຼດຖ້ຽວບິນ.", "Acceptance and warehouse officers manage flight loading.")}</Callout></div>}
    {can("flight.dispatch") && !here && <div className="mb-3"><Callout tone="warn" title={t(`ຖ້ຽວບິນນີ້ອອກຈາກ ${f.origin}`, `This flight leaves from ${f.origin}`)}>{t(`ທ່ານກໍາລັງເຮັດວຽກຢູ່ ${st}. ປ່ຽນສະຖານີເປັນ ${f.origin} ເພື່ອຈັດການໂຫຼດ.`, `You are working at ${st}. Switch the station to ${f.origin} to manage the load.`)}</Callout></div>}
    {f.status === "closed" && planned.length > 0 && <div className="mb-3"><Callout tone="warn" title={t(`ຍັງມີ ${planned.length} AWB ທີ່ບໍ່ໄດ້ສະແກນ`, `${planned.length} AWB(s) not scanned`)}>{t("ເປີດຖ້ຽວບິນຄືນເພື່ອສະແກນ ຫຼື ອ໋ອບໂຫຼດ ກ່ອນບັນທຶກອອກບິນ.", "Reopen the flight to scan them, or offload them, before recording departure.")}</Callout></div>}
    {notice && <div className="mb-3"><Callout tone="ok" title={t("ອ໋ອບໂຫຼດສໍາເລັດ", "Offload complete")} action={<button className="shrink-0 text-sm font-medium text-brand hover:underline" onClick={() => setNotice("")}>{t("ປິດ", "Dismiss")}</button>}>{notice}</Callout></div>}
    <div className="mb-4 rounded-md border border-line bg-surface p-4">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4"><span className="text-sm font-medium">{t("ນໍ້າໜັກເທິງຖ້ຽວບິນ", "Flight load")}</span><span className={`tnum ${pctCls}`}><b className="text-lg">{num(cap.usedKg)}</b> / {num(cap.maxKg)} kg · {Math.round(cap.pct * 100)}%</span></div>
      <BarMeter value={cap.usedKg} max={cap.maxKg} label={t("ນໍ້າໜັກເທິງຖ້ຽວບິນ", "Flight load")} />
      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
        <div><dt className="box-label">AWB</dt><dd className="tnum">{kg(cap.awbKg)}</dd></div><div><dt className="box-label">{t("ການຈອງຢືນຢັນ", "Confirmed bookings")}</dt><dd className="tnum">{kg(cap.bookedKg)}</dd></div><div><dt className="box-label">{t("ຖົງເມ", "Mail")}</dt><dd className="tnum">{kg(cap.mailKg)}</dd></div><div><dt className="box-label">{t("ສະແກນຂຶ້ນແລ້ວ", "Scanned on board")}</dt><dd className="tnum">{kg(cap.loadedKg)}</dd></div><div><dt className="box-label">{t("ພື້ນທີ່ຍັງເຫຼືອ", "Space left")}</dt><dd className={`tnum font-semibold ${cap.remainingKg < 0 ? "text-bad" : ""}`}>{kg(cap.remainingKg)}</dd></div>
      </dl>
      {cap.remainingKg < 0 && <div className="mt-2.5"><Callout tone="bad" title={t(`ເກີນຄວາມຈຸ ${kg(-cap.remainingKg)}`, `Over capacity by ${kg(-cap.remainingKg)}`)}>{t("ອ໋ອບໂຫຼດສິນຄ້າ ຫຼື ຍ້າຍການຈອງ ກ່ອນປິດຖ້ຽວບິນ.", "Offload cargo or move a booking before closing the flight.")}</Callout></div>}
    </div>
    <Panel className="mb-4" title={t("ສະແກນຂຶ້ນເຮືອບິນ", "Scan on board")} actions={<span className="tnum text-sm text-ink-2">{t(`ສະແກນແລ້ວ ${loaded.length} / ${active.length} AWB`, `${loaded.length} of ${active.length} AWBs scanned`)}</span>}>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <form onSubmit={(e) => { e.preventDefault(); doScan(code); }} className="flex gap-2">
            <input ref={inputRef} autoFocus disabled={!canOp} value={code} onChange={(e) => setCode(e.target.value)} aria-label={t("Barcode AWB", "AWB barcode")} placeholder={t("ສະແກນ ຫຼື ປ້ອນເລກ AWB", "Scan or type an AWB number")} autoComplete="off" spellCheck={false} className="h-12 min-w-0 flex-1 rounded border-2 border-brand bg-surface px-3 font-mono text-lg font-semibold placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:border-line-strong disabled:bg-surface-2" />
            <Button type="submit" variant="primary" size="lg" icon={ScanLine} disabled={!canOp} className="h-12">{t("ສະແກນ", "Scan")}</Button>
          </form>
          {canOp && <div className="mt-3"><div className="box-label mb-1.5">{t("ຈໍາລອງການສະແກນ", "Simulate scan")}</div><div className="flex flex-wrap gap-1.5">{samples.map((s) => <button key={s.code + s.label} type="button" onClick={() => doScan(s.code)} className={`rounded border px-2 py-1 text-left text-xs hover:bg-surface-2 ${s.tone === "bad" ? "border-bad/60" : "border-line-strong"}`}><span className={`block font-medium ${s.tone === "bad" ? "text-bad" : ""}`}>{s.label}</span><span className="block font-mono text-[11px] text-ink-2">{s.code}</span></button>)}</div></div>}
        </div>
        <div>
          <ScanResult entry={last} flight={flight} d={d} />
          {log.length > 1 && <ul className="mt-2 divide-y divide-line text-xs">{log.slice(1).map((e, i) => <li key={i} className="flex justify-between gap-3 py-1"><span className="font-mono">{e.outcome.awb?.no ?? e.code}</span><span className={e.outcome.kind === "ok" ? "text-ok" : e.outcome.kind === "already" || e.outcome.kind === "closed" ? "text-warn" : "text-bad"}>{e.outcome.kind === "ok" ? t("ຖືກຕ້ອງ", "Loaded") : e.outcome.kind === "wrong_station" ? t(`ຜິດສະຖານີ ${e.outcome.expected}`, `Wrong station ${e.outcome.expected}`) : t("ຖືກປະຕິເສດ", "Refused")}</span><span className="tnum text-ink-2">{fmtTime(e.at)}</span></li>)}</ul>}
        </div>
      </div>
    </Panel>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Panel flush title={t(`ພ້ອມໂຫຼດໄປ ${f.dest}`, `Ready to load for ${f.dest}`)} actions={<span className="tnum text-sm text-ink-2">{ready.length}</span>}>
        <DataTable rows={ready} columns={readyCols} rowKey={(a) => a.id} minWidth={340} pageSize={8} search={(a) => `${a.prefix}${a.serial} ${a.commodity}`} empty={<Empty title={t("ບໍ່ມີ AWB ທີ່ພ້ອມໂຫຼດ", "No AWBs are ready to load")}>{t(`AWB ໄປ ${f.dest} ຈະສະແດງຢູ່ນີ້ຫຼັງຜ່ານການກວດ X-Ray.`, `AWBs for ${f.dest} appear here once they pass X-Ray.`)}</Empty>} />
        {notScreened > 0 && <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-sm"><span className="text-ink-2">{t(`ອີກ ${notScreened} AWB ລໍຖ້າກວດ X-Ray`, `${notScreened} more AWB(s) waiting for X-Ray`)}</span><Link to="/export/screening" className="font-medium text-brand hover:underline">{t("ໄປໜ້າກວດ", "Go to X-Ray")}</Link></div>}
      </Panel>
      <div className="space-y-4">
        <Panel flush title="Manifest" actions={<span className="tnum text-sm text-ink-2">{t(`${active.length} AWB · ${active.reduce((s, r) => s + r.l.pieces, 0)} ກ່ອງ · ${kg(active.reduce((s, r) => s + r.l.weightKg, 0))}`, `${active.length} AWB · ${active.reduce((s, r) => s + r.l.pieces, 0)} pcs · ${kg(active.reduce((s, r) => s + r.l.weightKg, 0))}`)}</span>}>
          <DataTable rows={rows} columns={manCols} rowKey={(r) => r.l.id} minWidth={560} pageSize={20} empty={<Empty icon={Ban} title={t("Manifest ຍັງຫວ່າງ", "The manifest is empty")}>{t("ເພີ່ມ AWB ຈາກລາຍການພ້ອມໂຫຼດ ຫຼື ສະແກນ Barcode.", "Add AWBs from the ready list or scan a barcode.")}</Empty>} />
        </Panel>
        {mail.length > 0 && <Panel flush title={t("ຖົງເມໃນຖ້ຽວນີ້", "Mail on this flight")} actions={<Link to="/wms/mail" className="text-sm font-medium text-brand hover:underline">{t("ຈັດການຖົງເມ", "Manage mail")}</Link>}><ul className="divide-y divide-line text-sm">{mail.map((m) => <li key={m.id} className="flex flex-wrap justify-between gap-3 px-4 py-2"><span className="font-mono text-[13px] font-semibold">{m.no}</span><span>{m.category}</span><span className="tnum">{t(`${m.bags} ຖົງ`, `${m.bags} bags`)} · {kg(m.weightKg)}</span></li>)}</ul></Panel>}
      </div>
    </div>
    {off && <OffloadDialog load={off} flight={f} onClose={() => { setOff(null); inputRef.current?.focus(); }} onDone={(text) => { setNotice(text); toast(t("ແກ້ໄຂ Manifest ແລະ ແຈ້ງລູກຄ້າແລ້ວ", "Manifest corrected and customer notified")); }} />}
    <Confirm open={!!remove} onClose={() => setRemove(null)} title={t("ເອົາ AWB ອອກຈາກແຜນ?", "Remove this AWB from the plan?")} body={t("ສິນຄ້າຍັງບໍ່ໄດ້ຂຶ້ນເຮືອບິນ ຈຶ່ງບໍ່ແຈ້ງລູກຄ້າ. AWB ຈະກັບໄປລາຍການພ້ອມໂຫຼດ.", "The cargo hasn't been loaded, so the customer isn't notified. The AWB returns to the ready list.")} confirmLabel={t("ເອົາອອກຈາກແຜນ", "Remove from plan")} onConfirm={() => { if (remove) { removeFromManifest(remove.id); toast(t("ເອົາອອກຈາກແຜນແລ້ວ", "Removed from the plan")); } }} />
    <Confirm open={ask === "close"} onClose={() => setAsk(null)} title={t(`ປິດຮັບສິນຄ້າ ${f.no}?`, `Close ${f.no} for cargo?`)} body={planned.length ? <Callout tone="warn" title={t(`ຍັງມີ ${planned.length} AWB ທີ່ບໍ່ໄດ້ສະແກນ`, `${planned.length} AWB(s) not scanned`)}>{t("ຕ້ອງສະແກນ ຫຼື ອ໋ອບໂຫຼດກ່ອນບັນທຶກອອກບິນ.", "They must be scanned or offloaded before departure.")}</Callout> : t("ຈະສະແກນ ແລະ ເພີ່ມສິນຄ້າບໍ່ໄດ້ ຈົນກວ່າຈະເປີດຄືນ.", "No more scans or additions until it is reopened.")} confirmLabel={t("ປິດຖ້ຽວບິນ", "Close flight")} onConfirm={() => { setFlightStatus(flight.id, "closed"); toast(t(`ປິດ ${flight.no} ແລ້ວ`, `${flight.no} closed`)); }} />
    <Confirm open={ask === "reopen"} onClose={() => setAsk(null)} title={t(`ເປີດ ${f.no} ຄືນ?`, `Reopen ${f.no}?`)} confirmLabel={t("ເປີດຖ້ຽວບິນຄືນ", "Reopen flight")} onConfirm={() => { setFlightStatus(flight.id, "open"); toast(t(`ເປີດ ${flight.no} ຄືນແລ້ວ`, `${flight.no} reopened`)); inputRef.current?.focus(); }} />
    <Confirm open={ask === "depart"} onClose={() => setAsk(null)} title={t(`ບັນທຶກ ${f.no} ອອກບິນ?`, `Record departure of ${f.no}?`)} body={t(`AWB ${loaded.length} ລາຍການຈະປ່ຽນເປັນ DEP. ຫຼັງຈາກນີ້ເປີດຖ້ຽວບິນຄືນບໍ່ໄດ້.`, `${loaded.length} AWB(s) move to DEP. The flight can't be reopened after this.`)} confirmLabel={t("ບັນທຶກອອກບິນ", "Record departure")} onConfirm={() => { setFlightStatus(flight.id, "departed"); toast(t(`${flight.no} ອອກບິນແລ້ວ`, `${flight.no} departed`)); }} />
    <PrintSheet open={print === "cargo"} onClose={() => setPrint(null)} title={t(`Cargo Manifest ${f.no}`, `Cargo Manifest ${f.no}`)}><CargoManifest f={f} d={d} rows={active} off={offloaded} /></PrintSheet>
    <PrintSheet open={print === "mail"} onClose={() => setPrint(null)} title={t(`Mail Manifest ${f.no}`, `Mail Manifest ${f.no}`)}><MailManifest f={f} d={d} rows={mail} /></PrintSheet>
  </>;
}
