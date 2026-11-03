import { useMemo, useRef, useState } from "react";
import { CheckCircle2, FileDown, FileUp, Sparkles, Upload } from "lucide-react";
import readXlsxFile from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";
import { getDb, useCan, useDb } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Badge, Button, Callout, Col, DataTable, Empty, PageHeader, Panel, Tabs, toast } from "@/ui/kit";
import { allocateStock, submitTariff, upsert } from "@/lib/mock/master";
import { newCustomerId, saveCustomer } from "@/lib/mock/booking";
import { isoDate } from "@/lib/format";
import type { Db, Tariff } from "@/lib/types";

type Kind = "stations" | "customers" | "tariffs" | "awb";
type Raw = Record<string, string>;
interface Check { raw: Raw; errors: [string, string][]; update?: boolean }
interface Spec { lo: string; en: string; columns: string[]; sample: string[][]; noteLo: string; noteEn: string; keyCols: string[]; check: (r: Raw, d: Db, seen: Set<string>) => Check; save: (r: Raw, update: boolean) => void }

const today = () => isoDate(new Date());
const need = (r: Raw, cols: string[]) => cols.filter((c) => !r[c]).map((c) => [`ບໍ່ມີ ${c}`, `${c} is missing`] as [string, string]);
const money = (v: string) => Number(String(v).replace(/,/g, ""));

const SPECS: Record<Kind, Spec> = {
  stations: {
    lo: "ສະຖານີ", en: "Stations",
    columns: ["code", "name_lo", "name_en", "country", "scope", "branch_lo", "branch_en", "phone"],
    keyCols: ["code", "name_en", "country", "scope"],
    sample: [
      ["HKG", "ຮົງກົງ", "Hong Kong", "China", "international", "ສໍານັກງານ ຮົງກົງ", "Hong Kong Office", "+852 0000 0100"],
      ["LXG", "ຫຼວງນໍ້າທາ", "Luang Namtha", "Laos", "domestic", "ສໍານັກງານໜ້າບິນ ຫຼວງນໍ້າທາ", "Luang Namtha Airport Office", "+856 86 312 000"],
    ],
    noteLo: "ລະຫັດທີ່ມີຢູ່ແລ້ວຈະຖືກປັບປຸງ, ລະຫັດໃໝ່ຈະຖືກເພີ່ມ.", noteEn: "Existing codes are updated. New codes are added.",
    check: (r, d, seen) => {
      const errors = need(r, ["code", "name_lo", "name_en", "scope"]);
      const code = (r.code || "").toUpperCase();
      if (code && !/^[A-Z]{3}$/.test(code)) errors.push(["ລະຫັດຕ້ອງເປັນ IATA 3 ຕົວອັກສອນ", "Code must be 3 IATA letters"]);
      if (r.scope && !["domestic", "international"].includes(r.scope)) errors.push(["scope ຕ້ອງເປັນ domestic ຫຼື international", "Scope must be domestic or international"]);
      if (code && seen.has(code)) errors.push(["ລະຫັດຊໍ້າໃນໄຟລ໌", "Code repeated in file"]);
      seen.add(code);
      return { raw: r, errors, update: d.stations.some((s) => s.code === code) };
    },
    save: (r, update) => upsert("stations", { code: r.code.toUpperCase(), nameLo: r.name_lo, nameEn: r.name_en, countryEn: r.country, scope: r.scope as any, branchLo: r.branch_lo, branchEn: r.branch_en, phone: r.phone, active: true }, !update),
  },
  customers: {
    lo: "ລູກຄ້າ", en: "Customers",
    columns: ["code", "name_lo", "name_en", "type", "contact", "phone", "whatsapp", "address", "station", "credit_limit", "credit_days"],
    keyCols: ["code", "name_en", "type", "station"],
    sample: [
      ["C-IMP01", "ບໍລິສັດ ນໍ້າງື່ມ ເທຣດດິ້ງ ຈໍາກັດ", "Nam Ngum Trading Co., Ltd", "corporate", "ທ່ານ ສົມສັກ", "+856 20 5555 0101", "+856 20 5555 0101", "ບ້ານ ໂພນຕ້ອງ, ນະຄອນຫຼວງວຽງຈັນ", "VTE", "50000000", "30"],
      ["C-IMP02", "ຮ້ານ ດອກຈໍາປາ", "Dok Champa Shop", "general", "ທ່ານ ນາງ ພອນ", "+856 20 5555 0102", "", "ບ້ານ ວັດຈັນ, ຫຼວງພະບາງ", "LPQ", "0", "0"],
    ],
    noteLo: "ລະຫັດທີ່ມີຢູ່ແລ້ວຈະຖືກປັບປຸງ, ລະຫັດໃໝ່ຈະຖືກເພີ່ມ.", noteEn: "Existing codes are updated. New codes are added.",
    check: (r, d, seen) => {
      const errors = need(r, ["code", "name_lo", "name_en", "type", "phone", "station"]);
      if (r.type && !["general", "agent", "corporate"].includes(r.type)) errors.push(["type ຕ້ອງເປັນ general, agent ຫຼື corporate", "Type must be general, agent or corporate"]);
      if (r.station && !d.stations.some((s) => s.code === r.station)) errors.push([`ບໍ່ພົບສະຖານີ ${r.station}`, `Station ${r.station} not found`]);
      if (r.credit_limit && Number.isNaN(money(r.credit_limit))) errors.push(["ວົງເງິນຕ້ອງເປັນຕົວເລກ", "Credit limit must be a number"]);
      if (r.code && seen.has(r.code)) errors.push(["ລະຫັດຊໍ້າໃນໄຟລ໌", "Code repeated in file"]);
      seen.add(r.code);
      return { raw: r, errors, update: d.customers.some((c) => c.code === r.code) };
    },
    save: (r) => {
      const old = getDb().customers.find((c) => c.code === r.code);
      saveCustomer({ ...(old ?? { id: newCustomerId(), createdAt: new Date().toISOString(), active: true }), code: r.code, name: r.name_lo, nameEn: r.name_en, type: r.type as any, contact: r.contact, phone: r.phone, whatsapp: r.whatsapp || undefined, address: r.address, station: r.station, creditLimit: money(r.credit_limit || "0"), creditDays: money(r.credit_days || "0") }, !old);
    },
  },
  tariffs: {
    lo: "ອັດຕາຄ່າບໍລິການ", en: "Tariffs",
    columns: ["code", "name_lo", "name_en", "category", "scope", "origin", "dest", "basis", "rate", "min_charge", "currency", "effective_from", "source"],
    keyCols: ["code", "name_en", "rate", "currency", "effective_from"],
    sample: [
      ["GCR-VTEHKG", "ສິນຄ້າທົ່ວໄປ VTE-HKG", "General cargo VTE-HKG", "general", "international", "VTE", "HKG", "per_kg", "2.85", "45", "USD", "", "IATA TACT"],
      ["PKG-XL", "ຄ່າຫຸ້ມຫໍ່ ຂະໜາດໃຫຍ່", "Packaging, large", "service", "domestic", "", "", "flat", "90000", "0", "LAK", "", "Lao Airlines"],
    ],
    noteLo: "ທຸກອັດຕາຈະເຂົ້າຄິວລໍຖ້າຜູ້ຈັດການອະນຸມັດ, ຍັງບໍ່ໃຊ້ຄິດລາຄາຈົນກວ່າຈະອະນຸມັດ.", noteEn: "Every rate waits for manager approval and is not used for pricing until approved.",
    check: (r, d) => {
      const errors = need(r, ["code", "name_lo", "name_en", "category", "scope", "basis", "rate", "currency"]);
      if (r.category && !["general", "special", "service", "storage", "mail"].includes(r.category)) errors.push([`ບໍ່ຮູ້ຈັກປະເພດ ${r.category}`, `Unknown category ${r.category}`]);
      if (r.rate && Number.isNaN(money(r.rate))) errors.push(["ອັດຕາຕ້ອງເປັນຕົວເລກ", "Rate must be a number"]);
      if (r.currency && !d.currencies.some((c) => c.code === r.currency)) errors.push([`ບໍ່ພົບສະກຸນເງິນ ${r.currency}`, `Currency ${r.currency} not found`]);
      return { raw: r, errors, update: d.tariffs.some((t) => t.code === r.code) };
    },
    save: (r) => submitTariff({ code: r.code, nameLo: r.name_lo, nameEn: r.name_en, category: r.category as Tariff["category"], scope: r.scope as any, origin: r.origin || undefined, dest: r.dest || undefined, basis: r.basis as Tariff["basis"], rate: money(r.rate), minCharge: money(r.min_charge || "0"), currency: r.currency, effectiveFrom: r.effective_from || today(), source: r.source || "Import", note: "Import" }),
  },
  awb: {
    lo: "ຊ່ວງເລກ AWB", en: "AWB ranges",
    columns: ["prefix", "from", "to", "assignee_type", "assignee"],
    keyCols: ["prefix", "from", "to", "assignee_type", "assignee"],
    sample: [["627", "8100000", "8100999", "station", "VTE"], ["627", "8101000", "8101499", "station", "BKK"]],
    noteLo: "ຊ່ວງເລກທີ່ຊ້ອນກັບຂອງເກົ່າຈະຖືກປະຕິເສດ.", noteEn: "Ranges that overlap an existing range are refused.",
    check: (r, d) => {
      const errors = need(r, ["prefix", "from", "to", "assignee_type", "assignee"]);
      const from = Number(r.from), to = Number(r.to);
      if (r.prefix && !/^\d{3}$/.test(r.prefix)) errors.push(["Prefix ຕ້ອງເປັນ 3 ຕົວເລກ", "Prefix must be 3 digits"]);
      if (r.from && r.to && !(from <= to)) errors.push(["ເລກເລີ່ມຕ້ອງນ້ອຍກວ່າເລກສຸດທ້າຍ", "From must not exceed To"]);
      if (r.from && r.to && d.awbStock.some((s) => s.prefix === r.prefix && from <= s.to && to >= s.from)) errors.push(["ຊ້ອນກັບຊ່ວງເລກທີ່ມີຢູ່", "Overlaps an existing range"]);
      if (r.assignee_type === "station" && !d.stations.some((s) => s.code === r.assignee)) errors.push([`ບໍ່ພົບສະຖານີ ${r.assignee}`, `Station ${r.assignee} not found`]);
      if (r.assignee_type === "agent" && !d.customers.some((c) => c.id === r.assignee || c.code === r.assignee)) errors.push([`ບໍ່ພົບຕົວແທນ ${r.assignee}`, `Agent ${r.assignee} not found`]);
      return { raw: r, errors };
    },
    save: (r) => { const agent = r.assignee_type === "agent" ? getDb().customers.find((c) => c.id === r.assignee || c.code === r.assignee)?.id : undefined; allocateStock({ prefix: r.prefix, from: Number(r.from), to: Number(r.to), assigneeType: r.assignee_type as any, assignee: agent ?? r.assignee }); },
  },
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function readRows(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name)) return parseCsv((await file.text()).replace(/^﻿/, ""));
  const res: any = await readXlsxFile(file);
  const grid: any[][] = Array.isArray(res?.[0]) ? res : res?.[0]?.data ?? [];
  return grid.map((r) => r.map((c) => (c === null || c === undefined ? "" : c instanceof Date ? isoDate(c) : String(c).trim())));
}

export default function DataImport() {
  useDb();
  const t = useT(); const can = useCan(); const d = useDb();
  const manage = can("master.manage");
  const [kind, setKind] = useState<Kind>("stations");
  const [rows, setRows] = useState<Raw[] | null>(null); const [source, setSource] = useState("");
  const [headerError, setHeaderError] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const spec = SPECS[kind];

  const reset = () => { setRows(null); setSource(""); setHeaderError([]); };
  const load = (grid: string[][], from: string) => {
    const head = (grid[0] ?? []).map((h) => String(h).trim().toLowerCase());
    const missing = spec.columns.filter((c) => !head.includes(c));
    setSource(from); setHeaderError(missing);
    if (missing.length) { setRows(null); return; }
    setRows(grid.slice(1).filter((r) => r.some((c) => String(c).trim())).map((r) => Object.fromEntries(spec.columns.map((c) => [c, String(r[head.indexOf(c)] ?? "").trim()]))));
  };
  const checks = useMemo<Check[]>(() => { if (!rows) return []; const seen = new Set<string>(); return rows.map((r) => spec.check(r, d, seen)); }, [rows, d, spec]);
  const good = checks.filter((c) => !c.errors.length); const bad = checks.length - good.length;

  const template = async () => {
    const header = spec.columns.map((c) => ({ value: c, fontWeight: "bold" as const }));
    const body = spec.sample.map((r) => r.map((v) => ({ type: String, value: v })));
    await (writeXlsxFile as any)([header, ...body], { columns: spec.columns.map(() => ({ width: 22 })) }).toFile(`template-${kind}.xlsx`);
  };
  const onFile = async (f?: File) => {
    if (!f) return;
    try { load(await readRows(f), f.name); }
    catch { toast(t("ອ່ານໄຟລ໌ບໍ່ໄດ້. ກະລຸນາໃຊ້ໄຟລ໌ .xlsx ຫຼື .csv", "Could not read the file. Use .xlsx or .csv."), "bad"); }
    if (fileRef.current) fileRef.current.value = "";
  };
  const run = () => {
    good.forEach((c) => spec.save(c.raw, !!c.update));
    toast(t(`ນໍາເຂົ້າ ${good.length} ລາຍການແລ້ວ`, `${good.length} rows imported`));
    reset();
  };

  const cols: Col<Check>[] = [
    { key: "state", header: t("ຜົນກວດ", "Check"), render: (c) => c.errors.length ? <Badge tone="bad">{t("ມີບັນຫາ", "Problem")}</Badge> : c.update ? <Badge tone="info">{t("ປັບປຸງ", "Update")}</Badge> : <Badge tone="ok">{t("ເພີ່ມໃໝ່", "New")}</Badge> },
    ...spec.keyCols.map((k): Col<Check> => ({ key: k, header: k, render: (c) => <span className="tnum">{c.raw[k] || "—"}</span> })),
    { key: "err", header: t("ບັນຫາທີ່ພົບ", "What is wrong"), render: (c) => c.errors.length ? <span className="text-bad">{c.errors.map((e) => t(e[0], e[1])).join("; ")}</span> : "—" },
  ];

  return <>
    <PageHeader title={t("ນໍາເຂົ້າຂໍ້ມູນພື້ນຖານ", "Master data import")} subtitle={t("ນໍາຂໍ້ມູນເກົ່າຈາກ Excel ເຂົ້າລະບົບ ກ່ອນເລີ່ມໃຊ້ງານຈິງ. ລະບົບກວດທຸກແຖວກ່ອນບັນທຶກ.", "Bring existing data in from Excel before go-live. Every row is checked before it is saved.")} />
    <Tabs tabs={(Object.keys(SPECS) as Kind[]).map((k) => ({ key: k, label: t(SPECS[k].lo, SPECS[k].en) }))} value={kind} onChange={(k) => { setKind(k); reset(); }} />
    <Panel title={t(`ຂັ້ນຕອນທີ 1: ເລືອກໄຟລ໌ ${spec.lo}`, `Step 1: Choose a ${spec.en.toLowerCase()} file`)} className="mt-4">
      <p className="text-sm text-ink-2 mb-3">{t(spec.noteLo, spec.noteEn)} {t("ຖັນທີ່ຕ້ອງມີ:", "Required columns:")} <span className="font-mono text-xs">{spec.columns.join(", ")}</span></p>
      <div className="flex flex-wrap gap-2">
        <Button icon={FileDown} onClick={template}>{t("ດາວໂຫຼດແບບຟອມ Excel", "Download Excel template")}</Button>
        <Button icon={FileUp} variant="primary" disabled={!manage} onClick={() => fileRef.current?.click()}>{t("ເລືອກໄຟລ໌ .xlsx ຫຼື .csv", "Choose .xlsx or .csv file")}</Button>
        <Button icon={Sparkles} disabled={!manage} onClick={() => load([spec.columns, ...spec.sample], t("ໄຟລ໌ຕົວຢ່າງ", "Sample file"))}>{t("ລອງດ້ວຍໄຟລ໌ຕົວຢ່າງ", "Try the sample file")}</Button>
        <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" aria-label={t("ເລືອກໄຟລ໌", "Choose file")} onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      {!manage && <p className="mt-3 text-sm text-ink-2">{t("ບົດບາດຂອງທ່ານບໍ່ມີສິດນໍາເຂົ້າຂໍ້ມູນ.", "Your role cannot import data.")}</p>}
    </Panel>
    {headerError.length > 0 && <div className="mt-4"><Callout tone="bad" title={t(`ໄຟລ໌ ${source} ບໍ່ຖືກແບບຟອມ`, `${source} does not match the template`)}>{t("ຂາດຖັນ:", "Missing columns:")} {headerError.join(", ")}</Callout></div>}
    {rows && <Panel flush className="mt-4" title={t(`ຂັ້ນຕອນທີ 2: ກວດຂໍ້ມູນຈາກ ${source}`, `Step 2: Review ${source}`)} actions={<div className="flex flex-wrap items-center gap-2"><span className="text-sm text-ink-2">{t(`ພ້ອມນໍາເຂົ້າ ${good.length}, ມີບັນຫາ ${bad}`, `${good.length} ready, ${bad} with problems`)}</span><Button onClick={reset}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" icon={CheckCircle2} disabled={!good.length} onClick={run}>{t(`ນໍາເຂົ້າ ${good.length} ລາຍການ`, `Import ${good.length} rows`)}</Button></div>}>
      <DataTable rows={checks} columns={cols} rowKey={(c) => JSON.stringify(c.raw)} minWidth={900} empty={<Empty icon={Upload} title={t("ໄຟລ໌ນີ້ບໍ່ມີຂໍ້ມູນ", "This file has no rows")} />} />
    </Panel>}
  </>;
}
