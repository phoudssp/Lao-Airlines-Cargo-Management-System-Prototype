import { useMemo, useState } from "react";
import { Calculator, Check, History, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useLang, useName, useT, type T } from "@/lib/i18n";
import { Badge, Button, Callout, Col, Confirm, DataTable, Dialog, Dl, Field, IconButton, Input, MonoCode, PageHeader, Panel, Select, Tabs, Textarea, toast } from "@/ui/kit";
import { ApprovalBadge, Route, SHC_LIST, ShcTags, userName } from "@/ui/cargo";
import type { Db, Scope, Tariff, TariffBasis, TariffCategory } from "@/lib/types";
import { dateAdd, fmtDate, money, num, todayIso } from "@/lib/format";
import { findFreightRate, isEffective, priceFreight, rateToLak, roundUpHalf, scopeOf } from "@/lib/pricing";
import { decideTariff, deleteTariff, submitTariff } from "@/lib/mock/master";

const CATS: { key: TariffCategory; lo: string; en: string; prefix: string }[] = [
  { key: "general", lo: "ສິນຄ້າທົ່ວໄປ", en: "General cargo", prefix: "GCR" },
  { key: "special", lo: "ສິນຄ້າພິເສດ", en: "Special cargo", prefix: "SCR" },
  { key: "service", lo: "ຄ່າບໍລິການ", en: "Services", prefix: "" },
  { key: "storage", lo: "ຄ່າຝາກສາງ", en: "Storage", prefix: "STO" },
  { key: "mail", lo: "ຖົງເມ", en: "Mail bags", prefix: "MAIL" },
];
const BASIS: Record<TariffBasis, [string, string]> = { per_kg: ["ຕໍ່ kg", "Per kg"], flat: ["ເໝົາຈ່າຍ", "Flat"], percent: ["ເປີເຊັນຂອງຄ່າຂົນສົ່ງ", "% of freight"], per_kg_day: ["ຕໍ່ kg ຕໍ່ວັນ", "Per kg per day"] };
const BASES_FOR: Record<TariffCategory, TariffBasis[]> = { general: ["per_kg"], special: ["per_kg"], service: ["per_kg", "flat", "percent"], storage: ["per_kg_day"], mail: ["per_kg"] };
const INTERNAL = "ຂໍ້ຕົກລົງພາຍໃນ / Internal"; const TACT = "IATA TACT";
const needsRoute = (c: TariffCategory) => c === "general" || c === "special";
const scopeName = (t: T, s: Scope) => (s === "domestic" ? t("ພາຍໃນ", "Domestic") : t("ຕ່າງປະເທດ", "International"));
const sourceName = (t: T, s: string) => { const [lo, en] = s.split(" / "); return en ? t(lo, en) : s; };
const rateText = (x: Tariff) => (x.basis === "percent" ? `${num(x.rate, x.rate % 1 ? 2 : 0)}%` : money(x.rate, x.currency));
const versionsOf = (d: Db, code: string) => d.tariffs.filter((x) => x.code === code).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
/** The version to represent a code in the list: in force today, otherwise the newest non-rejected one. */
const shownVersion = (d: Db, code: string) => { const v = versionsOf(d, code); return v.find((x) => isEffective(x, todayIso())) ?? v.find((x) => x.status !== "rejected") ?? v[0]; };
const inForceOf = (d: Db, code: string) => versionsOf(d, code).find((x) => isEffective(x, todayIso()));

function TariffStatus({ x }: { x: Tariff }) {
  const t = useT(); const today = todayIso();
  if (x.status !== "approved") return <ApprovalBadge status={x.status} />;
  if (x.effectiveFrom > today) return <Badge tone="info">{t("ລໍຖ້າມື້ເລີ່ມໃຊ້", "Scheduled")}</Badge>;
  if (x.effectiveTo && x.effectiveTo < today) return <Badge>{t("ໝົດອາຍຸ", "Expired")}</Badge>;
  return <Badge tone="ok">{t("ໃຊ້ຢູ່", "In force")}</Badge>;
}

const noteText = (t: (lo: string, en: string) => string, s?: string) => { const p = (s ?? "").split(" / "); return p.length === 2 ? t(p[0], p[1]) : s ?? ""; };

export default function Tariffs() {
  const d = useDb(); const t = useT(); const name = useName(); const lang = useLang(); const can = useCan();
  const approver = can("tariff.approve"); const editor = approver || can("master.manage");
  const [cat, setCat] = useState<TariffCategory>("general"); const [scope, setScope] = useState("");
  const [form, setForm] = useState<{ base?: Tariff } | null>(null); const [hist, setHist] = useState<string | null>(null); const [check, setCheck] = useState(false);
  const [accept, setAccept] = useState<Tariff | null>(null); const [reject, setReject] = useState<Tariff | null>(null); const [del, setDel] = useState<Tariff | null>(null);

  const mayDelete = (x: Tariff) => editor || (x.status === "pending" && x.requestedBy === d.session.userId);
  const pending = d.tariffs.filter((x) => x.status === "pending").sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const rows = useMemo(() => [...new Set(d.tariffs.filter((x) => x.category === cat).map((x) => x.code))].map((c) => shownVersion(d, c)).filter((x) => !scope || x.scope === scope), [d, cat, scope]);
  const count = (c: TariffCategory) => new Set(d.tariffs.filter((x) => x.category === c).map((x) => x.code)).size;
  const cols: Col<Tariff>[] = [
    { key: "code", header: t("ລະຫັດ", "Code"), mono: true, render: (x) => <span className="font-semibold">{x.code}</span>, sort: (x) => x.code },
    { key: "name", header: t("ຊື່", "Name"), render: (x) => { const waiting = d.tariffs.filter((y) => y.code === x.code && y.status === "pending" && y.id !== x.id).length; return <span className="inline-flex flex-wrap items-center gap-1.5">{name(x)}{x.shc && <ShcTags codes={[x.shc]} />}{waiting > 0 && <Badge tone="warn">{t(`ລໍຖ້າ ${waiting}`, `${waiting} waiting`)}</Badge>}</span>; }, sort: (x) => x.nameEn },
    { key: "scope", header: t("ຂອບເຂດ", "Scope"), render: (x) => scopeName(t, x.scope), sort: (x) => x.scope },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (x) => x.origin && x.dest ? <Route from={x.origin} to={x.dest} /> : <span className="text-ink-2">{t("ທຸກເສັ້ນທາງ", "All routes")}</span>, sort: (x) => `${x.origin ?? ""}${x.dest ?? ""}` },
    { key: "basis", header: t("ຫຼັກການຄິດ", "Basis"), render: (x) => <span className="whitespace-nowrap">{t(BASIS[x.basis][0], BASIS[x.basis][1])}{x.freeDays != null && <span className="block text-xs text-ink-2">{t(`ຟຣີ ${x.freeDays} ວັນ`, `${x.freeDays} free days`)}</span>}</span> },
    { key: "rate", header: t("ອັດຕາ", "Rate"), align: "right", render: (x) => <span className="whitespace-nowrap font-medium">{rateText(x)}</span>, sort: (x) => x.rate },
    { key: "min", header: t("ຂັ້ນຕໍ່າ", "Minimum"), align: "right", render: (x) => <span className="whitespace-nowrap">{x.minCharge ? money(x.minCharge, x.currency) : "—"}</span>, sort: (x) => x.minCharge },
    { key: "cur", header: t("ສະກຸນ", "Currency"), mono: true, render: (x) => x.currency, sort: (x) => x.currency },
    { key: "from", header: t("ເລີ່ມໃຊ້", "From"), render: (x) => <span className="tnum whitespace-nowrap">{fmtDate(x.effectiveFrom)}</span>, sort: (x) => x.effectiveFrom },
    { key: "to", header: t("ສິ້ນສຸດ", "To"), render: (x) => <span className="tnum whitespace-nowrap">{x.effectiveTo ? fmtDate(x.effectiveTo) : t("ບໍ່ກໍານົດ", "Open")}</span>, sort: (x) => x.effectiveTo ?? "9999" },
    { key: "src", header: t("ແຫຼ່ງອ້າງອີງ", "Source"), render: (x) => <span className="whitespace-nowrap">{sourceName(t, x.source)}</span>, sort: (x) => x.source },
    { key: "status", header: t("ສະຖານະ", "Status"), render: (x) => <TariffStatus x={x} />, sort: (x) => x.status },
    { key: "act", header: "", align: "right", render: (x) => <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <IconButton icon={History} label={t(`ປະຫວັດ ${x.code}`, `Version history of ${x.code}`)} onClick={() => setHist(x.code)} />
      {editor && <IconButton icon={Pencil} label={t(`ສະເໜີອັດຕາໃໝ່ຂອງ ${x.code}`, `Submit a new version of ${x.code}`)} onClick={() => setForm({ base: x })} />}
      {mayDelete(x) && <IconButton icon={Trash2} label={t(`ລຶບ ${x.code}`, `Delete ${x.code}`)} onClick={() => setDel(x)} />}
    </span> },
  ];
  const current = (x: Tariff) => { const c = inForceOf(d, x.code); return c && c.id !== x.id ? c : undefined; };
  const histRows = hist ? versionsOf(d, hist) : [];
  return <>
    <PageHeader title={t("ອັດຕາຄ່າບໍລິການ", "Tariffs and pricing")} subtitle={t("ທຸກການປ່ຽນແປງອັດຕາເປັນສະບັບໃໝ່ ທີ່ຕ້ອງຜ່ານການອະນຸມັດ ແລະ ມີວັນທີເລີ່ມໃຊ້. ສະບັບເກົ່າຍັງເກັບໄວ້ໃນປະຫວັດ.", "Every rate change is a new version that needs approval and an effective date. Earlier versions stay in the history.")} actions={<>
      <Button icon={Calculator} onClick={() => setCheck(true)}>{t("ກວດລາຄາ", "Price check")}</Button>
      {editor && <Button variant="primary" icon={Plus} onClick={() => setForm({})}>{t("ສະເໜີອັດຕາໃໝ່", "Submit new tariff")}</Button>}
    </>} />
    {!editor && <div className="mb-3"><Callout tone="info">{t("ທ່ານເບິ່ງໄດ້ຢ່າງດຽວ. ການສະເໜີອັດຕາຕ້ອງມີສິດຈັດການຂໍ້ມູນພື້ນຖານ ຫຼື ສິດອະນຸມັດອັດຕາ.", "You can view this list. Submitting a tariff needs the Manage master data or Approve tariffs permission.")}</Callout></div>}

    <Panel flush className="mb-4" title={<span className="inline-flex items-center gap-2">{t("ລໍຖ້າອະນຸມັດ", "Waiting for approval")}{pending.length > 0 && <Badge tone="warn">{pending.length}</Badge>}</span>}>
      {pending.length === 0 ? <p className="px-4 py-3 text-sm text-ink-2">{t("ບໍ່ມີອັດຕາທີ່ລໍຖ້າອະນຸມັດ.", "No tariffs are waiting for approval.")}</p> : <>
        {!approver && <div className="border-b border-line px-4 py-2 text-xs text-ink-2">{t("ອັດຕາເຫຼົ່ານີ້ຍັງບໍ່ມີຜົນ. ທ່ານບໍ່ມີສິດອະນຸມັດອັດຕາ.", "These rates have no effect yet. Your role cannot approve tariffs.")}</div>}
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-ink-2"><th className="px-3 py-2 font-semibold">{t("ລະຫັດ", "Code")}</th><th className="px-3 py-2 font-semibold">{t("ຊື່", "Name")}</th><th className="px-3 py-2 text-right font-semibold">{t("ອັດຕາປັດຈຸບັນ", "Current rate")}</th><th className="px-3 py-2 text-right font-semibold">{t("ອັດຕາໃໝ່", "New rate")}</th><th className="px-3 py-2 font-semibold">{t("ເລີ່ມໃຊ້", "From")}</th><th className="px-3 py-2 font-semibold">{t("ແຫຼ່ງອ້າງອີງ", "Source")}</th><th className="px-3 py-2 font-semibold">{t("ຜູ້ສະເໜີ", "Submitted by")}</th><th className="px-3 py-2" /></tr></thead>
          <tbody>{pending.map((x) => { const c = current(x); return <tr key={x.id} className="border-b border-line last:border-0">
            <td className="px-3 py-2"><MonoCode className="font-semibold">{x.code}</MonoCode></td>
            <td className="px-3 py-2">{name(x)}{x.note && <span className="block text-xs text-ink-2">{noteText(t, x.note)}</span>}</td>
            <td className="tnum whitespace-nowrap px-3 py-2 text-right text-ink-2">{c ? rateText(c) : t("ອັດຕາໃໝ່", "New")}</td>
            <td className="tnum whitespace-nowrap px-3 py-2 text-right font-medium">{rateText(x)}{x.minCharge > 0 && <span className="block text-xs font-normal text-ink-2">{t("ຂັ້ນຕໍ່າ", "Min")} {money(x.minCharge, x.currency)}</span>}</td>
            <td className="tnum whitespace-nowrap px-3 py-2">{fmtDate(x.effectiveFrom)}</td>
            <td className="whitespace-nowrap px-3 py-2">{sourceName(t, x.source)}</td>
            <td className="whitespace-nowrap px-3 py-2">{userName(d, x.requestedBy, lang)}</td>
            <td className="px-3 py-2"><span className="flex justify-end gap-1.5">
              {approver ? <><Button size="sm" variant="success" icon={Check} onClick={() => setAccept(x)}>{t("ອະນຸມັດ", "Approve")}</Button><Button size="sm" variant="danger" icon={X} onClick={() => setReject(x)}>{t("ບໍ່ອະນຸມັດ", "Reject")}</Button></> : <ApprovalBadge status="pending" />}
              {mayDelete(x) && <IconButton icon={Trash2} label={t(`ລຶບ ${x.code}`, `Delete ${x.code}`)} onClick={() => setDel(x)} />}
            </span></td>
          </tr>; })}</tbody></table></div>
      </>}
    </Panel>

    <Tabs value={cat} onChange={setCat} tabs={CATS.map((c) => ({ key: c.key, label: t(c.lo, c.en), count: count(c.key) }))} />
    {cat === "storage" && <div className="mb-3"><Callout tone="info">{t("ຮັບສິນຄ້າພາຍໃນມື້ ບໍ່ເສຍຄ່າຝາກສາງ. ຫຼັງຈາກນັ້ນຄິດຕາມນໍ້າໜັກຄິດເງິນ ຄູນຈໍານວນວັນ ທີ່ເກີນວັນຟຣີ.", "Same-day pickup has no storage fee. After that, the fee is chargeable kg times the days beyond the free period.")}</Callout></div>}
    {cat === "service" && <div className="mb-3"><Callout tone="info">{t("ລະຫັດທີ່ຂຶ້ນຕົ້ນດ້ວຍ FSC, XRY ຫຼື AWB ຖືກເພີ່ມໃສ່ທຸກ AWB ໂດຍອັດຕະໂນມັດ. ລະຫັດອື່ນພະນັກງານເລືອກເອງຕອນອອກ AWB.", "Codes starting with FSC, XRY or AWB are added to every AWB automatically. Staff choose the others when issuing an AWB.")}</Callout></div>}
    <Panel flush>
      <DataTable rows={rows} columns={cols} rowKey={(x) => x.code} minWidth={1120} pageSize={15} defaultSort={{ key: "code", dir: "asc" }} onRowClick={(x) => setHist(x.code)} search={(x) => `${x.code} ${x.nameLo} ${x.nameEn} ${x.origin ?? ""} ${x.dest ?? ""} ${x.shc ?? ""}`}
        filters={<Select aria-label={t("ຂອບເຂດ", "Scope")} className="w-auto" value={scope} onChange={(e) => setScope(e.target.value)} placeholder={t("ທຸກຂອບເຂດ", "All scopes")} options={[{ value: "domestic", label: t("ພາຍໃນ", "Domestic") }, { value: "international", label: t("ຕ່າງປະເທດ", "International") }]} />} />
    </Panel>

    {form && <TariffForm base={form.base} category={cat} onClose={() => setForm(null)} />}
    {check && <PriceCheck onClose={() => setCheck(false)} />}

    <Dialog open={!!hist} onClose={() => setHist(null)} size="xl" title={t(`ປະຫວັດສະບັບຂອງ ${hist ?? ""}`, `Version history of ${hist ?? ""}`)} footer={editor && histRows[0] ? <Button icon={Pencil} onClick={() => { setForm({ base: shownVersion(d, histRows[0].code) }); setHist(null); }}>{t("ສະເໜີສະບັບໃໝ່", "Submit a new version")}</Button> : undefined}>
      <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm"><thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-ink-2"><th className="px-3 py-2 text-right font-semibold">{t("ອັດຕາ", "Rate")}</th><th className="px-3 py-2 text-right font-semibold">{t("ຂັ້ນຕໍ່າ", "Minimum")}</th><th className="px-3 py-2 font-semibold">{t("ເລີ່ມໃຊ້", "From")}</th><th className="px-3 py-2 font-semibold">{t("ສິ້ນສຸດ", "To")}</th><th className="px-3 py-2 font-semibold">{t("ແຫຼ່ງອ້າງອີງ", "Source")}</th><th className="px-3 py-2 font-semibold">{t("ສະຖານະ", "Status")}</th><th className="px-3 py-2 font-semibold">{t("ຜູ້ສະເໜີ", "Submitted by")}</th><th className="px-3 py-2 font-semibold">{t("ຜູ້ຕັດສິນ", "Decided by")}</th><th className="px-3 py-2 font-semibold">{t("ໝາຍເຫດ", "Note")}</th><th className="px-3 py-2" /></tr></thead>
        <tbody>{histRows.map((x) => <tr key={x.id} className="border-b border-line last:border-0">
          <td className="tnum whitespace-nowrap px-3 py-2 text-right font-medium">{rateText(x)}</td>
          <td className="tnum whitespace-nowrap px-3 py-2 text-right">{x.minCharge ? money(x.minCharge, x.currency) : "—"}</td>
          <td className="tnum whitespace-nowrap px-3 py-2">{fmtDate(x.effectiveFrom)}</td>
          <td className="tnum whitespace-nowrap px-3 py-2">{x.effectiveTo ? fmtDate(x.effectiveTo) : t("ບໍ່ກໍານົດ", "Open")}</td>
          <td className="whitespace-nowrap px-3 py-2">{sourceName(t, x.source)}</td>
          <td className="px-3 py-2"><TariffStatus x={x} /></td>
          <td className="whitespace-nowrap px-3 py-2">{userName(d, x.requestedBy, lang)}</td>
          <td className="whitespace-nowrap px-3 py-2">{userName(d, x.decidedBy, lang)}</td>
          <td className="px-3 py-2">{noteText(t, x.note)}</td>
          <td className="px-3 py-2 text-right">{mayDelete(x) && <IconButton icon={Trash2} label={t("ລຶບສະບັບນີ້", "Delete this version")} onClick={() => { setDel(x); if (histRows.length === 1) setHist(null); }} />}</td>
        </tr>)}</tbody></table></div>
    </Dialog>

    <Confirm open={!!accept} onClose={() => setAccept(null)} title={t(`ອະນຸມັດ ${accept?.code ?? ""}?`, `Approve ${accept?.code ?? ""}?`)} confirmLabel={t("ອະນຸມັດ", "Approve")} body={accept && (() => { const c = current(accept); return <>{t(`ອັດຕາ ${rateText(accept)} ເລີ່ມໃຊ້ ${fmtDate(accept.effectiveFrom)}.`, `Rate ${rateText(accept)} takes effect on ${fmtDate(accept.effectiveFrom)}.`)}{c && ` ${t(`ອັດຕາ ${rateText(c)} ຈະສິ້ນສຸດກ່ອນມື້ນັ້ນ 1 ວັນ.`, `The current ${rateText(c)} ends the day before.`)}`}</>; })()} onConfirm={() => { if (accept) { decideTariff(accept.id, true); toast(t(`ອະນຸມັດ ${accept.code} ແລ້ວ`, `${accept.code} approved`)); } }} />
    <Confirm open={!!reject} onClose={() => setReject(null)} danger title={t(`ບໍ່ອະນຸມັດ ${reject?.code ?? ""}?`, `Reject ${reject?.code ?? ""}?`)} reasonLabel={t("ເຫດຜົນ", "Reason")} confirmLabel={t("ບໍ່ອະນຸມັດ", "Reject")} onConfirm={(why) => { if (reject) { decideTariff(reject.id, false, why); toast(t(`ບໍ່ອະນຸມັດ ${reject.code} ແລ້ວ`, `${reject.code} rejected`)); } }} />
    <Confirm open={!!del} onClose={() => setDel(null)} danger title={t(`ລຶບສະບັບນີ້ຂອງ ${del?.code ?? ""}?`, `Delete this version of ${del?.code ?? ""}?`)} confirmLabel={t("ລຶບສະບັບນີ້", "Delete this version")} body={del && <>
      <p>{rateText(del)} · {fmtDate(del.effectiveFrom)}</p>
      {isEffective(del, todayIso()) && <div className="mt-2"><Callout tone="warn">{t("ນີ້ແມ່ນອັດຕາທີ່ໃຊ້ຢູ່. ຫຼັງລຶບ AWB ໃໝ່ຈະຫາອັດຕານີ້ບໍ່ພົບ. AWB ທີ່ອອກແລ້ວບໍ່ປ່ຽນແປງ.", "This rate is in force. After deleting it, new AWBs will not find this rate. AWBs already issued do not change.")}</Callout></div>}
    </>} onConfirm={() => { if (del) { deleteTariff(del.id); toast(t("ລຶບສະບັບແລ້ວ", "Version deleted")); } }} />
  </>;
}

function TariffForm({ base, category, onClose }: { base?: Tariff; category: TariffCategory; onClose: () => void }) {
  const d = useDb(); const t = useT(); const name = useName();
  const isNew = !base;
  const [cat, setCat] = useState<TariffCategory>(base?.category ?? category);
  const [code, setCode] = useState(base?.code ?? ""); const [codeTouched, setCodeTouched] = useState(!!base);
  const [nameLo, setNameLo] = useState(base?.nameLo ?? ""); const [nameEn, setNameEn] = useState(base?.nameEn ?? "");
  const [scope, setScope] = useState<Scope>(base?.scope ?? "domestic"); const [origin, setOrigin] = useState(base?.origin ?? d.session.station); const [dest, setDest] = useState(base?.dest ?? ""); const [shc, setShc] = useState(base?.shc ?? "");
  const [basis, setBasis] = useState<TariffBasis>(base?.basis ?? BASES_FOR[category][0]); const [rate, setRate] = useState(base ? String(base.rate) : ""); const [min, setMin] = useState(base ? String(base.minCharge) : "0"); const [currency, setCurrency] = useState(base?.currency ?? "LAK"); const [freeDays, setFreeDays] = useState(String(base?.freeDays ?? 0));
  const latest = base ? versionsOf(d, base.code).filter((x) => x.status === "approved").sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] : undefined;
  const earliest = latest && latest.effectiveFrom >= todayIso() ? dateAdd(latest.effectiveFrom, 1) : todayIso();
  const [from, setFrom] = useState(earliest > dateAdd(todayIso(), 1) ? earliest : dateAdd(todayIso(), 1)); const [to, setTo] = useState("");
  const srcInit = base ? (base.source === TACT ? TACT : base.source === INTERNAL ? INTERNAL : "other") : INTERNAL;
  const [srcKind, setSrcKind] = useState(srcInit); const [srcOther, setSrcOther] = useState(srcInit === "other" ? base?.source ?? "" : ""); const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);

  const routed = needsRoute(cat);
  const autoCode = cat === "general" && origin && dest ? `GCR-${origin}${dest}` : cat === "special" && origin && dest && shc ? `SCR-${shc}-${origin}${dest}` : "";
  const finalCode = (codeTouched ? code : autoCode || code).trim().toUpperCase();
  const finalScope: Scope = routed && origin && dest ? scopeOf(d, origin, dest) : scope;
  const sameRoute = (x: Tariff) => (x.origin === origin && x.dest === dest) || (x.origin === dest && x.dest === origin);
  const routeClash = isNew && routed && origin && dest ? d.tariffs.find((x) => x.category === cat && sameRoute(x) && (cat !== "special" || x.shc === shc) && x.status !== "rejected") : undefined;
  const req = t("ກະລຸນາປ້ອນຂໍ້ມູນນີ້", "Enter this field");
  const errs = {
    code: !isNew ? "" : !/^[A-Z0-9-]{3,}$/.test(finalCode) ? t("ໃຊ້ຕົວພິມໃຫຍ່ ຕົວເລກ ແລະ ຂີດ ຢ່າງໜ້ອຍ 3 ຕົວ", "Use at least 3 capital letters, digits or dashes") : d.tariffs.some((x) => x.code === finalCode) ? t(`ມີລະຫັດ ${finalCode} ແລ້ວ. ກະລຸນາສະເໜີສະບັບໃໝ່ຈາກລາຍການນັ້ນ`, `${finalCode} already exists. Submit a new version from its row`) : "",
    nameLo: nameLo.trim() ? "" : req, nameEn: nameEn.trim() ? "" : req,
    origin: routed && !origin ? req : "",
    dest: !routed ? "" : !dest ? req : dest === origin ? t("ຕົ້ນທາງ ແລະ ປາຍທາງຕ້ອງຕ່າງກັນ", "Origin and destination must differ") : routeClash ? t(`ເສັ້ນທາງນີ້ມີອັດຕາ ${routeClash.code} ແລ້ວ. ກະລຸນາສະເໜີສະບັບໃໝ່ຈາກລາຍການນັ້ນ`, `This route already has ${routeClash.code}. Submit a new version from its row`) : "",
    shc: cat === "special" && !shc ? t("ກະລຸນາເລືອກລະຫັດສິນຄ້າພິເສດ", "Choose a special handling code") : "",
    rate: Number(rate) > 0 ? "" : t("ກະລຸນາປ້ອນອັດຕາທີ່ຫຼາຍກວ່າ 0", "Enter a rate above 0"),
    min: min !== "" && Number(min) >= 0 ? "" : t("ກະລຸນາປ້ອນ 0 ຫຼື ຫຼາຍກວ່າ", "Enter 0 or more"),
    freeDays: cat !== "storage" || (Number(freeDays) >= 0 && Number.isInteger(Number(freeDays))) ? "" : t("ກະລຸນາປ້ອນຈໍານວນວັນ", "Enter a whole number of days"),
    from: !from ? t("ກະລຸນາເລືອກວັນທີເລີ່ມໃຊ້", "Choose an effective date") : from < todayIso() ? t("ວັນທີເລີ່ມໃຊ້ຕ້ອງເປັນມື້ນີ້ ຫຼື ຫຼັງຈາກນີ້", "The effective date must be today or later") : latest && from <= latest.effectiveFrom ? t(`ຕ້ອງຫຼັງວັນທີ ${fmtDate(latest.effectiveFrom)} ຂອງສະບັບທີ່ອະນຸມັດຫຼ້າສຸດ`, `Must be after ${fmtDate(latest.effectiveFrom)}, the latest approved version`) : "",
    to: to && from && to < from ? t("ວັນສິ້ນສຸດຕ້ອງບໍ່ກ່ອນວັນເລີ່ມໃຊ້", "The end date cannot be before the effective date") : "",
    src: srcKind === "other" && !srcOther.trim() ? t("ກະລຸນາລະບຸແຫຼ່ງອ້າງອີງ", "Name the reference source") : "",
  };
  const changeCat = (c: TariffCategory) => { setCat(c); setBasis(BASES_FOR[c][0]); };
  const save = () => {
    setTried(true); if (Object.values(errs).some(Boolean)) return;
    submitTariff({ category: cat, code: finalCode, nameLo: nameLo.trim(), nameEn: nameEn.trim(), scope: finalScope, origin: routed ? origin : undefined, dest: routed ? dest : undefined, shc: cat === "special" ? shc : undefined, basis, rate: Number(rate), minCharge: Number(min), currency, freeDays: cat === "storage" ? Number(freeDays) : undefined, effectiveFrom: from, effectiveTo: to || undefined, source: srcKind === "other" ? srcOther.trim() : srcKind, note: note.trim() || undefined });
    toast(t(`ສົ່ງ ${finalCode} ແລ້ວ ລໍຖ້າການອະນຸມັດ`, `${finalCode} sent and waiting for approval`)); onClose();
  };
  const e = (k: keyof typeof errs) => (tried ? errs[k] : "") || undefined;
  const stations = d.stations.filter((s) => s.active || s.code === origin || s.code === dest).map((s) => ({ value: s.code, label: `${s.code} · ${name(s)}` }));
  const currencies = d.currencies.filter((c) => c.active || c.code === currency).map((c) => ({ value: c.code, label: c.code }));
  return <Dialog open onClose={onClose} size="lg" title={base ? t(`ສະເໜີສະບັບໃໝ່ຂອງ ${base.code}`, `Submit a new version of ${base.code}`) : t("ສະເໜີອັດຕາໃໝ່", "Submit new tariff")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{t("ສົ່ງໃຫ້ອະນຸມັດ", "Send for approval")}</Button></>}>
    <div className="mb-3"><Callout tone="info">{base ? t("ສະບັບປັດຈຸບັນຈະໃຊ້ຕໍ່ໄປ ຈົນກວ່າສະບັບນີ້ຈະຖືກອະນຸມັດ ແລະ ຮອດວັນເລີ່ມໃຊ້.", "The current version stays in use until this one is approved and its effective date arrives.") : t("ອັດຕານີ້ຈະມີຜົນຫຼັງຖືກອະນຸມັດ ແລະ ຮອດວັນເລີ່ມໃຊ້.", "This rate takes effect once approved and its effective date arrives.")}</Callout></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label={t("ປະເພດ", "Category")} required><Select value={cat} disabled={!isNew} onChange={(x) => changeCat(x.target.value as TariffCategory)} options={CATS.map((c) => ({ value: c.key, label: t(c.lo, c.en) }))} /></Field>
      {routed && <Field label={t("ຕົ້ນທາງ", "Origin")} required error={e("origin")}><Select value={origin} disabled={!isNew} placeholder={t("ເລືອກສະຖານີ", "Choose a station")} onChange={(x) => setOrigin(x.target.value)} options={stations} /></Field>}
      {routed && <Field label={t("ປາຍທາງ", "Destination")} required error={e("dest")}><Select value={dest} disabled={!isNew} placeholder={t("ເລືອກສະຖານີ", "Choose a station")} onChange={(x) => setDest(x.target.value)} options={stations} /></Field>}
      {cat === "special" && <Field label={t("ລະຫັດສິນຄ້າພິເສດ SHC", "Special handling code")} required error={e("shc")}><Select value={shc} disabled={!isNew} placeholder={t("ເລືອກ SHC", "Choose an SHC")} onChange={(x) => setShc(x.target.value)} options={SHC_LIST.map((s) => ({ value: s.code, label: `${s.code} · ${t(s.lo, s.en)}` }))} /></Field>}
      <Field label={t("ລະຫັດ", "Code")} required error={e("code")} hint={isNew ? undefined : t("ສະບັບໃໝ່ໃຊ້ລະຫັດເດີມ", "A new version keeps the code")}><Input className="font-mono" disabled={!isNew} value={codeTouched ? code : autoCode || code} onChange={(x) => { setCode(x.target.value.toUpperCase()); setCodeTouched(true); }} /></Field>
      <Field label={t("ຂອບເຂດ", "Scope")} required hint={routed ? t("ກໍານົດຈາກເສັ້ນທາງ", "Set from the route") : undefined}><Select value={finalScope} disabled={routed || !isNew} onChange={(x) => setScope(x.target.value as Scope)} options={[{ value: "domestic", label: t("ພາຍໃນ", "Domestic") }, { value: "international", label: t("ຕ່າງປະເທດ", "International") }]} /></Field>
      <Field label={t("ຫຼັກການຄິດ", "Basis")} required><Select value={basis} disabled={BASES_FOR[cat].length === 1} onChange={(x) => setBasis(x.target.value as TariffBasis)} options={BASES_FOR[cat].map((b) => ({ value: b, label: t(BASIS[b][0], BASIS[b][1]) }))} /></Field>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <Field label={t("ຊື່ພາສາລາວ", "Name in Lao")} required error={e("nameLo")}><Input value={nameLo} onChange={(x) => setNameLo(x.target.value)} /></Field>
      <Field label={t("ຊື່ພາສາອັງກິດ", "Name in English")} required error={e("nameEn")}><Input value={nameEn} onChange={(x) => setNameEn(x.target.value)} /></Field>
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-4">
      <Field label={basis === "percent" ? t("ອັດຕາ (%)", "Rate (%)") : t("ອັດຕາ", "Rate")} required error={e("rate")}><Input type="number" min={0} step="any" value={rate} onChange={(x) => setRate(x.target.value)} /></Field>
      <Field label={t("ຄ່າຂັ້ນຕໍ່າ", "Minimum charge")} required error={e("min")}><Input type="number" min={0} step="any" value={min} onChange={(x) => setMin(x.target.value)} /></Field>
      <Field label={t("ສະກຸນເງິນ", "Currency")} required><Select value={currency} onChange={(x) => setCurrency(x.target.value)} options={currencies} /></Field>
      {cat === "storage" && <Field label={t("ວັນຟຣີ", "Free days")} error={e("freeDays")}><Input type="number" min={0} value={freeDays} onChange={(x) => setFreeDays(x.target.value)} /></Field>}
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-3">
      <Field label={t("ເລີ່ມໃຊ້", "Effective from")} required error={e("from")}><Input type="date" value={from} min={todayIso()} onChange={(x) => setFrom(x.target.value)} /></Field>
      <Field label={t("ສິ້ນສຸດ", "Effective to")} error={e("to")} hint={t("ປ່ອຍຫວ່າງຖ້າບໍ່ກໍານົດ", "Leave blank if open-ended")}><Input type="date" value={to} min={from} onChange={(x) => setTo(x.target.value)} /></Field>
      <Field label={t("ແຫຼ່ງອ້າງອີງ", "Reference source")} required><Select value={srcKind} onChange={(x) => setSrcKind(x.target.value)} options={[{ value: TACT, label: TACT }, { value: INTERNAL, label: t("ຂໍ້ຕົກລົງພາຍໃນ", "Internal") }, { value: "other", label: t("ອື່ນໆ", "Other") }]} /></Field>
      {srcKind === "other" && <Field className="sm:col-span-3" label={t("ລະບຸແຫຼ່ງອ້າງອີງ", "Name the source")} required error={e("src")}><Input value={srcOther} onChange={(x) => setSrcOther(x.target.value)} /></Field>}
    </div>
    <div className="mt-3"><Field label={t("ເຫດຜົນ ຫຼື ໝາຍເຫດ", "Reason or note")}><Textarea value={note} onChange={(x) => setNote(x.target.value)} /></Field></div>
  </Dialog>;
}

function PriceCheck({ onClose }: { onClose: () => void }) {
  const d = useDb(); const t = useT(); const name = useName();
  const [origin, setOrigin] = useState(d.session.station); const [dest, setDest] = useState(""); const [shc, setShc] = useState(""); const [weight, setWeight] = useState("100"); const [on, setOn] = useState(todayIso());
  const w = Number(weight); const billed = roundUpHalf(w);
  const ready = !!origin && !!dest && origin !== dest && w > 0 && !!on;
  const rate = ready ? findFreightRate(d, origin, dest, shc ? [shc] : [], on) : undefined;
  const line = rate ? priceFreight(rate, billed) : undefined;
  const minApplied = !!rate && rate.rate * billed < rate.minCharge;
  const fx = rate && rate.currency !== "LAK" ? rateToLak(d, rate.currency, on) : 0;
  const noSpecial = !!rate && !!shc && rate.category !== "special";
  const stations = d.stations.filter((s) => s.active).map((s) => ({ value: s.code, label: `${s.code} · ${name(s)}` }));
  return <Dialog open onClose={onClose} title={t("ກວດລາຄາ", "Price check")} footer={<Button onClick={onClose}>{t("ປິດ", "Close")}</Button>}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("ຕົ້ນທາງ", "Origin")}><Select value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder={t("ເລືອກສະຖານີ", "Choose a station")} options={stations} /></Field>
      <Field label={t("ປາຍທາງ", "Destination")} error={origin && origin === dest ? t("ຕົ້ນທາງ ແລະ ປາຍທາງຕ້ອງຕ່າງກັນ", "Origin and destination must differ") : undefined}><Select value={dest} onChange={(e) => setDest(e.target.value)} placeholder={t("ເລືອກສະຖານີ", "Choose a station")} options={stations} /></Field>
      <Field label={t("ລະຫັດສິນຄ້າພິເສດ SHC", "Special handling code")}><Select value={shc} onChange={(e) => setShc(e.target.value)} placeholder={t("ບໍ່ມີ (ສິນຄ້າທົ່ວໄປ)", "None (general cargo)")} options={SHC_LIST.map((s) => ({ value: s.code, label: `${s.code} · ${t(s.lo, s.en)}` }))} /></Field>
      <Field label={t("ນໍ້າໜັກຄິດເງິນ (kg)", "Chargeable weight (kg)")} error={weight !== "" && !(w > 0) ? t("ກະລຸນາປ້ອນນໍ້າໜັກທີ່ຫຼາຍກວ່າ 0", "Enter a weight above 0") : undefined} hint={w > 0 && billed !== w ? t(`ປັດຂຶ້ນເປັນ ${num(billed, 1)} kg`, `Rounded up to ${num(billed, 1)} kg`) : t("ປັດຂຶ້ນເປັນ 0.5 kg ຖັດໄປ", "Rounds up to the next 0.5 kg")}><Input type="number" min={0} step="any" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
      <Field label={t("ວັນທີ", "Date")}><Input type="date" value={on} onChange={(e) => setOn(e.target.value)} /></Field>
    </div>
    <div className="mt-4 border-t border-line pt-4">
      {!ready ? <p className="text-sm text-ink-2">{t("ເລືອກຕົ້ນທາງ ປາຍທາງ ແລະ ນໍ້າໜັກ ເພື່ອເບິ່ງອັດຕາ.", "Choose an origin, destination and weight to see the rate.")}</p>
        : !rate || !line ? <Callout tone="warn" title={t("ບໍ່ພົບອັດຕາສໍາລັບເສັ້ນທາງນີ້", "No rate for this route")}>{t(`ບໍ່ມີອັດຕາທີ່ອະນຸມັດແລ້ວສໍາລັບ ${origin}-${dest} ໃນວັນທີ ${fmtDate(on)}. ກະລຸນາສະເໜີອັດຕາໃໝ່ໃນແຖບສິນຄ້າທົ່ວໄປ.`, `No approved rate covers ${origin}-${dest} on ${fmtDate(on)}. Submit one on the General cargo tab.`)}</Callout>
        : <div className="space-y-3">
          {noSpecial && <Callout tone="info">{t(`ເສັ້ນທາງນີ້ບໍ່ມີອັດຕາພິເສດສໍາລັບ ${shc} ຈຶ່ງໃຊ້ອັດຕາສິນຄ້າທົ່ວໄປ.`, `This route has no special rate for ${shc}, so the general cargo rate applies.`)}</Callout>}
          <Dl cols={3} items={[
            { label: t("ອັດຕາທີ່ໃຊ້", "Rate applied"), value: <MonoCode className="font-semibold">{rate.code}</MonoCode> },
            { label: t("ຊື່", "Name"), value: name(rate) },
            { label: t("ແຫຼ່ງອ້າງອີງ", "Source"), value: sourceName(t, rate.source) },
            { label: t("ອັດຕາ", "Rate"), value: <span className="tnum">{money(rate.rate, rate.currency)} / kg</span> },
            { label: t("ຄ່າຂັ້ນຕໍ່າ", "Minimum charge"), value: <span className="tnum">{money(rate.minCharge, rate.currency)}</span> },
            { label: t("ໃຊ້ໄດ້", "Valid"), value: <span className="tnum">{fmtDate(rate.effectiveFrom)} - {rate.effectiveTo ? fmtDate(rate.effectiveTo) : t("ບໍ່ກໍານົດ", "open")}</span> },
          ]} />
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3">
            <span className="text-sm">{minApplied ? t("ໃຊ້ຄ່າຂັ້ນຕໍ່າ", "Minimum charge applies") : <span className="tnum">{money(rate.rate, rate.currency)} × {num(billed, billed % 1 ? 1 : 0)} kg</span>}</span>
            <span className="text-right"><span className="tnum block text-xl font-semibold">{money(line.amount, line.currency)}</span>{fx > 0 && <span className="tnum block text-xs text-ink-2">≈ {money(line.amount * fx, "LAK")}</span>}</span>
          </div>
          <p className="text-xs text-ink-2">{t("ຄ່າຂົນສົ່ງເທົ່ານັ້ນ ຍັງບໍ່ລວມຄ່າບໍລິການ.", "Freight only. Service charges are not included.")}</p>
        </div>}
    </div>
  </Dialog>;
}
