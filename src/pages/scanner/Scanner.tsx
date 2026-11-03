import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRightLeft, CheckCircle2, ChevronRight, CloudUpload, Monitor, PackageCheck, PackageOpen, PlaneTakeoff, ScanLine, Trash2, TriangleAlert, Vibrate, Wifi, WifiOff, XCircle, type LucideIcon } from "lucide-react";
import { can, currentUser, getDb, setSession, useDb } from "@/lib/store";
import { bi, useLang, useName, useT, type T } from "@/lib/i18n";
import { BarMeter, cx } from "@/ui/kit";
import type { Awb, Condition, Db, PermKey } from "@/lib/types";
import { fmtDate, fmtTime, kg, money, num, todayIso } from "@/lib/format";
import { awbsToReceive, deliverCargo, findAwbByCode, hasReceipt, moveToZone, receiveCargo, releaseCheck, zoneLoad } from "@/lib/mock/ops";
import { scanLoad, type ScanOutcome } from "@/lib/mock/awb";
import { flightCapacity } from "@/lib/mock/booking";

// ---------- Offline queue: scans wait on the device until signal returns ----------
type ReceiveInput = { pieces: number; condition: Condition; note?: string; zoneId?: string };
type DeliverInput = { receiverName: string; receiverPhone: string; idNo?: string };
type Queued = { id: string; ts: string; no: string; awbId: string } & ({ kind: "receive"; input: ReceiveInput } | { kind: "load"; flightId: string; flightNo: string; code: string } | { kind: "deliver"; input: DeliverInput } | { kind: "move"; zoneId: string; zoneCode: string });
type NewQueued = Queued extends infer Q ? (Q extends Queued ? Omit<Q, "id" | "ts"> : never) : never;
type SyncResult = { id: string; no: string; ok: boolean; text: string };
const KEY = "qv-scanner-device";
function readDevice(): { online: boolean; queue: Queued[] } { try { const raw = localStorage.getItem(KEY); if (raw) { const p = JSON.parse(raw); return { online: p.online !== false, queue: Array.isArray(p.queue) ? p.queue : [] }; } } catch { /* storage unavailable: keep in memory */ } return { online: true, queue: [] }; }
function writeDevice(v: { online: boolean; queue: Queued[] }) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } }
interface Ctx { online: boolean; queue: Queued[]; enqueue: (q: NewQueued) => void; queued: (awbId: string) => boolean }

// ---------- Large-format controls for one-handed use ----------
const BTN: Record<"primary" | "secondary" | "success" | "danger", string> = { primary: "bg-brand text-white border-brand active:bg-brand-hover", secondary: "bg-surface text-ink border-line-strong active:bg-surface-2", success: "bg-ok text-white border-ok active:brightness-95", danger: "bg-surface text-bad border-bad/60 active:bg-bad-soft" };
function Big({ variant = "secondary", icon: I, children, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN; icon?: LucideIcon }) { return <button type="button" {...p} className={cx("flex min-h-14 w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-lg font-semibold leading-6 transition-colors disabled:opacity-45", BTN[variant], className)}>{I && <I size={22} aria-hidden />}{children}</button>; }
const inputCls = "h-14 w-full rounded-md border border-line-strong bg-surface px-3 text-lg text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";
function Label({ children, required }: { children: ReactNode; required?: boolean }) { return <span className="mb-1 block text-sm font-medium text-ink-2">{children}{required && <span className="text-bad"> *</span>}</span>; }
function Banner({ tone, title, children }: { tone: "ok" | "warn" | "bad" | "info"; title: string; children?: ReactNode }) {
  const I = tone === "ok" ? CheckCircle2 : tone === "bad" ? XCircle : tone === "warn" ? TriangleAlert : CloudUpload;
  return <div role={tone === "bad" ? "alert" : "status"} className={cx("flex gap-2.5 rounded-md px-3 py-3", tone === "ok" ? "bg-ok-soft text-ok" : tone === "bad" ? "bg-bad-soft text-bad" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-info-soft text-info")}><I size={24} className="mt-0.5 shrink-0" aria-hidden /><div className="min-w-0"><div className="text-base font-semibold leading-6">{title}</div>{children && <div className="mt-0.5 text-sm text-ink">{children}</div>}</div></div>;
}
function Screen({ title, back, children, onBack }: { title: string; back?: string; onBack?: () => void; children: ReactNode }) {
  const nav = useNavigate(); const t = useT();
  return <div className="flex min-h-full flex-col"><div className="flex items-center gap-1 border-b border-line bg-surface px-2 py-1.5"><button aria-label={t("ກັບຄືນ", "Back")} onClick={() => onBack ? onBack() : nav(back ?? "/scanner")} className="grid h-12 w-12 shrink-0 place-items-center rounded-md active:bg-surface-2"><ArrowLeft size={24} aria-hidden /></button><h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1></div><div className="flex-1 space-y-3 p-3">{children}</div></div>;
}
type Sample = { code: string; no: string; sub: string; tone?: "bad" };
function ScanBox({ samples, onScan, hint }: { samples: Sample[]; onScan: (code: string) => void; hint?: string }) {
  const t = useT(); const [v, setV] = useState("");
  return <>
    <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onScan(v.trim()); setV(""); } }} className="space-y-2">
      <label className="block"><Label>{hint ?? t("ສະແກນ ຫຼື ພິມເລກ AWB", "Scan or type the AWB number")}</Label><input autoFocus className={cx(inputCls, "font-mono")} value={v} onChange={(e) => setV(e.target.value)} placeholder="627-4410 0000" autoComplete="off" /></label>
      <Big type="submit" variant="primary" icon={ScanLine} disabled={!v.trim()}>{t("ສະແກນ", "Scan")}</Big>
    </form>
    {samples.length > 0 && <div><div className="mb-1 mt-4 text-sm font-medium text-ink-2">{t("ບາໂຄດຕົວຢ່າງ: ແຕະເພື່ອສະແກນ", "Sample barcodes: tap to scan")}</div><ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">{samples.map((s) => <li key={s.code + s.sub}><button onClick={() => onScan(s.code)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left active:bg-brand-soft"><ScanLine size={20} aria-hidden className="shrink-0 text-ink-3" /><span className="min-w-0 flex-1"><span className="block font-mono text-base font-semibold">{s.no}</span><span className={cx("block truncate text-sm", s.tone === "bad" ? "font-medium text-bad" : "text-ink-2")}>{s.sub}</span></span></button></li>)}</ul></div>}
  </>;
}
const AwbHead = ({ a }: { a: Awb }) => { const t = useT(); return <div className="rounded-md border border-line bg-surface px-3 py-2.5"><div className="font-mono text-xl font-semibold">{a.no}</div><div className="mt-0.5 font-mono text-lg font-semibold">{a.origin} <span className="font-normal text-ink-3">→</span> {a.dest}</div><div className="tnum text-base">{t(`${a.pieces} ກ່ອງ`, `${a.pieces} pieces`)} · {kg(a.grossKg)}</div><div className="truncate text-sm text-ink-2">{bi(t, a.commodity)}{a.shc.length > 0 && <span className="ml-1.5 font-mono font-semibold text-warn">{a.shc.join(" ")}</span>}</div></div>; };
const sampleOf = (a: Awb, sub: string, tone?: "bad"): Sample => ({ code: a.prefix + a.serial, no: a.no, sub, tone });

// ---------- App frame ----------
export default function Scanner() {
  const d = useDb(); const t = useT(); const lang = useLang(); const name = useName(); const params = useParams(); const nav = useNavigate(); const user = currentUser(d); const st = d.session.station; const route = params["*"] ?? "";
  const [device, setDevice] = useState(readDevice); const [results, setResults] = useState<SyncResult[] | null>(null);
  useEffect(() => { writeDevice(device); }, [device]);
  const ctx: Ctx = { online: device.online, queue: device.queue, enqueue: (q) => setDevice((v) => ({ ...v, queue: [...v.queue, { ...q, id: `Q${Date.now().toString(36)}${v.queue.length}`, ts: new Date().toISOString() } as Queued] })), queued: (id) => device.queue.some((q) => q.awbId === id) };
  function sync() {
    const out: SyncResult[] = device.queue.map((q) => applyQueued(q, t));
    setDevice((v) => ({ ...v, queue: [] })); setResults(out); nav("/scanner/queue");
  }
  const body = !user ? <SignIn /> : route === "receive" ? <ReceiveMode ctx={ctx} /> : route === "load" ? <LoadMode ctx={ctx} /> : route === "deliver" ? <DeliverMode ctx={ctx} /> : route === "move" ? <MoveMode ctx={ctx} /> : route === "queue" ? <QueueScreen online={device.online} queue={device.queue} results={results} onSync={sync} onRemove={(id) => setDevice((v) => ({ ...v, queue: v.queue.filter((q) => q.id !== id) }))} onClear={() => setResults(null)} /> : <Home queue={device.queue.length} online={device.online} onSync={sync} />;
  return <div className="h-[100dvh] bg-page sm:flex sm:items-center sm:justify-center sm:p-4">
    <style>{`@keyframes qv-buzz { 0%,100% { transform: translateX(0) } 10%,50%,90% { transform: translateX(-7px) } 30%,70% { transform: translateX(7px) } } .qv-buzz { animation: qv-buzz .45s linear 3; } @media (prefers-reduced-motion: reduce) { .qv-buzz { animation: none; } }`}</style>
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-page sm:h-[min(840px,calc(100dvh-32px))] sm:w-[402px] sm:rounded-[26px] sm:border-[7px] sm:border-navy sm:shadow-pop">
      <header className="shrink-0 bg-navy text-white">
        <div className="flex items-center gap-2 px-3 pb-1 pt-2"><img src="./logo.png" alt="Lao Airlines" width={84} height={35} className="h-9 w-auto" /><div className="ml-auto flex items-center gap-1.5">
          <select aria-label={t("ສະຖານີ", "Station")} value={st} onChange={(e) => setSession({ station: e.target.value })} className="h-10 rounded border border-white/25 bg-navy-2 px-1.5 font-mono text-base font-semibold text-white">{d.stations.filter((s) => s.active).map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}</select>
          <div role="group" aria-label={t("ພາສາ", "Language")} className="flex h-10 overflow-hidden rounded border border-white/25 text-sm">{(["lo", "en"] as const).map((l) => <button key={l} onClick={() => setSession({ lang: l })} aria-pressed={lang === l} className={cx("px-2.5", lang === l ? "bg-white text-navy font-semibold" : "text-white")}>{l === "lo" ? "ລາວ" : "EN"}</button>)}</div>
        </div></div>
        <div className="flex items-center gap-2 px-3 pb-2">
          <button aria-pressed={!device.online} onClick={() => setDevice((v) => ({ ...v, online: !v.online }))} className={cx("flex h-10 items-center gap-1.5 rounded px-2.5 text-sm font-semibold", device.online ? "bg-ok text-white" : "bg-[var(--warn)] text-white")}>{device.online ? <Wifi size={18} aria-hidden /> : <WifiOff size={18} aria-hidden />}{device.online ? t("ອອນລາຍ", "Online") : t("ອອບລາຍ", "Offline")}</button>
          <Link to="/scanner/queue" className="flex h-10 items-center gap-1.5 rounded bg-navy-2 px-2.5 text-sm"><CloudUpload size={18} aria-hidden /><span>{t("ລໍຖ້າສົ່ງ", "Queued")}</span><span className="tnum font-semibold">{device.queue.length}</span></Link>
          {user && <span className="ml-auto truncate text-xs text-navy-text">{name(user)}</span>}
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">{body}</main>
    </div>
  </div>;
}

function SignIn() {
  const t = useT();
  return <div className="space-y-4 p-4"><h1 className="text-xl font-semibold">{t("ເຂົ້າໃຊ້ແອັບສະແກນ", "Sign in to the scanner")}</h1><p className="text-base text-ink-2">{t("ເຄື່ອງນີ້ຍັງບໍ່ໄດ້ເຂົ້າລະບົບ. ເຂົ້າໃຊ້ເປັນພະນັກງານສາງ ທີ່ສະຖານີ VTE.", "This device is not signed in. Sign in as the warehouse officer at VTE.")}</p><Big variant="primary" onClick={() => setSession({ userId: "U-03", station: "VTE" })}>{t("ເຂົ້າໃຊ້ເປັນພະນັກງານສາງ", "Sign in as warehouse officer")}</Big><Link to="/login" className="block text-center text-base font-medium text-brand">{t("ເລືອກບົດບາດອື່ນ", "Choose another role")}</Link></div>;
}

function Home({ queue, online, onSync }: { queue: number; online: boolean; onSync: () => void }) {
  const d = useDb(); const t = useT(); const st = d.session.station;
  const modes: { to: string; icon: LucideIcon; lo: string; en: string; perm: PermKey; sub: string }[] = [
    { to: "receive", icon: PackageCheck, lo: "ຮັບເຂົ້າສາງ", en: "Receive into warehouse", perm: "wms.operate", sub: t(`ລໍຖ້າຮັບ ${awbsToReceive(d, st).length} AWB`, `${awbsToReceive(d, st).length} AWB(s) waiting`) },
    { to: "load", icon: PlaneTakeoff, lo: "ໂຫຼດຂຶ້ນຖ້ຽວບິນ", en: "Load to flight", perm: "flight.dispatch", sub: t("ເລືອກຖ້ຽວບິນ ແລ້ວສະແກນແຕ່ລະ AWB", "Choose a flight, then scan each AWB") },
    { to: "deliver", icon: PackageOpen, lo: "ມອບສິນຄ້າ", en: "Deliver", perm: "import.operate", sub: t("ກວດພາສີ ແລະ ຄ່າຝາກສາງ ກ່ອນມອບ", "Checks customs and storage before release") },
    { to: "move", icon: ArrowRightLeft, lo: "ຍ້າຍໂຊນ", en: "Move to zone", perm: "wms.operate", sub: t("ຍ້າຍສິນຄ້າໄປຕໍາແໜ່ງໃໝ່", "Move cargo to a new location") },
  ];
  return <div className="flex min-h-full flex-col">
    {queue > 0 && <div className="p-3 pb-0">{online ? <Big variant="success" icon={CloudUpload} onClick={onSync}>{t(`ສົ່ງ ${queue} ລາຍການທີ່ຄ້າງ`, `Sync ${queue} queued scan(s)`)}</Big> : <Banner tone="warn" title={t(`ເກັບໄວ້ໃນເຄື່ອງ ${queue} ລາຍການ`, `${queue} scan(s) held on this device`)}>{t("ຈະສົ່ງໄດ້ເມື່ອກັບມາອອນລາຍ.", "They can sync once you are back online.")}</Banner>}</div>}
    {!online && queue === 0 && <div className="p-3 pb-0"><Banner tone="warn" title={t("ບໍ່ມີສັນຍານ", "No signal")}>{t("ສະແກນຕໍ່ໄດ້. ລາຍການຈະເກັບໄວ້ໃນເຄື່ອງ.", "Keep scanning. Scans are held on this device.")}</Banner></div>}
    <ul className="m-3 divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">{modes.map((m) => { const ok = can(m.perm, d); const inner = <><m.icon size={30} aria-hidden className={cx("shrink-0", ok ? "text-brand" : "text-ink-3")} /><span className="min-w-0 flex-1"><span className="block text-lg font-semibold leading-6">{t(m.lo, m.en)}</span><span className="block text-sm text-ink-2">{ok ? m.sub : t("ບົດບາດຂອງທ່ານບໍ່ມີສິດໃຊ້ໂໝດນີ້", "Your role cannot use this mode")}</span></span>{ok && <ChevronRight size={22} aria-hidden className="shrink-0 text-ink-3" />}</>; return <li key={m.to}>{ok ? <Link to={`/scanner/${m.to}`} className="flex min-h-[84px] items-center gap-3 px-3 py-3 active:bg-brand-soft">{inner}</Link> : <div className="flex min-h-[84px] items-center gap-3 px-3 py-3 opacity-60">{inner}</div>}</li>; })}</ul>
    <div className="mt-auto p-3"><Link to="/wms/inbound" className="flex min-h-12 items-center justify-center gap-2 text-base font-medium text-brand"><Monitor size={20} aria-hidden />{t("ກັບໄປລະບົບພະນັກງານ", "Back to the staff system")}</Link></div>
  </div>;
}

// ---------- Receive ----------
const COND: { key: Condition; lo: string; en: string }[] = [{ key: "good", lo: "ປົກກະຕິ", en: "Good" }, { key: "damage", lo: "ເສຍຫາຍ", en: "Damage" }, { key: "wet", lo: "ປຽກນໍ້າ", en: "Wet" }, { key: "broken", lo: "ແຕກຫັກ", en: "Broken" }];
function ReceiveMode({ ctx }: { ctx: Ctx }) {
  const d = useDb(); const t = useT(); const st = d.session.station;
  const [id, setId] = useState<string | null>(null); const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "bad" | "info"; title: string; body?: string } | null>(null);
  const a = d.awbs.find((x) => x.id === id);
  const list = awbsToReceive(d, st).filter((x) => !ctx.queued(x.id));
  function scan(code: string) {
    const x = findAwbByCode(d, code);
    if (!x) return setMsg({ tone: "bad", title: t(`ບໍ່ພົບ AWB ${code}`, `No AWB matches ${code}`), body: t("ກວດປ້າຍ ແລ້ວສະແກນອີກຄັ້ງ.", "Check the label and scan again.") });
    if (x.dest !== st) return setMsg({ tone: "bad", title: t(`ສິນຄ້ານີ້ໄປ ${x.dest}`, `This cargo is bound for ${x.dest}`), body: t(`ບໍ່ແມ່ນ ${st}. ກັນໄວ້ ແລະ ແຈ້ງຫົວໜ້າ.`, `Not ${st}. Set it aside and tell your supervisor.`) });
    if (hasReceipt(x)) return setMsg({ tone: "warn", title: t(`${x.no} ຮັບເຂົ້າສາງແລ້ວ`, `${x.no} is already received`) });
    if (ctx.queued(x.id)) return setMsg({ tone: "warn", title: t(`${x.no} ຢູ່ໃນຄິວແລ້ວ`, `${x.no} is already queued`) });
    if (!list.some((y) => y.id === x.id)) return setMsg({ tone: "warn", title: t(`${x.no} ຍັງບໍ່ໄດ້ອອກບິນມາ ${st}`, `${x.no} has not yet departed for ${st}`) });
    setMsg(null); setId(x.id);
  }
  if (a) return <ReceiveForm key={a.id} a={a} onBack={() => setId(null)} onConfirm={(input) => {
    if (ctx.online) { receiveCargo(a.id, input); const faults = (input.condition !== "good" ? 1 : 0) + (input.pieces !== a.pieces ? 1 : 0); setMsg(faults ? { tone: "warn", title: t(`ຮັບ ${a.no} ແລ້ວ`, `${a.no} received`), body: t(`ເປີດບັນທຶກຄວາມຜິດປົກກະຕິ ${faults} ລາຍການ.`, `${faults} irregularity record(s) opened.`) } : { tone: "ok", title: t(`ຮັບ ${a.no} ແລ້ວ`, `${a.no} received`) }); }
    else { ctx.enqueue({ kind: "receive", awbId: a.id, no: a.no, input }); setMsg({ tone: "info", title: t(`ເກັບ ${a.no} ໄວ້ໃນຄິວ`, `${a.no} queued on this device`), body: t("ຈະບັນທຶກເມື່ອກັບມາອອນລາຍ.", "It is recorded when you are back online.") }); }
    setId(null);
  }} />;
  return <Screen title={t("ຮັບເຂົ້າສາງ", "Receive into warehouse")}>{msg && <Banner tone={msg.tone} title={msg.title}>{msg.body}</Banner>}<ScanBox onScan={scan} samples={list.slice(0, 6).map((x) => sampleOf(x, `${x.origin} → ${x.dest} · ${t(`${x.pieces} ກ່ອງ`, `${x.pieces} pcs`)}`))} />{list.length === 0 && <p className="text-base text-ink-2">{t(`ບໍ່ມີສິນຄ້າລໍຖ້າຮັບເຂົ້າສາງທີ່ ${st}. ປ່ຽນສະຖານີດ້ານເທິງ ຖ້າເຮັດວຽກຢູ່ບ່ອນອື່ນ.`, `No cargo is waiting for receipt at ${st}. Change the station above if you work elsewhere.`)}</p>}</Screen>;
}
function ReceiveForm({ a, onBack, onConfirm }: { a: Awb; onBack: () => void; onConfirm: (i: ReceiveInput) => void }) {
  const d = useDb(); const t = useT(); const name = useName(); const st = d.session.station; const zones = d.zones.filter((z) => z.station === st && z.active);
  const [pieces, setPieces] = useState(a.pieces); const [condition, setCondition] = useState<Condition | "">(""); const [note, setNote] = useState(""); const [zoneId, setZoneId] = useState(""); const [tried, setTried] = useState(false);
  const noteNeeded = !!condition && condition !== "good"; const needZone = zones.length > 0; const err = !condition || (noteNeeded && !note.trim()) || (needZone && !zoneId) || pieces < 1;
  return <Screen title={t("ກວດຮັບສິນຄ້າ", "Check and receive")} onBack={onBack}>
    <AwbHead a={a} />
    <div><Label required>{t("ກ່ອງທີ່ຮັບຕົວຈິງ", "Pieces received")}</Label><div className="flex items-stretch gap-2"><button aria-label={t("ຫຼຸດ", "Fewer")} onClick={() => setPieces((p) => Math.max(1, p - 1))} className="h-16 w-20 rounded-md border border-line-strong bg-surface text-3xl font-semibold active:bg-surface-2">−</button><div className="tnum grid h-16 flex-1 place-items-center rounded-md border border-line bg-surface text-3xl font-semibold">{pieces}</div><button aria-label={t("ເພີ່ມ", "More")} onClick={() => setPieces((p) => p + 1)} className="h-16 w-20 rounded-md border border-line-strong bg-surface text-3xl font-semibold active:bg-surface-2">+</button></div>{pieces !== a.pieces && <p className="mt-1 text-sm font-medium text-warn">{pieces < a.pieces ? t(`ຂາດ ${a.pieces - pieces} ກ່ອງ: ຈະເປີດບັນທຶກຄວາມຜິດປົກກະຕິ`, `${a.pieces - pieces} short: an irregularity opens`) : t(`ເກີນ ${pieces - a.pieces} ກ່ອງ: ຈະເປີດບັນທຶກຄວາມຜິດປົກກະຕິ`, `${pieces - a.pieces} over: an irregularity opens`)}</p>}</div>
    <div role="radiogroup" aria-label={t("ສະພາບສິນຄ້າ", "Condition")}><Label required>{t("ສະພາບສິນຄ້າ", "Condition")}</Label><div className="grid grid-cols-2 gap-2">{COND.map((c) => <button key={c.key} role="radio" aria-checked={condition === c.key} onClick={() => setCondition(c.key)} className={cx("h-14 rounded-md border text-lg font-semibold", condition === c.key ? (c.key === "good" ? "border-ok bg-ok text-white" : "border-bad bg-bad text-white") : "border-line-strong bg-surface active:bg-surface-2")}>{t(c.lo, c.en)}</button>)}</div>{tried && !condition && <p className="mt-1 text-sm text-bad">{t("ເລືອກສະພາບສິນຄ້າ.", "Choose the condition.")}</p>}</div>
    {noteNeeded && <label className="block"><Label required>{t("ລາຍລະອຽດ", "What you found")}</Label><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />{tried && !note.trim() && <p className="mt-1 text-sm text-bad">{t("ບອກສິ່ງທີ່ພົບ.", "Describe what you found.")}</p>}</label>}
    {needZone && <div><Label required>{t("ໂຊນ", "Zone")}</Label><div className="grid grid-cols-3 gap-2">{zones.map((z) => <button key={z.id} aria-pressed={zoneId === z.id} title={name(z)} onClick={() => setZoneId(z.id)} className={cx("h-14 rounded-md border font-mono text-lg font-semibold", zoneId === z.id ? "border-brand bg-brand text-white" : "border-line-strong bg-surface active:bg-surface-2")}>{z.code}</button>)}</div>{zoneId && <p className="mt-1 text-sm text-ink-2">{name(zones.find((z) => z.id === zoneId))}</p>}{tried && !zoneId && <p className="mt-1 text-sm text-bad">{t("ເລືອກໂຊນ.", "Choose a zone.")}</p>}{zoneId && a.shc.includes("PER") && zones.find((z) => z.id === zoneId)?.type !== "cold" && <p className="mt-1 text-sm font-medium text-bad">{t("ສິນຄ້າເນົ່າເສຍງ່າຍ ຄວນເກັບຫ້ອງເຢັນ.", "Perishable: belongs in a cold zone.")}</p>}</div>}
    <Big variant="success" icon={PackageCheck} onClick={() => { setTried(true); if (err || !condition) return; onConfirm({ pieces, condition, note: note.trim() || undefined, zoneId: zoneId || undefined }); }}>{t("ຢືນຢັນຮັບເຂົ້າສາງ", "Confirm receipt")}</Big>
  </Screen>;
}

// ---------- Load ----------
function loadText(t: T, o: ScanOutcome, flightNo: string): { tone: "ok" | "warn" | "bad"; title: string; body?: string } {
  const no = o.awb?.no ?? "";
  switch (o.kind) {
    case "ok": return { tone: "ok", title: t(`${no} ຂຶ້ນ ${flightNo} ແລ້ວ`, `${no} loaded on ${flightNo}`) };
    case "unknown": return { tone: "bad", title: t("ບໍ່ພົບ AWB ນີ້", "No AWB matches this scan"), body: t("ກວດປ້າຍ ແລ້ວສະແກນອີກຄັ້ງ.", "Check the label and scan again.") };
    case "closed": return { tone: "bad", title: t(`ຖ້ຽວບິນ ${flightNo} ປິດຮັບແລ້ວ`, `Flight ${flightNo} is closed`), body: t("ເລືອກຖ້ຽວບິນທີ່ເປີດຮັບ.", "Choose an open flight.") };
    case "voided": return { tone: "bad", title: t(`${no} ຖືກຍົກເລີກແລ້ວ`, `${no} is void`), body: t("ຫ້າມໂຫຼດ. ກັນໄວ້ ແລະ ແຈ້ງຫົວໜ້າ.", "Do not load. Set it aside and tell your supervisor.") };
    case "wrong_station": return { tone: "bad", title: t(`ຜິດສະຖານີ: ສິນຄ້າໄປ ${o.expected}`, `Wrong station: cargo goes to ${o.expected}`) };
    case "not_screened": return { tone: "bad", title: t(`${no} ຍັງບໍ່ຜ່ານ X-Ray`, `${no} has not passed X-Ray`), body: t("ສົ່ງກວດ X-Ray ກ່ອນໂຫຼດ.", "Send it to X-Ray before loading.") };
    case "not_paid": return { tone: "bad", title: t(`${no} ຍັງບໍ່ຊໍາລະເງິນ`, `${no} is not paid`), body: t("ໃຫ້ລູກຄ້າຊໍາລະທີ່ແຄັດເຊຍກ່ອນໂຫຼດ.", "The customer pays at the cashier before loading.") };
    case "over_capacity": return { tone: "bad", title: t("ຖ້ຽວບິນເຕັມ", "The flight is full"), body: t(`${no} ໜັກເກີນພື້ນທີ່ທີ່ເຫຼືອ. ເລືອກຖ້ຽວບິນອື່ນ.`, `${no} is heavier than the space left. Choose another flight.`) };
    case "already": return { tone: "warn", title: t(`${no} ໂຫຼດແລ້ວ`, `${no} is already loaded`) };
  }
}
function LoadMode({ ctx }: { ctx: Ctx }) {
  const d = useDb(); const t = useT(); const st = d.session.station; const [flightId, setFlightId] = useState<string | null>(null); const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "bad" | "info"; title: string; body?: string } | null>(null); const [wrong, setWrong] = useState<{ awb: Awb; expected: string } | null>(null);
  const flights = useMemo(() => d.flights.filter((f) => f.origin === st && f.status === "open" && f.date >= todayIso()).sort((a, b) => (a.date + a.std).localeCompare(b.date + b.std)).slice(0, 8), [d.flights, st]);
  const f = d.flights.find((x) => x.id === flightId);
  if (!f) return <Screen title={t("ເລືອກຖ້ຽວບິນ", "Choose a flight")}>{flights.length === 0 ? <p className="text-base text-ink-2">{t(`ບໍ່ມີຖ້ຽວບິນເປີດຮັບຈາກ ${st}.`, `No open flights from ${st}.`)}</p> : <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">{flights.map((x) => { const cap = flightCapacity(d, x.id); return <li key={x.id}><button onClick={() => { setFlightId(x.id); setMsg(null); }} className="block min-h-[76px] w-full px-3 py-2.5 text-left active:bg-brand-soft"><span className="flex items-baseline justify-between gap-2"><span className="font-mono text-xl font-semibold">{x.no}</span><span className="font-mono text-xl font-semibold">{x.origin} <span className="font-normal text-ink-3">→</span> {x.dest}</span></span><span className="tnum mb-1 flex justify-between text-sm text-ink-2"><span>{fmtDate(x.date)} {x.std}</span><span>{num(cap.usedKg)} / {num(cap.maxKg)} kg</span></span><BarMeter value={cap.usedKg} max={cap.maxKg} label={`${x.no} ${num(cap.usedKg)} kg`} /></button></li>; })}</ul>}</Screen>;
  const onFlight = d.loads.filter((l) => l.flightId === f.id && l.status !== "offloaded"); const loaded = onFlight.filter((l) => l.status === "loaded");
  const planned = onFlight.filter((l) => l.status === "planned").map((l) => d.awbs.find((a) => a.id === l.awbId)).filter((a): a is Awb => !!a && !ctx.queued(a.id));
  const offRoute = d.awbs.find((a) => a.status === "active" && a.direction === "export" && a.origin === st && a.dest !== f.dest && ["SCR", "MAN"].includes(a.stage));
  const otherOk = d.awbs.filter((a) => a.status === "active" && a.direction === "export" && a.origin === st && a.dest === f.dest && a.stage === "SCR" && !ctx.queued(a.id) && !planned.includes(a)).slice(0, 2);
  const unscreened = d.awbs.find((a) => a.status === "active" && a.direction === "export" && a.origin === st && a.dest === f.dest && a.stage === "RCS");
  const samples: Sample[] = [...planned.slice(0, 4).map((a) => sampleOf(a, t(`ຕາມ Manifest · ${a.pieces} ກ່ອງ`, `On the Manifest · ${a.pieces} pcs`))), ...otherOk.map((a) => sampleOf(a, t(`ກວດ X-Ray ແລ້ວ · ໄປ ${a.dest}`, `X-Ray passed · to ${a.dest}`))), ...(unscreened ? [sampleOf(unscreened, t("ຍັງບໍ່ກວດ X-Ray", "Not yet screened"))] : []), ...(offRoute ? [sampleOf(offRoute, t(`ສິນຄ້າໄປ ${offRoute.dest}: ຜິດສະຖານີ`, `Bound for ${offRoute.dest}: wrong station`), "bad")] : [])];
  function block(awb: Awb, expected: string) { try { navigator.vibrate?.([250, 100, 250, 100, 250]); } catch { /* not supported */ } setWrong({ awb, expected }); setMsg(null); }
  function scan(code: string) {
    if (ctx.online) { const hit = findAwbByCode(getDb(), code); const o = scanLoad(f!.id, hit ? hit.prefix + hit.serial : code); if (o.kind === "wrong_station" && o.awb) return block(o.awb, o.expected ?? o.awb.dest); return setMsg(loadText(t, o, f!.no)); }
    // Offline: the destination check still runs against the manifest data held on the device.
    const a = findAwbByCode(getDb(), code);
    if (!a) return setMsg(loadText(t, { kind: "unknown" }, f!.no));
    if (a.dest !== f!.dest) return block(a, a.dest);
    if (ctx.queued(a.id)) return setMsg({ tone: "warn", title: t(`${a.no} ຢູ່ໃນຄິວແລ້ວ`, `${a.no} is already queued`) });
    ctx.enqueue({ kind: "load", awbId: a.id, no: a.no, flightId: f!.id, flightNo: f!.no, code: a.prefix + a.serial });
    setMsg({ tone: "info", title: t(`ເກັບ ${a.no} ໄວ້ໃນຄິວ`, `${a.no} queued on this device`), body: t("ກວດປາຍທາງແລ້ວ. ກວດ X-Ray ແລະ ການຊໍາລະ ເມື່ອສົ່ງຂໍ້ມູນ.", "Destination checked. X-Ray and payment are checked at sync.") });
  }
  return <>
    <Screen title={`${f.no} → ${f.dest}`} onBack={() => setFlightId(null)}>
      <div className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2.5"><div><div className="text-sm text-ink-2">{fmtDate(f.date)} {f.std}</div><div className="font-mono text-2xl font-semibold">{f.origin} <span className="font-normal text-ink-3">→</span> {f.dest}</div></div><div className="text-right"><div className="text-sm text-ink-2">{t("ໂຫຼດແລ້ວ", "Loaded")}</div><div className="tnum text-2xl font-semibold">{loaded.length} / {onFlight.length}</div></div></div>
      {msg && <Banner tone={msg.tone} title={msg.title}>{msg.body}</Banner>}
      <ScanBox onScan={scan} samples={samples} />
    </Screen>
    {wrong && <div role="alertdialog" aria-label={t("ຜິດສະຖານີ", "Wrong station")} className="absolute inset-0 z-50 flex flex-col bg-bad p-5 text-white">
      <div className="qv-buzz flex flex-1 flex-col items-center justify-center text-center">
        <Vibrate size={56} aria-hidden />
        <div className="mt-2 text-3xl font-bold">{t("ຢຸດ! ຜິດສະຖານີ", "STOP: wrong station")}</div>
        <div className="mt-1 text-lg">{t("ຫ້າມໂຫຼດສິນຄ້ານີ້ຂຶ້ນຖ້ຽວບິນນີ້", "Do not load this cargo on this flight")}</div>
        <div className="mt-6 text-base">{t("ສິນຄ້ານີ້ຕ້ອງໄປ", "This cargo goes to")}</div>
        <div className="font-mono text-[84px] font-bold leading-none">{wrong.expected}</div>
        <div className="mt-1 text-base">{d.stations.find((s) => s.code === wrong.expected)?.nameEn}</div>
        <div className="mt-6 text-base">{t(`ຖ້ຽວບິນ ${f.no} ໄປ`, `Flight ${f.no} goes to`)} <b className="font-mono text-xl">{f.dest}</b></div>
        <div className="mt-2 font-mono text-lg">{wrong.awb.no}</div>
      </div>
      <button onClick={() => setWrong(null)} className="min-h-16 w-full rounded-md bg-white text-lg font-semibold text-bad active:bg-bad-soft">{t("ຮັບຊາບ ແລະ ກັນສິນຄ້າອອກ", "Understood: set the cargo aside")}</button>
    </div>}
  </>;
}

// ---------- Deliver ----------
function DeliverMode({ ctx }: { ctx: Ctx }) {
  const d = useDb(); const t = useT(); const st = d.session.station; const [id, setId] = useState<string | null>(null); const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "bad" | "info"; title: string; body?: string } | null>(null);
  const a = d.awbs.find((x) => x.id === id);
  const waiting = d.awbs.filter((x) => x.status === "active" && x.dest === st && ["RCF", "NFD", "CUS"].includes(x.stage) && !ctx.queued(x.id));
  const ready = waiting.filter((x) => releaseCheck(d, x).ready).slice(0, 3); const blocked = waiting.filter((x) => !releaseCheck(d, x).ready).sort((x, y) => releaseCheck(d, x).storage.days - releaseCheck(d, y).storage.days).slice(0, 3);
  function scan(code: string) {
    const x = findAwbByCode(d, code);
    if (!x) return setMsg({ tone: "bad", title: t(`ບໍ່ພົບ AWB ${code}`, `No AWB matches ${code}`), body: t("ກວດເລກ ແລ້ວສະແກນອີກຄັ້ງ.", "Check the number and scan again.") });
    if (x.dest !== st) return setMsg({ tone: "bad", title: t(`ສິນຄ້ານີ້ໄປ ${x.dest}`, `This cargo is bound for ${x.dest}`), body: t(`ມອບທີ່ ${st} ບໍ່ໄດ້.`, `It cannot be delivered at ${st}.`) });
    if (x.stage === "DLV") return setMsg({ tone: "warn", title: t(`${x.no} ມອບແລ້ວ`, `${x.no} is already delivered`), body: x.delivery ? `${x.delivery.receiverName} · ${x.delivery.receiverPhone}` : undefined });
    if (ctx.queued(x.id)) return setMsg({ tone: "warn", title: t(`${x.no} ຢູ່ໃນຄິວແລ້ວ`, `${x.no} is already queued`) });
    setMsg(null); setId(x.id);
  }
  if (a) return <DeliverCheck key={a.id} a={a} onBack={() => setId(null)} onConfirm={(input) => {
    const c = releaseCheck(d, a);
    if (ctx.online) { deliverCargo(a.id, { ...input, documentsChecked: true, storageFee: c.storage.fee, storageDays: c.storage.days, currency: c.storage.currency }); setMsg({ tone: "ok", title: t(`ມອບ ${a.no} ແລ້ວ`, `${a.no} delivered`), body: input.receiverName }); }
    else { ctx.enqueue({ kind: "deliver", awbId: a.id, no: a.no, input }); setMsg({ tone: "info", title: t(`ເກັບ ${a.no} ໄວ້ໃນຄິວ`, `${a.no} queued on this device`), body: t("ຈະບັນທຶກເມື່ອກັບມາອອນລາຍ.", "It is recorded when you are back online.") }); }
    setId(null);
  }} />;
  return <Screen title={t("ມອບສິນຄ້າ", "Deliver")}>{msg && <Banner tone={msg.tone} title={msg.title}>{msg.body}</Banner>}<ScanBox onScan={scan} samples={[...ready.map((x) => sampleOf(x, t("ພ້ອມມອບ", "Ready to release"))), ...blocked.map((x) => { const c = releaseCheck(d, x); return sampleOf(x, !c.customsOk ? t("ຍັງບໍ່ຜ່ານພາສີ", "Not cleared by Customs") : c.storageState === "at_cashier" ? t("ລໍຖ້າຊໍາລະ", "Waiting at the cashier") : t(`ຄ່າຝາກສາງ ${money(c.storage.fee, c.storage.currency)}`, `Storage ${money(c.storage.fee, c.storage.currency)}`)); })]} /></Screen>;
}
function DeliverCheck({ a, onBack, onConfirm }: { a: Awb; onBack: () => void; onConfirm: (i: DeliverInput) => void }) {
  const d = useDb(); const t = useT(); const c = releaseCheck(d, a);
  const [docs, setDocs] = useState(false); const [receiverName, setName] = useState(""); const [receiverPhone, setPhone] = useState(""); const [idNo, setIdNo] = useState(""); const [tried, setTried] = useState(false);
  const reasons: string[] = [];
  if (!c.received) reasons.push(t("ຍັງບໍ່ຮັບເຂົ້າສາງ", "Not yet received into the warehouse"));
  if (!c.customsOk) reasons.push(c.customsStatus === "hold" ? t("ພາສີກັກສິນຄ້ານີ້ໄວ້", "Customs is holding this cargo") : t("ຍັງບໍ່ຜ່ານພາສີ", "Not cleared by Customs"));
  if (c.storageState === "to_bill") reasons.push(t(`ຄ່າຝາກສາງ ${money(c.storage.fee, c.storage.currency)} ຍັງບໍ່ສົ່ງໄປແຄັດເຊຍ`, `Storage ${money(c.storage.fee, c.storage.currency)} not yet sent to the cashier`));
  if (c.storageState === "at_cashier") reasons.push(t(`ຄ່າຝາກສາງ ${money(c.storage.fee, c.storage.currency)} ລໍຖ້າຊໍາລະ`, `Storage ${money(c.storage.fee, c.storage.currency)} waiting at the cashier`));
  if (!c.paidOk && c.storageState === "none") reasons.push(t("ຍັງມີຄ່າຄ້າງຊໍາລະ", "Charges still unpaid"));
  const missing = !docs || !receiverName.trim() || !receiverPhone.trim() || !idNo.trim();
  return <Screen title={t("ກວດກ່ອນມອບ", "Check before release")} onBack={onBack}>
    <AwbHead a={a} />
    {c.ready ? <>
      <Banner tone="ok" title={t("ພ້ອມມອບສິນຄ້າ", "Ready to release")}>{c.storage.fee === 0 ? (c.storage.sameDay ? t("ຮັບພາຍໃນມື້: ບໍ່ເສຍຄ່າ", "Same-day pickup: no fee") : t("ບໍ່ມີຄ່າຝາກສາງ", "No storage fee")) : t(`ຄ່າຝາກສາງ ${money(c.storage.fee, c.storage.currency)} ຊໍາລະແລ້ວ`, `Storage ${money(c.storage.fee, c.storage.currency)} paid`)}</Banner>
      <label className="flex min-h-14 items-center gap-3 rounded-md border border-line-strong bg-surface px-3 py-2 text-base"><input type="checkbox" className="h-7 w-7 shrink-0 accent-[var(--brand)]" checked={docs} onChange={(e) => setDocs(e.target.checked)} />{t("ກວດ AWB ແລະ ບັດປະຈໍາຕົວແລ້ວ", "AWB and ID checked")}</label>
      <label className="block"><Label required>{t("ຊື່ຜູ້ມາຮັບ", "Receiver name")}</Label><input className={inputCls} value={receiverName} onChange={(e) => setName(e.target.value)} /></label>
      <label className="block"><Label required>{t("ເບີໂທ", "Phone number")}</Label><input className={inputCls} inputMode="tel" value={receiverPhone} onChange={(e) => setPhone(e.target.value)} /></label>
      <label className="block"><Label required>{t("ເລກບັດປະຈໍາຕົວ", "ID number")}</Label><input className={inputCls} value={idNo} onChange={(e) => setIdNo(e.target.value)} /></label>
      {tried && missing && <p className="text-sm font-medium text-bad">{t("ຕິກກວດເອກະສານ ແລະ ໃສ່ຂໍ້ມູນຜູ້ມາຮັບໃຫ້ຄົບ.", "Tick the documents check and fill in every receiver field.")}</p>}
      <Big variant="success" icon={PackageOpen} onClick={() => { setTried(true); if (!missing) onConfirm({ receiverName: receiverName.trim(), receiverPhone: receiverPhone.trim(), idNo: idNo.trim() }); }}>{t("ຢືນຢັນມອບສິນຄ້າ", "Confirm delivery")}</Big>
    </> : <>
      <Banner tone="bad" title={t("ຍັງມອບບໍ່ໄດ້", "Cannot be released yet")}><ul className="list-disc pl-4">{reasons.map((r) => <li key={r}>{r}</li>)}</ul></Banner>
      <Link to={`/import/delivery?awb=${a.id}`} className="flex min-h-14 items-center justify-center gap-2 rounded-md border border-brand bg-brand px-4 text-lg font-semibold text-white"><Monitor size={22} aria-hidden />{t("ເປີດໜ້າມອບສິນຄ້າ", "Open the delivery screen")}</Link>
      <Big onClick={onBack}>{t("ສະແກນ AWB ອື່ນ", "Scan another AWB")}</Big>
    </>}
  </Screen>;
}

// ---------- Move ----------
function MoveMode({ ctx }: { ctx: Ctx }) {
  const d = useDb(); const t = useT(); const name = useName(); const st = d.session.station; const [id, setId] = useState<string | null>(null); const [msg, setMsg] = useState<{ tone: "ok" | "warn" | "bad" | "info"; title: string; body?: string } | null>(null);
  const zones = d.zones.filter((z) => z.station === st && z.active); const a = d.awbs.find((x) => x.id === id); const from = d.zones.find((z) => z.id === a?.zoneId);
  const inStore = zones.flatMap((z) => zoneLoad(d, z.id).list.filter((x) => !ctx.queued(x.id)).slice(0, 2).map((x) => ({ x, z }))).slice(0, 6);
  function scan(code: string) {
    const x = findAwbByCode(d, code);
    if (!x) return setMsg({ tone: "bad", title: t(`ບໍ່ພົບ AWB ${code}`, `No AWB matches ${code}`), body: t("ກວດປ້າຍ ແລ້ວສະແກນອີກຄັ້ງ.", "Check the label and scan again.") });
    if (!zones.some((z) => z.id === x.zoneId) || !zoneLoad(d, x.zoneId!).list.some((y) => y.id === x.id)) return setMsg({ tone: "bad", title: t(`${x.no} ບໍ່ໄດ້ຢູ່ໃນສາງ ${st}`, `${x.no} is not in the ${st} warehouse`), body: t("ຮັບເຂົ້າສາງກ່ອນ ຈຶ່ງຍ້າຍໄດ້.", "Receive it first, then move it.") });
    if (ctx.queued(x.id)) return setMsg({ tone: "warn", title: t(`${x.no} ຢູ່ໃນຄິວແລ້ວ`, `${x.no} is already queued`) });
    setMsg(null); setId(x.id);
  }
  if (a) return <Screen title={t("ເລືອກໂຊນໃໝ່", "Choose the new zone")} onBack={() => setId(null)}>
    <AwbHead a={a} />
    <p className="text-base">{t("ຢູ່ໂຊນ", "Now in zone")} <b className="font-mono">{from?.code ?? "—"}</b></p>
    <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">{zones.filter((z) => z.id !== a.zoneId).map((z) => { const l = zoneLoad(d, z.id).kg; const over = l + a.grossKg > z.capacityKg; const warm = a.shc.includes("PER") && z.type !== "cold"; return <li key={z.id}><button onClick={() => {
      if (ctx.online) { moveToZone(a.id, z.id); setMsg({ tone: "ok", title: t(`ຍ້າຍ ${a.no} ໄປ ${z.code} ແລ້ວ`, `${a.no} moved to ${z.code}`) }); }
      else { ctx.enqueue({ kind: "move", awbId: a.id, no: a.no, zoneId: z.id, zoneCode: z.code }); setMsg({ tone: "info", title: t(`ເກັບ ${a.no} ໄວ້ໃນຄິວ`, `${a.no} queued on this device`), body: t(`ຈະຍ້າຍໄປ ${z.code} ເມື່ອກັບມາອອນລາຍ.`, `It moves to ${z.code} when you are back online.`) }); }
      setId(null);
    }} className="block min-h-[68px] w-full px-3 py-2 text-left active:bg-brand-soft"><span className="flex items-baseline justify-between gap-2"><span className="font-mono text-xl font-semibold">{z.code}</span><span className="tnum text-sm text-ink-2">{num(l)} / {num(z.capacityKg)} kg</span></span><span className="block truncate text-sm text-ink-2">{name(z)}</span>{(over || warm) && <span className="block text-sm font-medium text-bad">{warm ? t("ສິນຄ້າເນົ່າເສຍງ່າຍ ຄວນເກັບຫ້ອງເຢັນ", "Perishable: belongs in a cold zone") : t("ຈະເກີນຄວາມຈຸ", "Goes over capacity")}</span>}</button></li>; })}</ul>
  </Screen>;
  return <Screen title={t("ຍ້າຍໂຊນ", "Move to zone")}>{msg && <Banner tone={msg.tone} title={msg.title}>{msg.body}</Banner>}<ScanBox onScan={scan} samples={inStore.map(({ x, z }) => sampleOf(x, t(`ຢູ່ໂຊນ ${z.code} · ${x.pieces} ກ່ອງ`, `In zone ${z.code} · ${x.pieces} pcs`)))} /></Screen>;
}

// ---------- Queue and sync ----------
/** Apply one held scan with the same rules as an online scan. */
function applyQueued(q: Queued, t: T): SyncResult {
  const d: Db = getDb(); const a = d.awbs.find((x) => x.id === q.awbId);
  const out = (ok: boolean, text: string): SyncResult => ({ id: q.id, no: q.no, ok, text });
  if (!a) return out(false, t("ບໍ່ພົບ AWB ໃນລະບົບ", "AWB not found in the system"));
  if (q.kind === "receive") { if (hasReceipt(a)) return out(false, t("ມີຄົນຮັບເຂົ້າສາງແລ້ວ", "Someone already received it")); receiveCargo(a.id, q.input); return out(true, t("ຮັບເຂົ້າສາງແລ້ວ", "Received into the warehouse")); }
  if (q.kind === "load") { const o = scanLoad(q.flightId, q.code); const m = loadText(t, o, q.flightNo); return out(o.kind === "ok", m.body ? `${m.title}. ${m.body}` : m.title); }
  if (q.kind === "move") { moveToZone(a.id, q.zoneId); return out(true, t(`ຍ້າຍໄປ ${q.zoneCode} ແລ້ວ`, `Moved to ${q.zoneCode}`)); }
  const c = releaseCheck(d, a); if (!c.ready) return out(false, a.stage === "DLV" ? t("ມອບແລ້ວ", "Already delivered") : t("ຍັງມອບບໍ່ໄດ້: ກວດໜ້າມອບສິນຄ້າ", "Cannot be released: check the delivery screen"));
  deliverCargo(a.id, { ...q.input, documentsChecked: true, storageFee: c.storage.fee, storageDays: c.storage.days, currency: c.storage.currency }); return out(true, t(`ມອບໃຫ້ ${q.input.receiverName} ແລ້ວ`, `Delivered to ${q.input.receiverName}`));
}
function QueueScreen({ online, queue, results, onSync, onRemove, onClear }: { online: boolean; queue: Queued[]; results: SyncResult[] | null; onSync: () => void; onRemove: (id: string) => void; onClear: () => void }) {
  const t = useT();
  const kindName = (q: Queued) => q.kind === "receive" ? t("ຮັບເຂົ້າສາງ", "Receive") : q.kind === "load" ? t(`ໂຫຼດຂຶ້ນ ${q.flightNo}`, `Load on ${q.flightNo}`) : q.kind === "deliver" ? t(`ມອບໃຫ້ ${q.input.receiverName}`, `Deliver to ${q.input.receiverName}`) : t(`ຍ້າຍໄປ ${q.zoneCode}`, `Move to ${q.zoneCode}`);
  return <Screen title={t("ລາຍການທີ່ລໍຖ້າສົ່ງ", "Queued scans")}>
    {results && results.length > 0 && <div><Banner tone={results.every((r) => r.ok) ? "ok" : "warn"} title={t(`ສົ່ງສໍາເລັດ ${results.filter((r) => r.ok).length} ຈາກ ${results.length} ລາຍການ`, `${results.filter((r) => r.ok).length} of ${results.length} scans applied`)} /><ul className="mt-2 divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">{results.map((r) => <li key={r.id} className="flex gap-2 px-3 py-2">{r.ok ? <CheckCircle2 size={20} aria-hidden className="mt-0.5 shrink-0 text-ok" /> : <XCircle size={20} aria-hidden className="mt-0.5 shrink-0 text-bad" />}<span className="min-w-0"><span className="block font-mono text-sm font-semibold">{r.no}</span><span className="block text-sm text-ink-2">{r.text}</span></span></li>)}</ul><button onClick={onClear} className="mt-1 min-h-12 w-full text-base font-medium text-brand">{t("ລ້າງຜົນ", "Clear results")}</button></div>}
    {queue.length === 0 ? (!results?.length && <div className="py-8 text-center"><CloudUpload size={36} aria-hidden className="mx-auto mb-2 text-ink-3" /><p className="text-lg font-medium">{t("ບໍ່ມີລາຍການຄ້າງ", "Nothing is queued")}</p><p className="text-base text-ink-2">{t("ເມື່ອປິດສັນຍານ ລາຍການສະແກນຈະມາລໍຖ້າຢູ່ນີ້.", "When signal drops, scans wait here.")}</p></div>) : <>
      {online ? <Big variant="success" icon={CloudUpload} onClick={onSync}>{t(`ສົ່ງ ${queue.length} ລາຍການ`, `Sync ${queue.length} scan(s)`)}</Big> : <Banner tone="warn" title={t("ຍັງອອບລາຍຢູ່", "Still offline")}>{t("ແຕະປຸ່ມ ອອບລາຍ ດ້ານເທິງ ເມື່ອມີສັນຍານ ແລ້ວສົ່ງຂໍ້ມູນ.", "Tap Offline above once you have signal, then sync.")}</Banner>}
      <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">{queue.map((q) => <li key={q.id} className="flex items-center gap-2 px-3 py-2"><span className="min-w-0 flex-1"><span className="block font-mono text-base font-semibold">{q.no}</span><span className="block truncate text-sm text-ink-2">{kindName(q)} · <span className="tnum">{fmtTime(q.ts)}</span></span></span><button aria-label={t(`ລຶບ ${q.no} ອອກຈາກຄິວ`, `Remove ${q.no} from the queue`)} onClick={() => onRemove(q.id)} className="grid h-12 w-12 shrink-0 place-items-center rounded-md text-bad active:bg-bad-soft"><Trash2 size={20} aria-hidden /></button></li>)}</ul>
    </>}
  </Screen>;
}
