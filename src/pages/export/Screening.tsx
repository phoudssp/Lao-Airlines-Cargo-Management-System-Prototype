import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Col, DataTable, Dialog, Empty, Field, Input, PageHeader, Panel, Select, StatRow, Tabs, Textarea, toast, cx } from "@/ui/kit";
import { AwbLink, flightLabel, Route, ShcTags, userName } from "@/ui/cargo";
import type { Awb, Lang } from "@/lib/types";
import { fmtDateTime, fmtTime, isoDate, kg, money, todayIso } from "@/lib/format";
import { recordScreening } from "@/lib/mock/awb";

const part = (s: string, lang: Lang) => { const p = s.split(" / "); return lang === "lo" ? p[0] : p[p.length - 1]; };
type Method = "X-Ray" | "Physical" | "ETD";
const MACHINES: Record<Method, string[]> = { "X-Ray": ["XR-01", "XR-02"], ETD: ["ETD-01"], Physical: [] };
const xrayCharge = (a: Awb) => a.charges.find((c) => c.code.startsWith("XRY"));

function BlockedNotice({ a }: { a: Awb }) {
  const t = useT();
  return <Callout tone="bad" title={t(`${a.no} ຖືກລະງັບ: ຫ້າມຂຶ້ນເຮືອບິນ`, `${a.no} is blocked: do not load`)}>
    <p className="mb-1">{a.screening?.note}</p>
    <ol className="list-decimal space-y-0.5 pl-5">
      <li>{t("ແຍກສິນຄ້າໄວ້ໃນພື້ນທີ່ກັກ ແລະ ແຈ້ງເຈົ້າໜ້າທີ່ຄວາມປອດໄພ.", "Move the cargo to the hold area and call the security officer.")}</li>
      <li>{t("ເປີດກວດກັບຜູ້ສົ່ງ. ຖ້າແກ້ໄຂໄດ້ ໃຫ້ກວດຄືນ ແລະ ບັນທຶກຜົນໃໝ່.", "Open and inspect it with the shipper. If the problem is fixed, screen it again and record the new result.")}</li>
      <li>{t("ຖ້າຂົນສົ່ງບໍ່ໄດ້ ໃຫ້ຄືນສິນຄ້າໃຫ້ຜູ້ສົ່ງ ແລະ ຍົກເລີກ AWB ໃນໜ້າລາຍລະອຽດ.", "If it can't fly, return it to the shipper and void the AWB from its detail page.")}</li>
    </ol>
    <p className="mt-1 text-xs">{t("ເຄື່ອງສະແກນຂຶ້ນເຮືອບິນຈະປະຕິເສດ AWB ນີ້ ຈົນກວ່າຈະມີຜົນຜ່ານ.", "The loading scan rejects this AWB until a pass is recorded.")}</p>
  </Callout>;
}

function RecordDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useDb(); const t = useT(); const lang = useLang(); const a = d.awbs.find((x) => x.id === id)!;
  const [method, setMethod] = useState<Method>(a.shc.includes("AVI") ? "Physical" : "X-Ray"); const [machine, setMachine] = useState(MACHINES[a.shc.includes("AVI") ? "Physical" : "X-Ray"][0] ?? "");
  const [result, setResult] = useState<"pass" | "fail">("pass"); const [note, setNote] = useState(""); const [tried, setTried] = useState(false); const [saved, setSaved] = useState(false);
  const fee = xrayCharge(a); const noteMissing = result === "fail" && !note.trim();
  function save() {
    setTried(true); if (noteMissing) return;
    recordScreening(a.id, { result, method, machine: machine || undefined, note: note.trim() || undefined });
    if (result === "pass") { toast(t(`${a.no} ຜ່ານການກວດ. ພ້ອມເຂົ້າ Manifest.`, `${a.no} passed and is ready for the manifest.`)); onClose(); } else { toast(t(`${a.no} ບໍ່ຜ່ານການກວດ`, `${a.no} failed screening`), "bad"); setSaved(true); }
  }
  if (saved) return <Dialog open onClose={onClose} title={t("ບັນທຶກຜົນບໍ່ຜ່ານແລ້ວ", "Failed result recorded")} footer={<><Link to={`/export/awb/${a.id}`}><Button>{t("ເປີດ AWB", "Open the AWB")}</Button></Link><Button variant="primary" onClick={onClose}>{t("ກັບໄປລາຍການ", "Back to the queue")}</Button></>}><BlockedNotice a={a} /></Dialog>;
  return <Dialog open onClose={onClose} title={t(`ບັນທຶກຜົນກວດ ${a.no}`, `Record screening for ${a.no}`)} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant={result === "pass" ? "success" : "danger"} onClick={save}>{result === "pass" ? t("ບັນທຶກວ່າຜ່ານ", "Record pass") : t("ບັນທຶກວ່າບໍ່ຜ່ານ", "Record fail")}</Button></>}>
    <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded bg-surface-2 p-3 text-sm sm:grid-cols-4">
      <div><dt className="box-label">{t("ເສັ້ນທາງ", "Route")}</dt><dd><Route from={a.origin} to={a.dest} /></dd></div>
      <div><dt className="box-label">{t("ກ່ອງ / ນໍ້າໜັກ", "Pieces / weight")}</dt><dd className="tnum">{a.pieces} · {kg(a.grossKg)}</dd></div>
      <div><dt className="box-label">{t("ສິນຄ້າ", "Commodity")}</dt><dd className="inline-flex flex-wrap items-center gap-1.5">{part(a.commodity, lang)}<ShcTags codes={a.shc} /></dd></div>
      <div><dt className="box-label">{t("ຄ່າກວດ X-Ray", "X-Ray fee")}</dt><dd className="tnum font-semibold">{fee ? money(fee.amount, fee.currency) : t("ບໍ່ໄດ້ຄິດ", "Not charged")}</dd></div>
    </dl>
    {a.screening?.result === "fail" && <div className="mb-3"><Callout tone="warn" title={t("ກວດຄືນຫຼັງບໍ່ຜ່ານ", "Re-screen after a fail")}>{a.screening.note}</Callout></div>}
    {a.shc.includes("AVI") && <div className="mb-3"><Callout title={t("ສັດມີຊີວິດ", "Live animals")}>{t("ບໍ່ຜ່ານເຄື່ອງ X-Ray. ໃຊ້ການກວດດ້ວຍມື.", "These don't go through the X-Ray. Use a physical check.")}</Callout></div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("ວິທີກວດ", "Method")} required><Select value={method} onChange={(e) => { const m = e.target.value as Method; setMethod(m); setMachine(MACHINES[m][0] ?? ""); }} options={[{ value: "X-Ray", label: "X-Ray" }, { value: "Physical", label: t("ກວດດ້ວຍມື", "Physical") }, { value: "ETD", label: "ETD" }]} /></Field>
      {MACHINES[method].length > 0 ? <Field label={t("ເຄື່ອງກວດ", "Machine")} required><Select value={machine} onChange={(e) => setMachine(e.target.value)} options={MACHINES[method].map((m) => ({ value: m, label: m }))} /></Field> : <Field label={t("ຜູ້ກວດ", "Inspector")} hint={t("ຊື່ຜູ້ກວດ ຫຼື ຈຸດກວດ", "Inspector name or check point")}><Input value={machine} onChange={(e) => setMachine(e.target.value)} /></Field>}
    </div>
    <div className="mt-3" role="radiogroup" aria-label={t("ຜົນກວດ", "Result")}>
      <span className="box-label mb-1 block">{t("ຜົນກວດ", "Result")}</span>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" role="radio" aria-checked={result === "pass"} onClick={() => setResult("pass")} className={cx("flex h-11 items-center justify-center gap-2 rounded border font-semibold", result === "pass" ? "border-ok bg-ok text-white" : "border-line-strong text-ink-2 hover:bg-surface-2")}><ShieldCheck size={18} aria-hidden />{t("ຜ່ານ", "Pass")}</button>
        <button type="button" role="radio" aria-checked={result === "fail"} onClick={() => setResult("fail")} className={cx("flex h-11 items-center justify-center gap-2 rounded border font-semibold", result === "fail" ? "border-bad bg-bad text-white" : "border-line-strong text-ink-2 hover:bg-surface-2")}><ShieldAlert size={18} aria-hidden />{t("ບໍ່ຜ່ານ", "Fail")}</button>
      </div>
    </div>
    <div className="mt-3"><Field label={t("ໝາຍເຫດ", "Note")} required={result === "fail"} error={tried && noteMissing ? t("ບອກສິ່ງທີ່ພົບ ເພື່ອໃຫ້ຜູ້ກວດຄົນຕໍ່ໄປເຫັນ", "Say what was found so the next person can see it") : undefined}><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
  </Dialog>;
}

export default function Screening() {
  const d = useDb(); const t = useT(); const lang = useLang(); const can = useCan(); const st = d.session.station;
  const [tab, setTab] = useState<"queue" | "today">("queue"); const [rec, setRec] = useState<string | null>(null); const perm = can("screening.record");
  const queue = useMemo(() => d.awbs.filter((a) => a.status === "active" && a.direction === "export" && a.origin === st && a.stage === "RCS"), [d.awbs, st]);
  const results = useMemo(() => d.awbs.filter((a) => a.origin === st && a.screening && isoDate(new Date(a.screening.at)) === todayIso()), [d.awbs, st]);
  const blocked = queue.filter((a) => a.screening?.result === "fail");
  const passed = results.filter((a) => a.screening?.result === "pass");
  const feeSum = (c: string) => results.filter((a) => a.currency === c).reduce((s, a) => s + (a.screening?.fee ?? 0), 0);
  const flightSort = (a: Awb) => { const f = d.flights.find((x) => x.id === a.flightId); return f ? `${f.date}${f.std}` : "9999"; };
  const queueCols: Col<Awb>[] = [
    { key: "no", header: t("ເລກ AWB", "AWB number"), render: (a) => <AwbLink awb={a} /> },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (a) => <Route from={a.origin} to={a.dest} />, sort: (a) => a.dest },
    { key: "flight", header: t("ຖ້ຽວບິນ", "Flight"), render: (a) => { const f = d.flights.find((x) => x.id === a.flightId); return <span className="font-mono text-[13px] whitespace-nowrap">{flightLabel(d, a.flightId)}{f && ` ${f.std}`}</span>; }, sort: flightSort },
    { key: "comm", header: t("ສິນຄ້າ", "Commodity"), render: (a) => <span className="inline-flex items-center gap-1.5"><span className="line-clamp-1">{part(a.commodity, lang)}</span><ShcTags codes={a.shc} /></span> },
    { key: "pcs", header: t("ກ່ອງ", "Pcs"), align: "right", render: (a) => a.pieces },
    { key: "kg", header: t("ນໍ້າໜັກ", "Gross"), align: "right", render: (a) => kg(a.grossKg), sort: (a) => a.grossKg },
    { key: "fee", header: t("ຄ່າ X-Ray", "X-Ray fee"), align: "right", render: (a) => { const c = xrayCharge(a); return <span className="whitespace-nowrap">{c ? money(c.amount, c.currency) : "—"}</span>; } },
    { key: "state", header: t("ສະຖານະ", "Status"), render: (a) => a.screening?.result === "fail" ? <Badge tone="bad">{t("ຖືກລະງັບ", "Blocked")}</Badge> : <Badge tone="warn">{t("ລໍຖ້າກວດ", "Waiting")}</Badge> },
    { key: "act", header: "", align: "right", render: (a) => perm ? <Button size="sm" variant={a.screening?.result === "fail" ? "secondary" : "primary"} onClick={(e) => { e.stopPropagation(); setRec(a.id); }}>{a.screening?.result === "fail" ? t("ກວດຄືນ", "Re-screen") : t("ບັນທຶກຜົນ", "Record result")}</Button> : null },
  ];
  const resultCols: Col<Awb>[] = [
    { key: "at", header: t("ເວລາ", "Time"), render: (a) => <span className="tnum">{fmtTime(a.screening?.at)}</span>, sort: (a) => a.screening?.at ?? "" },
    { key: "no", header: t("ເລກ AWB", "AWB number"), render: (a) => <AwbLink awb={a} /> },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (a) => <Route from={a.origin} to={a.dest} />, sort: (a) => a.dest },
    { key: "method", header: t("ວິທີກວດ", "Method"), render: (a) => a.screening?.method === "Physical" ? t("ກວດດ້ວຍມື", "Physical") : a.screening?.method },
    { key: "machine", header: t("ເຄື່ອງ / ຜູ້ກວດ", "Machine / inspector"), render: (a) => <span className="text-[13px]">{a.screening?.machine ?? "—"}</span> },
    { key: "res", header: t("ຜົນ", "Result"), render: (a) => a.screening?.result === "pass" ? <Badge tone="ok">{t("ຜ່ານ", "Pass")}</Badge> : <Badge tone="bad">{t("ບໍ່ຜ່ານ", "Fail")}</Badge>, sort: (a) => a.screening?.result ?? "" },
    { key: "note", header: t("ໝາຍເຫດ", "Note"), render: (a) => <span className="text-xs text-ink-2">{a.screening?.note}</span> },
    { key: "op", header: t("ຜູ້ບັນທຶກ", "Recorded by"), render: (a) => <span title={fmtDateTime(a.screening?.at)}>{userName(d, a.screening?.operator, lang)}</span> },
    { key: "fee", header: t("ຄ່າ X-Ray", "X-Ray fee"), align: "right", render: (a) => <span className="whitespace-nowrap">{money(a.screening?.fee ?? 0, a.currency)}</span> },
  ];
  const fees = [feeSum("LAK") ? money(feeSum("LAK"), "LAK") : "", feeSum("USD") ? money(feeSum("USD"), "USD") : ""].filter(Boolean).join(" · ") || "0 ₭";
  return <>
    <PageHeader title={t("ກວດຄວາມປອດໄພ X-Ray", "Security & X-Ray")} subtitle={t(`ສິນຄ້າທີ່ຮັບແລ້ວຢູ່ ${st} ຕ້ອງຜ່ານການກວດກ່ອນຂຶ້ນ Manifest. ຄ່າກວດລວມຢູ່ໃນຄ່າບໍລິການຂອງ AWB.`, `Cargo accepted at ${st} must pass before it can go on a manifest. The fee is part of the AWB charges.`)} />
    <StatRow items={[
      { label: t("ລໍຖ້າກວດ", "Waiting"), value: queue.length - blocked.length, tone: queue.length - blocked.length ? "warn" : undefined },
      { label: t("ຖືກລະງັບ", "Blocked"), value: blocked.length, tone: blocked.length ? "bad" : undefined, sub: t("ບໍ່ຜ່ານການກວດ", "Failed screening") },
      { label: t("ຜ່ານມື້ນີ້", "Passed today"), value: passed.length, sub: kg(passed.reduce((s, a) => s + a.grossKg, 0)) },
      { label: t("ຄ່າກວດ X-Ray ມື້ນີ້", "X-Ray fees today"), value: <span className="text-lg">{fees}</span> },
    ]} />
    {!perm && <div className="mb-3"><Callout title={t("ບົດບາດຂອງທ່ານເບິ່ງໄດ້ຢ່າງດຽວ", "Your role can view only")}>{t("ພະນັກງານຮັບສິນຄ້າ ແລະ ພະນັກງານສາງ ເປັນຜູ້ບັນທຶກຜົນກວດ.", "Acceptance and warehouse officers record screening results.")}</Callout></div>}
    {blocked.map((a) => <div key={a.id} className="mb-3"><Callout tone="bad" title={t(`${a.no} ບໍ່ຜ່ານການກວດ: ຫ້າມຂຶ້ນເຮືອບິນ`, `${a.no} failed screening: do not load`)} action={<span className="flex shrink-0 gap-2"><Link to={`/export/awb/${a.id}`}><Button size="sm">{t("ເປີດ AWB", "Open AWB")}</Button></Link>{perm && <Button size="sm" onClick={() => setRec(a.id)}>{t("ກວດຄືນ", "Re-screen")}</Button>}</span>}><span className="block font-medium">{a.screening?.note}</span>{t("ກວດກັບຜູ້ສົ່ງແລ້ວກວດຄືນ ຫຼື ຄືນສິນຄ້າ ແລະ ຍົກເລີກ AWB.", "Inspect it with the shipper and re-screen, or return it and void the AWB.")}</Callout></div>)}
    <Tabs value={tab} onChange={setTab} tabs={[{ key: "queue", label: t("ລາຍການລໍຖ້າ", "Queue"), count: queue.length }, { key: "today", label: t("ຜົນກວດມື້ນີ້", "Today's results"), count: results.length }]} />
    <Panel flush>
      {tab === "queue" ? <DataTable rows={queue} columns={queueCols} rowKey={(a) => a.id} minWidth={980} defaultSort={{ key: "flight", dir: "asc" }} search={(a) => `${a.prefix}${a.serial} ${a.commodity} ${a.dest}`} empty={<Empty icon={ShieldCheck} title={t("ບໍ່ມີສິນຄ້າລໍຖ້າກວດ", "Nothing is waiting for screening")}>{t(`AWB ໃໝ່ທີ່ອອກຢູ່ ${st} ຈະເຂົ້າລາຍການນີ້ໂດຍອັດຕະໂນມັດ.`, `New AWBs issued at ${st} join this queue automatically.`)}</Empty>} />
        : <DataTable rows={results} columns={resultCols} rowKey={(a) => a.id} minWidth={980} defaultSort={{ key: "at", dir: "desc" }} search={(a) => `${a.prefix}${a.serial} ${a.dest} ${a.screening?.machine ?? ""}`} empty={<Empty title={t("ມື້ນີ້ຍັງບໍ່ມີຜົນກວດ", "No results recorded today")}>{t("ບັນທຶກຜົນຈາກແຖບລາຍການລໍຖ້າ.", "Record a result from the Queue tab.")}</Empty>} />}
    </Panel>
    {rec && <RecordDialog id={rec} onClose={() => setRec(null)} />}
  </>;
}
