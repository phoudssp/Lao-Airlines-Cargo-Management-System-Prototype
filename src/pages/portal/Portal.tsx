import { FormEvent, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route as RouterRoute, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, CalendarPlus, CheckCircle2, CircleUser, LogOut, Package, PlaneLanding, PlaneTakeoff, Search } from "lucide-react";
import { setSession, useDb } from "@/lib/store";
import { bi, useLang, useT } from "@/lib/i18n";
import { Badge, BarMeter, Button, Callout, Checkbox, cx, Empty, Field, Input, Select, Tabs, Toaster, toast, type Tone } from "@/ui/kit";
import { AwbStrip, Route, SHC_LIST, ShcTags, stageName, STAGE_NAMES } from "@/ui/cargo";
import type { Awb, AwbEvent, Booking, BookingStatus, Customer, Db, Flight, FlightStatus, Lang, StageCode } from "@/lib/types";
import { fmtDate, fmtDateTime, kg, num, pad, todayIso } from "@/lib/format";
import { createBooking, customerHistory, flightCapacity, portalLookup, updateBooking } from "@/lib/mock/booking";
import { nowIso } from "@/lib/store";

const KEY = "qv-portal-user";
function readUser() { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } }
function writeUser(id: string) { try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch { /* the sign-in lasts until the page closes */ } }
const part = (s: string, lang: Lang) => { const p = s.split(" / "); return lang === "lo" ? p[0] : p[p.length - 1]; };
const hhmm = () => { const n = new Date(); return `${pad(n.getHours())}:${pad(n.getMinutes())}`; };
const isFuture = (f: Flight) => f.date > todayIso() || (f.date === todayIso() && f.std > hhmm());
const awbKey = (a: Awb) => a.prefix + a.serial;
const SHELL = "mx-auto w-full max-w-[1040px] px-4";

const BK: Record<BookingStatus, [Tone, string, string]> = { requested: ["warn", "ລໍຖ້າການຢືນຢັນ", "Waiting for confirmation"], confirmed: ["ok", "ຢືນຢັນແລ້ວ", "Confirmed"], waitlisted: ["info", "ຢູ່ໃນລາຍການລໍຖ້າ", "On the waitlist"], rejected: ["bad", "ບໍ່ສາມາດຮັບໄດ້", "Not accepted"], cancelled: ["neutral", "ຍົກເລີກແລ້ວ", "Cancelled"], converted: ["ok", "ອອກ AWB ແລ້ວ", "AWB issued"] };

/** Example numbers across the journey, so anyone can try tracking. */
function sampleAwbs(d: Db) {
  const live = d.awbs.filter((a) => a.status === "active");
  const list: Awb[] = [];
  for (const test of [(a: Awb) => a.direction === "export" && a.stage === "RCS", (a: Awb) => a.direction === "export" && a.stage === "MAN", (a: Awb) => a.direction === "export" && a.stage === "ARR", (a: Awb) => a.direction === "import" && a.stage === "NFD", (a: Awb) => a.stage === "DLV"]) { const a = live.find(test); if (a) list.push(a); }
  return list;
}

function Samples({ light }: { light?: boolean }) {
  const d = useDb(); const t = useT();
  return <div className={cx("mt-3 text-sm", light ? "text-navy-text" : "text-ink-2")}>
    <span className="mb-1.5 block">{t("ລອງກົດເລກຕົວຢ່າງ:", "Try an example number:")}</span>
    <ul className="flex flex-wrap gap-2">{sampleAwbs(d).map((a) => <li key={a.id}><Link to={`/portal/track/${awbKey(a)}`} className={cx("block rounded border px-2.5 py-1 leading-5", light ? "border-white/30 text-white hover:bg-white/10" : "border-line-strong bg-surface hover:bg-brand-soft")}><span className="block font-mono text-[13px] font-semibold">{a.no}</span><span className={cx("block text-xs", light ? "text-navy-text" : "text-ink-2")}>{stageName(t, a.stage)}</span></Link></li>)}</ul>
  </div>;
}

function TrackBox({ initial = "", light }: { initial?: string; light?: boolean }) {
  const t = useT(); const nav = useNavigate(); const [q, setQ] = useState(initial);
  useEffect(() => setQ(initial), [initial]);
  function go(e: FormEvent) { e.preventDefault(); const s = q.replace(/[\s-]/g, ""); if (s) nav(`/portal/track/${s}`); }
  return <form onSubmit={go} className="flex flex-col gap-2 sm:flex-row">
    <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="numeric" autoComplete="off" aria-label={t("ເລກ AWB", "AWB number")} placeholder={t("ປ້ອນເລກ AWB ເຊັ່ນ 627-4410 0012", "Enter an AWB number, like 627-4410 0012")} className={cx("h-12 w-full min-w-0 shrink-0 sm:w-auto sm:flex-1 sm:shrink rounded border bg-white px-3 font-mono text-base text-ink placeholder:font-sans placeholder:text-sm placeholder:text-ink-3 focus:outline-none focus:ring-2", light ? "border-transparent focus:ring-white/60" : "border-line-strong focus:border-brand focus:ring-brand/20")} />
    <Button type="submit" variant="primary" size="lg" icon={Search} className={cx("h-12", light && "border-white/30")}>{t("ຕິດຕາມ", "Track")}</Button>
  </form>;
}

function Header({ user, onSignOut }: { user?: Customer; onSignOut: () => void }) {
  const t = useT(); const lang = useLang();
  const link = ({ isActive }: { isActive: boolean }) => cx("whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium", isActive ? "border-white text-white" : "border-transparent text-navy-text hover:text-white");
  return <header className="bg-navy text-white">
    <div className={cx(SHELL, "flex h-[68px] items-center justify-between gap-3")}>
      <Link to="/portal" aria-label="Lao Airlines"><img src="./logo.png" alt="Lao Airlines" width={119} height={50} className="h-[50px] w-auto" /></Link>
      <div className="flex items-center gap-2">
        {user ? <span className="flex items-center gap-1.5"><Link to="/portal/account" className="hidden max-w-[220px] truncate text-sm text-navy-text hover:text-white sm:block">{t(user.name, user.nameEn)}</Link><button onClick={onSignOut} aria-label={t("ອອກຈາກລະບົບ", "Sign out")} title={t("ອອກຈາກລະບົບ", "Sign out")} className="grid h-9 w-9 place-items-center rounded text-navy-text hover:bg-white/10 hover:text-white"><LogOut size={17} aria-hidden /></button></span> : <Link to="/portal/account" className="inline-flex h-9 items-center gap-1.5 rounded px-2 text-sm font-medium text-navy-text hover:bg-white/10 hover:text-white"><CircleUser size={17} aria-hidden />{t("ເຂົ້າສູ່ລະບົບ", "Sign in")}</Link>}
        <div role="group" aria-label={t("ພາສາ", "Language")} className="flex h-9 overflow-hidden rounded border border-white/25 text-sm">{(["lo", "en"] as const).map((l) => <button key={l} onClick={() => setSession({ lang: l })} aria-pressed={lang === l} className={cx("px-2.5", lang === l ? "bg-white font-medium text-navy" : "text-navy-text hover:text-white")}>{l === "lo" ? "ລາວ" : "EN"}</button>)}</div>
      </div>
    </div>
    <nav className="border-t border-white/10" aria-label={t("ເມນູ", "Menu")}><div className={cx(SHELL, "flex overflow-x-auto")}>
      <NavLink end to="/portal" className={link}>{t("ໜ້າຫຼັກ", "Home")}</NavLink>
      <NavLink to="/portal/flights" className={link}>{t("ຖ້ຽວບິນມື້ນີ້", "Today's flights")}</NavLink>
      <NavLink to="/portal/book" className={link}>{t("ຈອງພື້ນທີ່", "Book space")}</NavLink>
      <NavLink to="/portal/account" className={link}>{t("ບັນຊີຂອງຂ້ອຍ", "Account")}</NavLink>
    </div></nav>
  </header>;
}

function Footer() {
  const d = useDb(); const t = useT(); const hub = d.stations.find((s) => s.isHub);
  return <footer className="mt-10 bg-navy text-navy-text"><div className={cx(SHELL, "flex flex-wrap items-start justify-between gap-x-10 gap-y-4 py-6 text-sm")}>
    <div><div className="font-medium text-white">{t("ພະແນກຂົນສົ່ງສິນຄ້າ ການບິນລາວ", "Lao Airlines Cargo Department")}</div><div>{t("ສະໜາມບິນສາກົນວັດໄຕ, ນະຄອນຫຼວງວຽງຈັນ", "Wattay International Airport, Vientiane")}</div><div className="tnum">{hub?.phone}</div></div>
    <div className="sm:text-right"><Link to="/login" className="font-medium text-white hover:underline">{t("ເຂົ້າສູ່ລະບົບພະນັກງານ", "Staff login")}</Link><div className="mt-1 max-w-[320px] text-xs text-[#9db4ca]">{t("ຕົ້ນແບບເພື່ອການພິຈາລະນາ. ຂໍ້ມູນທັງໝົດເປັນຂໍ້ມູນຈໍາລອງ.", "Prototype for review. All data is synthetic.")}</div></div>
  </div></footer>;
}

function flightState(f: Flight): [Tone, string, string] {
  const m: Record<FlightStatus, [Tone, string, string]> = { open: ["info", "ເປີດຮັບສິນຄ້າ", "Accepting cargo"], closed: ["warn", "ປິດຮັບສິນຄ້າ", "Closed for cargo"], departed: ["neutral", "ອອກບິນແລ້ວ", "Departed"], arrived: ["ok", "ມາຮອດແລ້ວ", "Arrived"], cancelled: ["bad", "ຍົກເລີກ", "Cancelled"] };
  if (f.status === "open" && !isFuture(f)) return ["info", "ກໍາລັງດໍາເນີນການ", "In progress"];
  return m[f.status];
}

function FlightRows({ list, station, mode, limit }: { list: Flight[]; station: string; mode: "dep" | "arr"; limit?: number }) {
  const d = useDb(); const t = useT();
  const name = (c: string) => { const s = d.stations.find((x) => x.code === c); return s ? t(s.nameLo, s.nameEn) : c; };
  const shown = limit ? list.slice(0, limit) : list;
  if (!shown.length) return <Empty title={mode === "dep" ? t(`ມື້ນີ້ບໍ່ມີຖ້ຽວບິນອອກຈາກ ${name(station)}`, `No departures from ${name(station)} today`) : t(`ມື້ນີ້ບໍ່ມີຖ້ຽວບິນມາຮອດ ${name(station)}`, `No arrivals at ${name(station)} today`)}>{t("ລອງເລືອກສະຖານີອື່ນ.", "Try another station.")}</Empty>;
  return <ul className="divide-y divide-line">{shown.map((f) => { const [tone, lo, en] = flightState(f); const other = mode === "dep" ? f.dest : f.origin; const bookable = mode === "dep" && f.status === "open" && isFuture(f); return <li key={f.id} className="grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2.5 sm:px-4">
    <span className="font-mono text-lg font-semibold leading-6">{mode === "dep" ? f.std : f.sta}</span>
    <span className="min-w-0"><span className="block truncate font-medium">{name(other)} <span className="font-mono text-[13px] text-ink-2">{other}</span></span><span className="block font-mono text-xs text-ink-2">{f.no}</span></span>
    <span className="flex flex-col items-end gap-0.5"><Badge tone={tone} noIcon={tone === "neutral"}>{t(lo, en)}</Badge>{bookable && <Link to={`/portal/book?flight=${f.id}`} className="text-xs font-medium text-brand hover:underline">{t("ຈອງພື້ນທີ່", "Book space")}</Link>}</span>
  </li>; })}</ul>;
}
const byTime = (key: "std" | "sta") => (a: Flight, b: Flight) => a[key].localeCompare(b[key]);

function Home({ user }: { user?: Customer }) {
  const d = useDb(); const t = useT(); const today = todayIso();
  const list = d.flights.filter((f) => f.date === today && f.origin === "VTE").sort(byTime("std"));
  return <>
    <section className="bg-navy-2 text-white"><div className={cx(SHELL, "py-8 sm:py-12")}>
      <h1 className="text-2xl font-semibold leading-9 sm:text-3xl sm:leading-[46px]">{t("ສິນຄ້າຂອງທ່ານຢູ່ໃສ?", "Where is your cargo?")}</h1>
      <p className="mb-4 max-w-[60ch] text-navy-text">{t("ປ້ອນເລກ AWB ເພື່ອເບິ່ງແຕ່ລະຂັ້ນຕອນ ຕັ້ງແຕ່ຮັບສິນຄ້າຈົນຮອດມືຜູ້ຮັບ.", "Enter your AWB number to follow each step, from acceptance to delivery.")}</p>
      <TrackBox light />
      <Samples light />
    </div></section>
    <div className={cx(SHELL, "mt-6 grid items-start gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]")}>
      <section className="rounded-md border border-line bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5"><h2 className="text-base font-semibold">{t("ຖ້ຽວບິນອອກຈາກວຽງຈັນມື້ນີ້", "Departures from Vientiane today")}</h2><Link to="/portal/flights" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">{t("ທຸກສະຖານີ", "All stations")}<ArrowRight size={14} aria-hidden /></Link></div>
        <FlightRows list={list} station="VTE" mode="dep" limit={5} />
      </section>
      <section>
        <h2 className="text-lg font-semibold">{t("ຈອງພື້ນທີ່ຂົນສົ່ງສິນຄ້າ", "Book cargo space")}</h2>
        <p className="mt-1 text-sm text-ink-2">{t("ຕົວແທນ ແລະ ລູກຄ້າປະຈໍາ ເລືອກຖ້ຽວບິນ, ເບິ່ງພື້ນທີ່ຍັງເຫຼືອ ແລະ ສົ່ງຄໍາຂໍຈອງໄດ້ເອງ. ພະແນກຂົນສົ່ງສິນຄ້າຈະຢືນຢັນໃຫ້.", "Agents and regular customers pick a flight, see the space left and send a booking request. The Cargo Department confirms it.")}</p>
        <Link to="/portal/book" className="mt-3 inline-block"><Button variant="primary" icon={CalendarPlus}>{t("ຈອງພື້ນທີ່", "Book space")}</Button></Link>
        <h2 className="mt-6 text-lg font-semibold">{user ? t(user.name, user.nameEn) : t("ບັນຊີຂອງທ່ານ", "Your account")}</h2>
        <p className="mt-1 text-sm text-ink-2">{t("ເບິ່ງການຈອງ, ເຫດຜົນການຕັດສິນ ແລະ AWB ທັງໝົດໃນບ່ອນດຽວ.", "See your bookings, the reasons for each decision and all your AWBs in one place.")}</p>
        <Link to="/portal/account" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">{t("ໄປບັນຊີຂອງຂ້ອຍ", "Go to my account")}<ArrowRight size={14} aria-hidden /></Link>
      </section>
    </div>
  </>;
}

const CUSTOMER_EVENTS: StageCode[] = ["BKD", "RCS", "SCR", "MAN", "DEP", "ARR", "RCF", "NFD", "CUS", "DLV"];
function friendly(e: AwbEvent, t: (a: string, b: string) => string, st: (c: string) => string): { title: string; text: string } {
  const fl = e.flightNo ?? "";
  switch (e.code) {
    case "BKD": return { title: t("ຈອງພື້ນທີ່ແລ້ວ", "Space booked"), text: t("ເຮົາໄດ້ຮັບການຈອງຂອງທ່ານແລ້ວ.", "We have your booking.") };
    case "RCS": return { title: t("ຮັບສິນຄ້າແລ້ວ", "Cargo accepted"), text: t(`ສິນຄ້າຮອດເຄົາເຕີຮັບສິນຄ້າ ${st(e.station)} ແລ້ວ.`, `Your cargo reached the cargo counter at ${st(e.station)}.`) };
    case "SCR": return { title: t("ກວດຄວາມປອດໄພແລ້ວ", "Security check complete"), text: t("ສິນຄ້າຜ່ານການກວດຄວາມປອດໄພ.", "Your cargo passed the security check.") };
    case "MAN": return { title: t("ກໍານົດຖ້ຽວບິນແລ້ວ", "Assigned to a flight"), text: t(`ສິນຄ້າຈະເດີນທາງໂດຍຖ້ຽວບິນ ${fl}.`, `Your cargo will travel on flight ${fl}.`) };
    case "DEP": return { title: t("ອອກເດີນທາງແລ້ວ", "Departed"), text: t(`ຖ້ຽວບິນ ${fl} ອອກຈາກ ${st(e.station)} ແລ້ວ.`, `Flight ${fl} left ${st(e.station)}.`) };
    case "ARR": return { title: t("ມາຮອດແລ້ວ", "Arrived"), text: t(`ສິນຄ້າມາຮອດ ${st(e.station)} ແລ້ວ.`, `Your cargo arrived at ${st(e.station)}.`) };
    case "RCF": return { title: t("ເຂົ້າສາງແລ້ວ", "In the warehouse"), text: t(`ສິນຄ້າຖືກຮັບເຂົ້າສາງ ${st(e.station)}.`, `Your cargo is in the warehouse at ${st(e.station)}.`) };
    case "NFD": return { title: t("ແຈ້ງຜູ້ຮັບແລ້ວ", "Consignee notified"), text: t("ເຮົາໄດ້ແຈ້ງຜູ້ຮັບໃຫ້ມາຮັບສິນຄ້າ.", "We told the consignee the cargo is ready to collect.") };
    case "CUS": return { title: t("ຜ່ານພາສີແລ້ວ", "Customs cleared"), text: t("ສິນຄ້າຜ່ານພິທີການພາສີແລ້ວ.", "Customs clearance is complete.") };
    case "DLV": return { title: t("ມອບສິນຄ້າແລ້ວ", "Delivered"), text: t("ຜູ້ຮັບໄດ້ຮັບສິນຄ້າແລ້ວ.", "The consignee has collected the cargo.") };
    case "OFLD": return { title: t("ປ່ຽນຖ້ຽວບິນ", "Flight change"), text: t(`ສິນຄ້າບໍ່ໄດ້ໄປກັບຖ້ຽວ ${fl}. ເຮົາກໍາລັງຈັດຖ້ຽວຖັດໄປໃຫ້ ແລະ ແຈ້ງທ່ານແລ້ວ.`, `Your cargo did not go on flight ${fl}. We are arranging the next flight and have let you know.`) };
    case "RBK": return { title: t("ຈັດຖ້ຽວບິນໃໝ່ແລ້ວ", "New flight arranged"), text: t(`ຖ້ຽວບິນໃໝ່ຂອງສິນຄ້າ: ${fl}.`, `Your cargo's new flight: ${fl}.`) };
    case "TFD": return { title: t("ຖ່າຍລໍາ", "Transfer"), text: t(`ສິນຄ້າຖືກສົ່ງຕໍ່ໄປຖ້ຽວ ${fl}.`, `Your cargo was transferred to flight ${fl}.`) };
    default: return { title: e.code, text: "" };
  }
}
const SHOWN = new Set<string>([...CUSTOMER_EVENTS, "OFLD", "RBK", "TFD"]);

function Track() {
  const { no = "" } = useParams(); const d = useDb(); const t = useT(); const lang = useLang();
  const a = portalLookup(d, no);
  const stName = (c: string) => { const s = d.stations.find((x) => x.code === c); return s ? t(s.nameLo, s.nameEn) : c; };
  if (!a) return <div className={cx(SHELL, "py-6")}>
    <h1 className="mb-3 text-xl font-semibold">{t("ຕິດຕາມສິນຄ້າ", "Track your cargo")}</h1>
    <TrackBox initial={no} />
    <div className="mt-4"><Callout tone="warn" title={t(`ບໍ່ພົບ AWB ເລກ ${no}`, `We couldn't find AWB ${no}`)}>{t("ກວດເລກ 11 ຫຼັກໃນໃບ AWB ແລ້ວລອງໃໝ່ ຫຼື ໂທຫາພະແນກຂົນສົ່ງສິນຄ້າ.", "Check the 11-digit number on your AWB and try again, or call the Cargo Department.")}</Callout></div>
    <Samples />
  </div>;
  const seen = [...a.events].filter((e) => SHOWN.has(e.code)).reverse().filter((e, i, arr) => i === 0 || arr[i - 1].code !== e.code);
  const flight = d.flights.find((f) => f.id === a.flightId); const flightNo = flight?.no ?? [...a.events].reverse().find((e) => e.flightNo)?.flightNo;
  const station = d.stations.find((s) => s.code === a.dest);
  const ready = ["ARR", "RCF", "NFD", "CUS"].includes(a.stage) && a.deliveredPieces < a.pieces;
  const moved = a.events.some((e) => e.code === "OFLD") && ["SCR", "MAN"].includes(a.stage);
  return <div className={cx(SHELL, "py-6")}>
    <div className="mb-4"><TrackBox initial="" /></div>
    <div className="mb-4 rounded-md border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1"><div><div className="box-label">{t("ເລກ AWB", "AWB number")}</div><h1 className="font-mono text-xl font-semibold">{a.no}</h1></div><div className="text-right"><div className="box-label">{t("ສະຖານະລ່າສຸດ", "Latest status")}</div><div className="text-lg font-semibold text-brand">{stageName(t, a.stage)}</div></div></div>
      <div className="mt-3 flex items-center gap-2 text-base"><span className="font-medium">{stName(a.origin)}</span><Route from={a.origin} to={a.dest} /><span className="font-medium">{stName(a.dest)}</span></div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div><dt className="box-label">{t("ຈໍານວນກ່ອງ", "Pieces")}</dt><dd className="tnum">{a.pieces}</dd></div>
        <div><dt className="box-label">{t("ນໍ້າໜັກ", "Weight")}</dt><dd className="tnum">{kg(a.grossKg)}</dd></div>
        <div><dt className="box-label">{t("ຖ້ຽວບິນ", "Flight")}</dt><dd className="font-mono text-[13px]">{flightNo ?? t("ກໍາລັງຈັດ", "Being arranged")}</dd></div>
        <div><dt className="box-label">{t("ກໍານົດມາຮອດ", "Scheduled arrival")}</dt><dd className="tnum">{flight ? `${fmtDate(flight.date)} ${flight.sta}` : "—"}</dd></div>
      </dl>
    </div>
    {moved && <div className="mb-4"><Callout tone="warn" title={t("ຖ້ຽວບິນຂອງສິນຄ້າປ່ຽນແປງ", "Your cargo's flight changed")}>{t("ຂໍອະໄພໃນຄວາມບໍ່ສະດວກ. ເຮົາໄດ້ແຈ້ງຜູ້ຕິດຕໍ່ຂອງທ່ານແລ້ວ.", "We're sorry for the inconvenience. Your contact person has been told.")}</Callout></div>}
    {ready && <div className="mb-4"><Callout tone="ok" title={t(`ສິນຄ້າພ້ອມໃຫ້ຮັບທີ່ ${stName(a.dest)}`, `Ready to collect at ${stName(a.dest)}`)}>{t(`ນໍາບັດປະຈໍາຕົວ ແລະ ເລກ AWB ມາທີ່ສາງສິນຄ້າ. ຮັບພາຍໃນມື້ທີ່ມາຮອດ ບໍ່ເສຍຄ່າຝາກສາງ. ໂທ ${station?.phone ?? ""}`, `Bring your ID and AWB number to the cargo warehouse. Same-day pickup has no storage fee. Call ${station?.phone ?? ""}`)}</Callout></div>}
    <div className="mb-4 rounded-md border border-line bg-surface p-3"><AwbStrip awb={a} size="lg" /></div>
    <section className="rounded-md border border-line bg-surface">
      <h2 className="border-b border-line px-4 py-2.5 text-base font-semibold">{t("ເສັ້ນທາງຂອງສິນຄ້າ", "Your cargo's journey")}</h2>
      <ol className="px-4 py-3">{seen.map((e, i) => { const x = friendly(e, t, stName); return <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
        {i < seen.length - 1 && <span aria-hidden className="absolute left-[9px] top-5 bottom-0 w-px bg-line-strong" />}
        <span aria-hidden className={cx("mt-0.5 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full", i === 0 ? "bg-brand text-white" : "bg-brand-soft text-brand")}><CheckCircle2 size={13} /></span>
        <div className="min-w-0"><div className={cx("font-medium", i === 0 && "text-brand")}>{x.title}</div>{x.text && <p className="text-sm text-ink-2">{x.text}</p>}<div className="tnum text-xs text-ink-3">{fmtDateTime(e.ts)}</div></div>
      </li>; })}</ol>
    </section>
    <p className="mt-3 text-xs text-ink-2">{t(`ສິນຄ້າ: ${part(a.commodity, lang)}. ຖ້າມີຄໍາຖາມ ໂທ ${d.stations.find((s) => s.isHub)?.phone ?? ""}.`, `Goods: ${part(a.commodity, lang)}. Questions? Call ${d.stations.find((s) => s.isHub)?.phone ?? ""}.`)}</p>
  </div>;
}

function Flights() {
  const d = useDb(); const t = useT(); const today = todayIso(); const [station, setStation] = useState("VTE"); const [mode, setMode] = useState<"dep" | "arr">("dep");
  const stations = d.stations.filter((s) => s.active);
  const list = d.flights.filter((f) => f.date === today && (mode === "dep" ? f.origin === station : f.dest === station)).sort(byTime(mode === "dep" ? "std" : "sta"));
  return <div className={cx(SHELL, "py-6")}>
    <h1 className="text-xl font-semibold">{t("ຖ້ຽວບິນມື້ນີ້", "Today's flights")}</h1>
    <p className="mb-3 text-sm text-ink-2 tnum">{fmtDate(today)}</p>
    <div className="mb-3 max-w-xs"><Field label={t("ສະຖານີ", "Station")}><Select value={station} onChange={(e) => setStation(e.target.value)} options={stations.map((s) => ({ value: s.code, label: `${s.code} · ${t(s.nameLo, s.nameEn)}` }))} /></Field></div>
    <section className="rounded-md border border-line bg-surface">
      <div role="tablist" className="flex border-b border-line">{([["dep", PlaneTakeoff, t("ຖ້ຽວອອກ", "Departures")], ["arr", PlaneLanding, t("ຖ້ຽວມາຮອດ", "Arrivals")]] as const).map(([k, I, label]) => <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={cx("-mb-px inline-flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium sm:flex-none", mode === k ? "border-brand text-brand" : "border-transparent text-ink-2 hover:text-ink")}><I size={16} aria-hidden />{label}</button>)}</div>
      <FlightRows list={list} station={station} mode={mode} />
    </section>
  </div>;
}

function SignIn({ onSignIn, heading, sub }: { onSignIn: (id: string) => void; heading: string; sub: string }) {
  const d = useDb(); const t = useT(); const users = d.customers.filter((c) => c.portalUser && c.active);
  return <div className="mx-auto w-full max-w-[520px] px-4 py-8">
    <h1 className="text-xl font-semibold">{heading}</h1><p className="mb-4 mt-1 text-sm text-ink-2">{sub}</p>
    {users.length === 0 ? <Callout tone="warn" title={t("ຍັງບໍ່ມີບັນຊີ Portal", "No portal accounts yet")}>{t("ພະນັກງານເປີດບັນຊີໃຫ້ໄດ້ໃນຂໍ້ມູນລູກຄ້າ.", "Staff can open one in the customer record.")}</Callout>
      : <ul className="divide-y divide-line rounded-md border border-line bg-surface">{users.map((c) => <li key={c.id}><button onClick={() => { onSignIn(c.id); toast(t(`ຍິນດີຕ້ອນຮັບ ${c.name}`, `Welcome, ${c.nameEn}`)); }} className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"><span className="min-w-0 flex-1"><span className="block font-medium">{t(c.name, c.nameEn)}</span><span className="block font-mono text-xs text-ink-2">{c.portalUser}</span></span><ArrowRight size={17} aria-hidden className="text-ink-3 group-hover:text-brand" /></button></li>)}</ul>}
    <p className="mt-3 text-xs text-ink-2">{t("ຕົ້ນແບບນີ້ເລືອກບັນຊີໄດ້ໂດຍບໍ່ຕ້ອງໃສ່ລະຫັດຜ່ານ.", "This prototype lets you pick an account without a password.")}</p>
  </div>;
}

function Book({ user, onSignIn }: { user?: Customer; onSignIn: (id: string) => void }) {
  const d = useDb(); const t = useT(); const [params] = useSearchParams(); const preset = d.flights.find((f) => f.id === params.get("flight"));
  const routes = d.routes.filter((r) => r.active); const origins = [...new Set(routes.map((r) => r.origin))];
  const startOrigin = preset?.origin ?? (user && origins.includes(user.station) ? user.station : "VTE");
  const [origin, setOrigin] = useState(startOrigin); const [dest, setDest] = useState(preset?.dest ?? ""); const [flightId, setFlight] = useState(preset?.id ?? "");
  const [pieces, setPieces] = useState(""); const [weight, setWeight] = useState(""); const [volume, setVolume] = useState(""); const [commodity, setCommodity] = useState(""); const [shc, setShc] = useState<string[]>([]); const [tried, setTried] = useState(false); const [done, setDone] = useState<Booking | null>(null);
  if (!user) return <SignIn onSignIn={onSignIn} heading={t("ເຂົ້າສູ່ລະບົບເພື່ອຈອງພື້ນທີ່", "Sign in to book cargo space")} sub={t("ເລືອກບັນຊີຕົວແທນ ຫຼື ລູກຄ້າຂອງທ່ານ.", "Choose your agent or customer account.")} />;
  const dests = routes.filter((r) => r.origin === origin).map((r) => r.dest);
  const stName = (c: string) => { const s = d.stations.find((x) => x.code === c); return s ? t(s.nameLo, s.nameEn) : c; };
  const flights = d.flights.filter((f) => f.origin === origin && f.dest === dest && f.status === "open" && isFuture(f)).sort((a, b) => `${a.date}${a.std}`.localeCompare(`${b.date}${b.std}`));
  const f = d.flights.find((x) => x.id === flightId); const cap = f ? flightCapacity(d, f.id) : null;
  const kgN = Number(weight) || 0; const m3N = Number(volume) || 0; const pcsN = Number(pieces) || 0;
  const errors = { flight: !f, pieces: pcsN < 1 || !Number.isInteger(pcsN), weight: kgN <= 0, volume: m3N <= 0, commodity: !commodity.trim() };
  function submit(e: FormEvent) {
    e.preventDefault(); setTried(true); if (Object.values(errors).some(Boolean) || !f || !user) return;
    const b = createBooking({ customerId: user.id, flightId: f.id, origin: f.origin, dest: f.dest, pieces: pcsN, weightKg: kgN, volumeM3: m3N, commodity: commodity.trim(), shc, channel: "portal" });
    setDone(b); window.scrollTo(0, 0);
  }
  if (done) { const nf = d.flights.find((x) => x.id === done.flightId); return <div className="mx-auto w-full max-w-[560px] px-4 py-8">
    <Callout tone="ok" title={t(`ສົ່ງຄໍາຂໍຈອງ ${done.no} ແລ້ວ`, `Booking request ${done.no} sent`)}>{t("ພະແນກຂົນສົ່ງສິນຄ້າຈະກວດພື້ນທີ່ ແລະ ຢືນຢັນ. ຕິດຕາມຜົນໄດ້ໃນບັນຊີຂອງທ່ານ.", "The Cargo Department will check the space and confirm. Follow the result in your account.")}</Callout>
    <dl className="mt-4 grid grid-cols-2 gap-3 rounded-md border border-line bg-surface p-4 text-sm"><div><dt className="box-label">{t("ຖ້ຽວບິນ", "Flight")}</dt><dd className="font-mono text-[13px]">{nf?.no} {fmtDate(nf?.date)} {nf?.std}</dd></div><div><dt className="box-label">{t("ເສັ້ນທາງ", "Route")}</dt><dd><Route from={done.origin} to={done.dest} /></dd></div><div><dt className="box-label">{t("ສິນຄ້າ", "Goods")}</dt><dd>{bi(t, done.commodity)} <ShcTags codes={done.shc} /></dd></div><div><dt className="box-label">{t("ກ່ອງ / ນໍ້າໜັກ", "Pieces / weight")}</dt><dd className="tnum">{done.pieces} · {kg(done.weightKg)}</dd></div></dl>
    <div className="mt-4 flex flex-wrap gap-2"><Link to="/portal/account"><Button variant="primary">{t("ເບິ່ງການຈອງຂອງຂ້ອຍ", "See my bookings")}</Button></Link><Button onClick={() => { setDone(null); setPieces(""); setWeight(""); setVolume(""); setCommodity(""); setShc([]); setTried(false); setFlight(""); }}>{t("ຈອງອີກຄັ້ງ", "Make another booking")}</Button></div>
  </div>; }
  return <form onSubmit={submit} className="mx-auto w-full max-w-[720px] px-4 py-6">
    <h1 className="text-xl font-semibold">{t("ຈອງພື້ນທີ່ຂົນສົ່ງສິນຄ້າ", "Book cargo space")}</h1>
    <p className="mb-4 text-sm text-ink-2">{t(`ຈອງໃນນາມ ${user.name}`, `Booking as ${user.nameEn}`)}</p>
    <section className="rounded-md border border-line bg-surface p-4">
      <h2 className="mb-3 text-base font-semibold">{t("1. ເສັ້ນທາງ ແລະ ຖ້ຽວບິນ", "1. Route and flight")}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("ຕົ້ນທາງ", "From")} required><Select value={origin} onChange={(e) => { setOrigin(e.target.value); setDest(""); setFlight(""); }} options={origins.map((c) => ({ value: c, label: `${c} ${stName(c)}` }))} /></Field>
        <Field label={t("ປາຍທາງ", "To")} required><Select value={dest} onChange={(e) => { setDest(e.target.value); setFlight(""); }} placeholder={t("ເລືອກປາຍທາງ", "Choose")} options={dests.map((c) => ({ value: c, label: `${c} ${stName(c)}` }))} /></Field>
      </div>
      {dest && <div className="mt-3" role="radiogroup" aria-label={t("ຖ້ຽວບິນ", "Flight")}>
        <span className="box-label mb-1 block">{t("ເລືອກຖ້ຽວບິນ", "Choose a flight")}</span>
        {flights.length === 0 ? <p className="text-sm text-ink-2">{t("ບໍ່ມີຖ້ຽວບິນເປີດຮັບໃນເສັ້ນທາງນີ້. ລອງເສັ້ນທາງອື່ນ ຫຼື ໂທຫາພະແນກຂົນສົ່ງສິນຄ້າ.", "No open flights on this route. Try another route or call the Cargo Department.")}</p>
          : <ul className="max-h-[320px] divide-y divide-line overflow-y-auto rounded border border-line">{flights.map((x) => { const c = flightCapacity(d, x.id); const sel = x.id === flightId; return <li key={x.id}><button type="button" role="radio" aria-checked={sel} onClick={() => setFlight(x.id)} className={cx("grid w-full grid-cols-[minmax(0,1fr)_120px] items-center gap-3 px-3 py-2 text-left", sel ? "bg-brand-soft" : "hover:bg-surface-2")}><span className="min-w-0"><span className={cx("block font-mono text-[13px] font-semibold", sel && "text-brand")}>{x.no}</span><span className="tnum block text-sm">{fmtDate(x.date)}</span><span className="tnum block text-xs text-ink-2">{x.std} → {x.sta}</span></span><span><span className="tnum mb-1 block text-right text-xs">{c.remainingKg > 0 ? t(`ເຫຼືອ ${num(c.remainingKg)} kg`, `${num(c.remainingKg)} kg left`) : t("ເຕັມ", "Full")}</span><BarMeter value={c.usedKg} max={c.maxKg} label={t("ພື້ນທີ່ໃຊ້", "Space used")} /></span></button></li>; })}</ul>}
        {tried && errors.flight && <p className="mt-1 text-xs text-bad">{t("ເລືອກຖ້ຽວບິນ", "Choose a flight")}</p>}
      </div>}
      {!dest && tried && <p className="mt-2 text-xs text-bad">{t("ເລືອກປາຍທາງ ແລະ ຖ້ຽວບິນ", "Choose a destination and a flight")}</p>}
    </section>
    <section className="mt-4 rounded-md border border-line bg-surface p-4">
      <h2 className="mb-3 text-base font-semibold">{t("2. ລາຍລະອຽດສິນຄ້າ", "2. Cargo details")}</h2>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t("ກ່ອງ", "Pieces")} required error={tried && errors.pieces ? t("ຢ່າງໜ້ອຍ 1", "At least 1") : undefined}><Input type="number" inputMode="numeric" min={1} value={pieces} onChange={(e) => setPieces(e.target.value)} /></Field>
        <Field label={t("ນໍ້າໜັກ (kg)", "Weight (kg)")} required error={tried && errors.weight ? t("ປ້ອນນໍ້າໜັກ", "Enter it") : undefined}><Input type="number" inputMode="decimal" min={0} step={0.5} value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
        <Field label={t("ບໍລິມາດ (m³)", "Volume (m³)")} required error={tried && errors.volume ? t("ປ້ອນບໍລິມາດ", "Enter it") : undefined}><Input type="number" inputMode="decimal" min={0} step={0.1} value={volume} onChange={(e) => setVolume(e.target.value)} /></Field>
      </div>
      <div className="mt-3"><Field label={t("ສິນຄ້າ", "Commodity")} required error={tried && errors.commodity ? t("ບອກປະເພດສິນຄ້າ", "Say what the goods are") : undefined}><Input value={commodity} onChange={(e) => setCommodity(e.target.value)} /></Field></div>
      <div className="mt-3"><span className="box-label mb-1 block">{t("ສິນຄ້າພິເສດ (ຖ້າມີ)", "Special cargo (if any)")}</span><div className="grid gap-1 sm:grid-cols-2">{SHC_LIST.map((s) => <Checkbox key={s.code} label={`${s.code} ${t(s.lo, s.en)}`} checked={shc.includes(s.code)} onChange={(v) => setShc((x) => (v ? [...x, s.code] : x.filter((c) => c !== s.code)))} />)}</div></div>
      {shc.length > 0 && <div className="mt-3"><Callout tone="warn" title={t("ສິນຄ້າພິເສດຕ້ອງໄດ້ຮັບການອະນຸມັດ", "Special cargo needs approval")}>{t("ພະແນກຂົນສົ່ງສິນຄ້າອາດຂໍເອກະສານເພີ່ມເຕີມກ່ອນຢືນຢັນ.", "The Cargo Department may ask for documents before confirming.")}</Callout></div>}
    </section>
    {cap && f && <section className="mt-4 rounded-md border border-line bg-surface p-4" aria-live="polite">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3"><h2 className="text-base font-semibold">{t(`ພື້ນທີ່ຍັງເຫຼືອໃນ ${f.no}`, `Space left on ${f.no}`)}</h2><span className="tnum font-semibold">{kg(Math.max(0, cap.remainingKg))}</span></div>
      <BarMeter value={cap.usedKg + kgN} max={cap.maxKg} label={t("ພື້ນທີ່ໃຊ້", "Space used")} />
      {kgN > cap.remainingKg ? <div className="mt-2"><Callout tone="warn" title={t("ນໍ້າໜັກເກີນພື້ນທີ່ຍັງເຫຼືອ", "This is more than the space left")}>{t("ທ່ານຍັງສົ່ງຄໍາຂໍໄດ້ ແຕ່ອາດຖືກໃສ່ໃນລາຍການລໍຖ້າ. ຫຼື ເລືອກຖ້ຽວບິນອື່ນ.", "You can still send the request, but it may be waitlisted. Or choose another flight.")}</Callout></div> : kgN > 0 && <p className="mt-2 text-sm text-ok">{t("ມີພື້ນທີ່ພໍໃນຕອນນີ້. ການຈອງຈະສົມບູນເມື່ອໄດ້ຮັບການຢືນຢັນ.", "There is enough space right now. The booking is final once confirmed.")}</p>}
      {m3N > cap.maxM3 && <div className="mt-2"><Callout tone="warn" title={t("ບໍລິມາດໃຫຍ່ເກີນ", "Volume is too large")}>{t(`ເຮືອບິນລໍານີ້ຮັບໄດ້ສູງສຸດ ${cap.maxM3} m³.`, `This aircraft takes ${cap.maxM3} m³ at most.`)}</Callout></div>}
    </section>}
    <div className="mt-4"><Button type="submit" variant="primary" size="lg" icon={CalendarPlus} className="w-full sm:w-auto">{t("ສົ່ງຄໍາຂໍຈອງ", "Send booking request")}</Button></div>
  </form>;
}

function Account({ user, onSignIn }: { user?: Customer; onSignIn: (id: string) => void }) {
  const d = useDb(); const t = useT(); const lang = useLang(); const [tab, setTab] = useState<"bookings" | "awbs">("bookings");
  if (!user) return <SignIn onSignIn={onSignIn} heading={t("ເຂົ້າສູ່ບັນຊີຂອງທ່ານ", "Sign in to your account")} sub={t("ເລືອກບັນຊີຕົວແທນ ຫຼື ລູກຄ້າຂອງທ່ານ.", "Choose your agent or customer account.")} />;
  const h = customerHistory(d, user.id); const bookings = [...h.bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); const awbs = h.awbs.filter((a) => a.status !== "voided").sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  function cancel(b: Booking) { updateBooking(b.id, { status: "cancelled", reason: "ລູກຄ້າຂໍຍົກເລີກທາງ Portal / Cancelled by the customer on the portal", decidedBy: undefined, decidedAt: nowIso() }); toast(t(`ຍົກເລີກ ${b.no} ແລ້ວ`, `${b.no} cancelled`)); }
  return <div className={cx(SHELL, "py-6")}>
    <h1 className="text-xl font-semibold">{t(user.name, user.nameEn)}</h1>
    <p className="mb-4 text-sm text-ink-2"><span className="font-mono">{user.portalUser}</span> · {user.contact} · <span className="tnum">{user.phone}</span></p>
    <section className="mb-4 rounded-md border border-line bg-surface p-4"><h2 className="mb-2 text-base font-semibold">{t("ຄົ້ນຫາ AWB", "AWB lookup")}</h2><TrackBox /></section>
    <Tabs value={tab} onChange={setTab} tabs={[{ key: "bookings", label: t("ການຈອງ", "Bookings"), count: bookings.length }, { key: "awbs", label: "AWB", count: awbs.length }]} />
    {tab === "bookings" && <section className="rounded-md border border-line bg-surface">
      {bookings.length === 0 ? <Empty title={t("ຍັງບໍ່ມີການຈອງ", "No bookings yet")} action={<Link to="/portal/book"><Button icon={CalendarPlus}>{t("ຈອງພື້ນທີ່", "Book space")}</Button></Link>}>{t("ຄໍາຂໍຈອງຂອງທ່ານຈະສະແດງຢູ່ນີ້ພ້ອມສະຖານະ.", "Your booking requests appear here with their status.")}</Empty>
        : <ul className="divide-y divide-line">{bookings.map((b) => { const f = d.flights.find((x) => x.id === b.flightId); const a = d.awbs.find((x) => x.id === b.awbId); const [tone, lo, en] = BK[b.status]; return <li key={b.id} className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-[13px] font-semibold">{b.no}</span><Badge tone={tone}>{t(lo, en)}</Badge></div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm"><Route from={b.origin} to={b.dest} /><span className="font-mono text-[13px]">{f?.no} {fmtDate(f?.date)} {f?.std}</span><span className="tnum">{b.pieces} {t("ກ່ອງ", "pcs")} · {kg(b.weightKg)} · {b.volumeM3} m³</span></div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-2">{part(b.commodity, lang)}<ShcTags codes={b.shc} /></div>
          {b.reason && <p className="mt-1 text-sm"><span className="text-ink-2">{t("ເຫດຜົນ:", "Reason:")}</span> {part(b.reason, lang)}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm">{a && <Link to={`/portal/track/${awbKey(a)}`} className="font-medium text-brand hover:underline">{t(`ຕິດຕາມ AWB ${a.no}`, `Track AWB ${a.no}`)}</Link>}{b.status === "requested" && <button className="font-medium text-bad hover:underline" onClick={() => cancel(b)}>{t("ຍົກເລີກຄໍາຂໍ", "Cancel request")}</button>}</div>
        </li>; })}</ul>}
    </section>}
    {tab === "awbs" && <section className="rounded-md border border-line bg-surface">
      {awbs.length === 0 ? <Empty icon={Package} title={t("ຍັງບໍ່ມີ AWB", "No AWBs yet")}>{t("AWB ຂອງທ່ານຈະສະແດງຢູ່ນີ້ ເມື່ອອອກທີ່ເຄົາເຕີແລ້ວ.", "Your AWBs appear here once issued at the counter.")}</Empty>
        : <ul className="divide-y divide-line">{awbs.slice(0, 30).map((a) => <li key={a.id}><Link to={`/portal/track/${awbKey(a)}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-surface-2"><span className="min-w-0"><span className="block font-mono text-[13px] font-semibold text-brand">{a.no}</span><span className="block text-xs text-ink-2">{part(a.commodity, lang)} · {a.pieces} {t("ກ່ອງ", "pcs")} · {kg(a.grossKg)}</span></span><span className="flex items-center gap-3"><Route from={a.origin} to={a.dest} /><span className="text-sm font-medium">{a.stage in STAGE_NAMES ? stageName(t, a.stage) : a.stage}</span></span></Link></li>)}</ul>}
    </section>}
  </div>;
}

export default function Portal() {
  const d = useDb(); const lang = useLang(); const loc = useLocation(); const [userId, setUserId] = useState(readUser);
  const user = d.customers.find((c) => c.id === userId && c.portalUser && c.active);
  useEffect(() => { document.documentElement.lang = lang === "lo" ? "lo" : "en"; }, [lang]);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  const signIn = (id: string) => { writeUser(id); setUserId(id); };
  const signOut = () => { writeUser(""); setUserId(""); };
  return <div className="flex min-h-screen flex-col bg-page">
    <Header user={user} onSignOut={signOut} />
    <main className="flex-1">
      <Routes>
        <RouterRoute index element={<Home user={user} />} />
        <RouterRoute path="track/:no" element={<Track />} />
        <RouterRoute path="flights" element={<Flights />} />
        <RouterRoute path="book" element={<Book key={user?.id ?? "guest"} user={user} onSignIn={signIn} />} />
        <RouterRoute path="account" element={<Account user={user} onSignIn={signIn} />} />
        <RouterRoute path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    </main>
    <Footer />
    <Toaster />
  </div>;
}
