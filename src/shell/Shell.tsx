import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, ChevronRight, LogOut, Menu, RotateCcw, Search, X } from "lucide-react";
import { can, currentUser, getDb, resetDemo, roleOf, setSession, useDb } from "@/lib/store";
import { useLang, useName, useT } from "@/lib/i18n";
import { cx, Button, Confirm, toast, Toaster } from "@/ui/kit";
import { pendingCharges } from "@/lib/mock/finance";
import { daysBetween, todayIso } from "@/lib/format";
import { CHANNELS, NAV, TOP, type NavGroup, type NavItem } from "./nav";

export function useBadges() {
  const d = useDb(); const st = d.session.station;
  return useMemo(() => ({
    bookings: d.bookings.filter((b) => b.status === "requested").length,
    screening: d.awbs.filter((a) => a.status === "active" && a.direction === "export" && a.origin === st && a.stage === "RCS").length,
    approvals: d.rates.filter((r) => r.status === "pending").length + d.tariffs.filter((r) => r.status === "pending").length,
    aging: d.awbs.filter((a) => a.direction === "import" && a.status === "active" && a.dest === st && a.stage !== "DLV" && a.arrivedAt && daysBetween(a.arrivedAt, todayIso()) > 85).length,
    cashier: pendingCharges(d, st).length,
    irregular: d.irregularities.filter((r) => r.status !== "closed").length,
    notes: d.notifications.filter((n) => n.status === "staff_note").length,
  }), [d, st]);
}

type Badges = ReturnType<typeof useBadges>;
const inItem = (path: string, i: NavItem) => (i.to === "/" ? path === "/" : path === i.to || path.startsWith(`${i.to}/`));
const Count = ({ n }: { n: number }) => <span className="tnum min-w-[22px] shrink-0 rounded-full bg-white/15 px-1.5 text-center text-xs font-medium leading-[22px] text-white">{n}</span>;

function FlatLink({ item, badges }: { item: NavItem; badges: Badges }) {
  const t = useT(); const c = item.badge ? badges[item.badge] : 0;
  return <NavLink to={item.to} end={item.to === "/"} className={({ isActive }) => cx("flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-[15px] leading-6 transition-colors", isActive ? "bg-white font-semibold text-navy" : "text-white hover:bg-navy-2")}>
    <item.icon size={20} aria-hidden className="shrink-0" /><span className="min-w-0 flex-1">{t(item.lo, item.en)}</span>{c > 0 && <Count n={c} />}
  </NavLink>;
}

function Group({ group, items, expanded, onToggle, badges, path }: { group: NavGroup; items: NavItem[]; expanded: boolean; onToggle: () => void; badges: Badges; path: string }) {
  const t = useT(); const total = items.reduce((s, i) => s + (i.badge ? badges[i.badge] : 0), 0);
  const holdsCurrent = items.some((i) => inItem(path, i)); const panel = `nav-${group.id}`;
  return <li>
    <button type="button" aria-expanded={expanded} aria-controls={panel} onClick={onToggle} className={cx("flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[15px] leading-6 text-white transition-colors hover:bg-navy-2", holdsCurrent && "font-semibold")}>
      <group.icon size={20} aria-hidden className="shrink-0" /><span className="min-w-0 flex-1">{t(group.lo, group.en)}</span>
      {!expanded && total > 0 && <Count n={total} />}
      <ChevronRight size={16} aria-hidden className={cx("shrink-0 text-navy-text transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-90")} />
    </button>
    <div id={panel} className={cx("grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none", expanded ? "grid-rows-[1fr]" : "invisible grid-rows-[0fr]")}>
      <ul className="min-h-0 overflow-hidden">{items.map((i) => { const c = i.badge ? badges[i.badge] : 0; return <li key={i.to} className="mt-0.5 first:mt-1 last:mb-1">
        <NavLink to={i.to} end className={({ isActive }) => cx("flex min-h-10 items-center gap-2 rounded-md py-1.5 pl-[44px] pr-3 text-[14.5px] leading-6 transition-colors", isActive || inItem(path, i) ? "bg-white font-semibold text-navy" : "text-navy-text hover:bg-navy-2 hover:text-white")}>
          {({ isActive }) => <><span className="min-w-0 flex-1">{t(i.lo, i.en)}</span>{c > 0 && (isActive || inItem(path, i) ? <span className="tnum min-w-[22px] shrink-0 rounded-full bg-navy px-1.5 text-center text-xs font-medium leading-[22px] text-white">{c}</span> : <Count n={c} />)}</>}
        </NavLink></li>; })}</ul>
    </div>
  </li>;
}

function Sidebar({ open, onClose, badges }: { open: boolean; onClose: () => void; badges: Badges }) {
  const d = useDb(); const t = useT(); const path = useLocation().pathname;
  const allowed = (i: NavItem) => !i.perm || can(i.perm, d);
  const groups = NAV.map((g) => ({ g, items: g.items.filter(allowed) })).filter((x) => x.items.length);
  const current = groups.find((x) => x.items.some((i) => inItem(path, i)))?.g.id ?? null;
  // One group open at a time keeps every section in view without scrolling.
  const [expanded, setExpanded] = useState<string | null>(current);
  useEffect(() => { if (current) setExpanded(current); }, [current]);
  // Bring the current page, or a group just opened, into view once the group has finished opening.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => { const id = setTimeout(() => { const n = navRef.current; if (!n) return; const el = n.querySelector('[aria-current="page"]') ?? (expanded ? n.querySelector(`#nav-${expanded}`) : null); el?.scrollIntoView({ block: "nearest" }); }, 220); return () => clearTimeout(id); }, [path, expanded]);
  return <aside className={cx("no-print fixed inset-y-0 left-0 z-40 flex w-[272px] max-w-[85vw] flex-col bg-navy text-navy-text transition-transform lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
    <div className="flex h-[84px] shrink-0 items-center justify-between px-5"><Link to="/" aria-label="Lao Airlines"><img src="./logo.png" alt="Lao Airlines" width={160} height={67} /></Link><button className="flex size-10 items-center justify-center lg:hidden" aria-label={t("ປິດເມນູ", "Close menu")} onClick={onClose}><X size={20} /></button></div>
    <nav ref={navRef} aria-label={t("ເມນູຫຼັກ", "Main menu")} className="nav-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3">
      <ul className="space-y-0.5">{TOP.filter(allowed).map((i) => <li key={i.to}><FlatLink item={i} badges={badges} /></li>)}</ul>
      <div className="my-2.5 border-t border-white/10" />
      <ul className="space-y-0.5">{groups.map(({ g, items }) => <Group key={g.id} group={g} items={items} path={path} badges={badges} expanded={expanded === g.id} onToggle={() => setExpanded((x) => (x === g.id ? null : g.id))} />)}</ul>
    </nav>
    <div className="shrink-0 border-t border-white/10 px-3 py-2.5">
      <ul className="space-y-0.5">{CHANNELS.map((i) => <li key={i.to}><Link to={i.to} className="flex min-h-10 items-center gap-3 rounded-md px-3 py-1.5 text-[14.5px] leading-6 text-navy-text transition-colors hover:bg-navy-2 hover:text-white"><i.icon size={18} aria-hidden className="shrink-0" />{t(i.lo, i.en)}</Link></li>)}</ul>
      <p className="mt-2 px-3 text-xs leading-5 text-[#9db4ca]">{t("ຕົ້ນແບບໂດຍ Loopware · ຂໍ້ມູນຈໍາລອງ", "Prototype by Loopware · Synthetic data")}</p>
    </div>
  </aside>;
}

export function Shell() {
  const d = useDb(); const t = useT(); const name = useName(); const lang = useLang(); const nav = useNavigate(); const loc = useLocation();
  const user = currentUser(d); const role = roleOf(user, d); const [open, setOpen] = useState(false); const [menu, setMenu] = useState(false); const [q, setQ] = useState(""); const [askReset, setAskReset] = useState(false);
  const badges = useBadges();
  useEffect(() => { setOpen(false); setMenu(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => { if (!user) nav("/login", { replace: true }); }, [user, nav]);
  useEffect(() => { document.documentElement.lang = lang === "lo" ? "lo" : "en"; }, [lang]);
  if (!user) return null;
  function go(e: React.FormEvent) {
    e.preventDefault(); const s = q.replace(/[\s-]/g, ""); if (!s) return;
    const a = getDb().awbs.find((x) => (x.prefix + x.serial).includes(s) || x.serial.includes(s));
    if (a) { setQ(""); nav(`/export/awb/${a.id}`); } else toast(t(`ບໍ່ພົບ AWB ${q}. ກວດເລກອີກຄັ້ງ.`, `No AWB matches ${q}. Check the number.`), "warn");
  }
  const noteCount = badges.notes;
  return <div className="flex min-h-screen">
    {open && <button aria-label={t("ປິດເມນູ", "Close menu")} onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-navy/50 lg:hidden" />}
    <Sidebar open={open} onClose={() => setOpen(false)} badges={badges} />
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="no-print sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 lg:px-5">
        <button className="rounded p-1.5 lg:hidden" aria-label={t("ເປີດເມນູ", "Open menu")} onClick={() => setOpen(true)}><Menu size={20} /></button>
        <form onSubmit={go} className="relative max-w-[320px] flex-1"><Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden /><input value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("ຄົ້ນຫາ AWB", "Find AWB")} placeholder={t("ຄົ້ນຫາເລກ AWB ຫຼື ສະແກນ", "Find or scan an AWB number")} className="h-9 w-full rounded border border-line bg-surface-2 pl-8 pr-2 font-sans text-sm focus:border-brand focus:bg-surface focus:outline-none" /></form>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <label className="flex items-center gap-1.5 text-sm"><span className="hidden text-xs text-ink-2 xl:inline">{t("ສະຖານີ", "Station")}</span><select aria-label={t("ສະຖານີ", "Station")} value={d.session.station} onChange={(e) => setSession({ station: e.target.value })} className="h-9 rounded border border-line bg-surface px-1.5 font-mono text-[13px] font-semibold">{d.stations.filter((s) => s.active).map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}</select></label>
          <div role="group" aria-label={t("ພາສາ", "Language")} className="flex h-9 overflow-hidden rounded border border-line text-sm">{(["lo", "en"] as const).map((l) => <button key={l} onClick={() => setSession({ lang: l })} aria-pressed={lang === l} className={cx("px-2.5", lang === l ? "bg-brand text-white" : "bg-surface text-ink-2 hover:bg-surface-2")}>{l === "lo" ? "ລາວ" : "EN"}</button>)}</div>
          <Link to="/import/arrivals" aria-label={t("ວຽກທີ່ຕ້ອງໂທແຈ້ງລູກຄ້າ", "Customers staff must call")} className="relative grid h-9 w-9 place-items-center rounded text-ink-2 hover:bg-brand-soft hover:text-brand"><Bell size={18} aria-hidden />{noteCount > 0 && <span className="tnum absolute right-0.5 top-0.5 min-w-4 rounded-sm bg-bad px-0.5 text-center text-[11px] leading-4 text-white">{noteCount}</span>}</Link>
          <div className="relative"><button onClick={() => setMenu((m) => !m)} aria-expanded={menu} className="flex h-9 items-center gap-1.5 rounded px-1.5 hover:bg-surface-2"><span className="hidden text-left leading-4 sm:block"><span className="block text-sm font-medium">{name(user)}</span><span className="block text-xs text-ink-2">{name(role)}</span></span><ChevronDown size={14} className="text-ink-3" aria-hidden /></button>
            {menu && <div className="absolute right-0 top-11 z-30 w-64 rounded-md border border-line bg-surface py-1 shadow-pop"><div className="border-b border-line px-3 py-2 text-xs text-ink-2 sm:hidden">{name(user)} · {name(role)}</div><button onClick={() => setAskReset(true)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"><RotateCcw size={15} aria-hidden />{t("ລ້າງຂໍ້ມູນຕົວຢ່າງຄືນໃໝ່", "Reset demonstration data")}</button><button onClick={() => { setSession({ userId: null }); nav("/login"); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"><LogOut size={15} aria-hidden />{t("ອອກຈາກລະບົບ / ປ່ຽນບົດບາດ", "Sign out / change role")}</button></div>}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 p-3 sm:p-5"><Suspense fallback={null}><Outlet /></Suspense></main>
    </div>
    <Confirm open={askReset} onClose={() => setAskReset(false)} title={t("ລ້າງຂໍ້ມູນຕົວຢ່າງ?", "Reset the demonstration data?")} body={t("ທຸກລາຍການທີ່ທ່ານສ້າງ ຫຼື ແກ້ໄຂໃນ Browser ນີ້ ຈະຖືກລຶບ ແລະ ກັບຄືນເປັນຂໍ້ມູນຕົວຢ່າງເດີມ.", "Everything you created or changed in this browser will be removed and the original sample data restored.")} confirmLabel={t("ລ້າງຂໍ້ມູນ", "Reset data")} danger onConfirm={() => { resetDemo(); toast(t("ກັບຄືນເປັນຂໍ້ມູນຕົວຢ່າງແລ້ວ", "Sample data restored")); }} />
    <Toaster />
  </div>;
}
