import { customerName } from "@/ui/cargo";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { useDb, can } from "@/lib/store";
import { useName, useT } from "@/lib/i18n";
import { Badge, BarMeter, Button, Callout, Checkbox, cx, Field, IconButton, Input, PageHeader, Panel, Select, toast } from "@/ui/kit";
import { SHC_LIST } from "@/ui/cargo";
import type { ChargeLine, House, PieceLine } from "@/lib/types";
import { chargeable, findFreightRate, priceFreight, priceService, scopeOf, serviceTariffs } from "@/lib/pricing";
import { issueAwb, nextSerialFor } from "@/lib/mock/awb";
import { flightCapacity } from "@/lib/mock/booking";
import { fmtDate, kg, money, num, todayIso } from "@/lib/format";

let k = 0; const newLine = (): PieceLine => ({ id: `n${++k}`, pieces: 1, lengthCm: 0, widthCm: 0, heightCm: 0, weightKg: 0 });

export default function AwbNew() {
  const d = useDb(); const t = useT(); const name = useName(); const nav = useNavigate(); const [params] = useSearchParams();
  const station = d.session.station;
  const booking = d.bookings.find((b) => b.id === params.get("booking"));
  const [shipperId, setShipper] = useState(booking?.customerId ?? ""); const [consigneeId, setConsignee] = useState("");
  const [dest, setDest] = useState(booking?.dest ?? ""); const [flightId, setFlight] = useState(booking?.flightId ?? "");
  const [commodity, setCommodity] = useState(booking?.commodity ?? ""); const [shc, setShc] = useState<string[]>(booking?.shc ?? []);
  const [lines, setLines] = useState<PieceLine[]>(booking ? [{ id: "b", pieces: booking.pieces, lengthCm: 50, widthCm: 40, heightCm: 40, weightKg: booking.weightKg }] : [newLine()]);
  const [services, setServices] = useState<string[]>([]); const [houses, setHouses] = useState<House[]>([]); const [tried, setTried] = useState(false);
  const shipper = d.customers.find((c) => c.id === shipperId);
  const [payMode, setPayMode] = useState<"cash" | "credit">("cash");
  useEffect(() => { setPayMode(shipper && shipper.creditLimit > 0 ? "credit" : "cash"); }, [shipperId]);
  const stock = nextSerialFor(d, station);
  const dests = useMemo(() => [...new Set(d.routes.filter((r) => r.origin === station && r.active).map((r) => r.dest))], [d.routes, station]);
  const flights = d.flights.filter((f) => f.origin === station && f.dest === dest && f.status === "open" && f.date >= todayIso()).sort((a, b) => (a.date + a.std).localeCompare(b.date + b.std));
  const c = chargeable(lines); const scope = dest ? scopeOf(d, station, dest) : "domestic";
  const rate = dest ? findFreightRate(d, station, dest, shc) : undefined;
  const allServices = serviceTariffs(d, scope);
  const automatic = allServices.filter((s) => /^(FSC|XRY|AWB)/.test(s.code)); const optional = allServices.filter((s) => !automatic.includes(s));
  const freight = rate && c.chargeable > 0 ? priceFreight(rate, c.chargeable) : undefined;
  const charges: ChargeLine[] = freight ? [freight, ...automatic.map((s) => priceService(s, c.chargeable, freight.amount)), ...optional.filter((s) => services.includes(s.id)).map((s) => priceService(s, c.chargeable, freight.amount))] : [];
  const total = charges.reduce((s, x) => s + x.amount, 0); const currency = rate?.currency ?? "LAK";
  const cap = flightId ? flightCapacity(d, flightId) : undefined; const over = cap && c.gross > cap.remainingKg;
  const problems = { shipper: !shipperId, consignee: !consigneeId, dest: !dest, commodity: !commodity.trim(), lines: lines.some((l) => l.pieces <= 0 || l.weightKg <= 0 || l.lengthCm <= 0 || l.widthCm <= 0 || l.heightCm <= 0), rate: !!dest && !rate };
  const invalid = Object.values(problems).some(Boolean);
  function setLine(id: string, patch: Partial<PieceLine>) { setLines((ls) => ls.map((l) => l.id === id ? { ...l, ...patch } : l)); }
  function submit() {
    setTried(true); if (invalid || !can("awb.issue", d)) return;
    const r = issueAwb({ bookingId: booking?.id, shipperId, consigneeId, agentId: shipper?.type === "agent" ? shipperId : undefined, origin: station, dest, flightId: flightId || undefined, commodity, shc, lines, charges, currency, payMode, houses });
    if (!r.ok) { toast(t("ບໍ່ມີເລກ AWB ເຫຼືອໃນສະຖານີນີ້. ກະລຸນາຂໍຈັດສັນຊ່ວງເລກໃໝ່.", "This station has no AWB numbers left. Allocate a new range."), "bad"); return; }
    toast(t("ອອກ AWB ສໍາເລັດ", "AWB issued")); nav(`/export/awb/${r.id}`);
  }
  const cOpts = d.customers.filter((x) => x.active).map((x) => ({ value: x.id, label: customerName(d, x.id) }));
  return <>
    <PageHeader title={t("ອອກ AWB ໃໝ່", "Issue new AWB")} subtitle={booking ? t(`ຈາກການຈອງ ${booking.no}`, `From booking ${booking.no}`) : t(`ຮັບເຄື່ອງທີ່ສະຖານີ ${station}`, `Accepting cargo at ${station}`)} crumbs={[{ label: t("ໃບຂົນສົ່ງ AWB", "Air waybills"), to: "/export/awb" }, { label: t("ອອກໃໝ່", "New") }]} />
    {!stock && <div className="mb-4"><Callout tone="bad" title={t("ບໍ່ມີເລກ AWB ເຫຼືອ", "No AWB numbers left")} action={<Link to="/master/awb-stock"><Button size="sm">{t("ຈັດສັນເລກ", "Allocate")}</Button></Link>}>{t("ສະຖານີນີ້ຍັງບໍ່ໄດ້ຮັບຈັດສັນຊ່ວງເລກ AWB.", "This station has no AWB range assigned.")}</Callout></div>}
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <Panel title={t("ຜູ້ສົ່ງ ແລະ ຜູ້ຮັບ", "Shipper and consignee")}><div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("ຜູ້ສົ່ງ / ຕົວແທນ", "Shipper / agent")} required error={tried && problems.shipper ? t("ກະລຸນາເລືອກຜູ້ສົ່ງ", "Choose the shipper") : undefined}><Select value={shipperId} onChange={(e) => setShipper(e.target.value)} placeholder={t("ເລືອກລູກຄ້າ", "Choose customer")} options={cOpts} /></Field>
          <Field label={t("ຜູ້ຮັບປາຍທາງ", "Consignee")} required error={tried && problems.consignee ? t("ກະລຸນາເລືອກຜູ້ຮັບ", "Choose the consignee") : undefined}><Select value={consigneeId} onChange={(e) => setConsignee(e.target.value)} placeholder={t("ເລືອກລູກຄ້າ", "Choose customer")} options={cOpts} /></Field>
        </div></Panel>
        <Panel title={t("ເສັ້ນທາງ ແລະ ຖ້ຽວບິນ", "Route and flight")}><div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("ຕົ້ນທາງ", "Origin")}><Input value={station} disabled className="font-mono font-semibold" /></Field>
          <Field label={t("ປາຍທາງ", "Destination")} required error={tried && problems.dest ? t("ກະລຸນາເລືອກປາຍທາງ", "Choose the destination") : undefined}><Select value={dest} onChange={(e) => { setDest(e.target.value); setFlight(""); }} placeholder="—" options={dests.map((s) => ({ value: s, label: `${s} ${name(d.stations.find((x) => x.code === s))}` }))} /></Field>
          <Field label={t("ຖ້ຽວບິນ", "Flight")}><Select value={flightId} disabled={!dest} onChange={(e) => setFlight(e.target.value)} placeholder={t("ກໍານົດພາຍຫຼັງ", "Assign later")} options={flights.map((f) => ({ value: f.id, label: `${f.no} ${fmtDate(f.date)} ${f.std}` }))} /></Field>
        </div>
        {cap && <div className="mt-3"><div className="mb-1 flex justify-between text-xs text-ink-2"><span>{cap.aircraft?.nameEn} · {t("ຄວາມຈຸ", "capacity")} {kg(cap.maxKg)}</span><span className="tnum">{t("ຍັງເຫຼືອ", "remaining")} {kg(Math.max(0, cap.remainingKg))}</span></div><BarMeter value={cap.usedKg + c.gross} max={cap.maxKg} /></div>}
        {over && <div className="mt-2"><Callout tone="warn">{t("ນໍ້າໜັກນີ້ເກີນພື້ນທີ່ຍັງເຫຼືອຂອງຖ້ຽວບິນ. ເລືອກຖ້ຽວອື່ນ ຫຼື ກໍານົດພາຍຫຼັງ.", "This weight exceeds the space left on the flight. Choose another flight or assign one later.")}</Callout></div>}
        </Panel>
        <Panel title={t("ສິນຄ້າ", "Cargo")}><div className="grid gap-3">
          <Field label={t("ລາຍລະອຽດສິນຄ້າ", "Nature of goods")} required error={tried && problems.commodity ? t("ກະລຸນາລະບຸສິນຄ້າ", "Describe the goods") : undefined}><Input value={commodity} onChange={(e) => setCommodity(e.target.value)} /></Field>
          <div><div className="box-label mb-1">{t("ລະຫັດສິນຄ້າພິເສດ", "Special handling codes")}</div><div className="flex flex-wrap gap-1.5">{SHC_LIST.map((s) => { const on = shc.includes(s.code); return <button key={s.code} type="button" aria-pressed={on} onClick={() => setShc((x) => on ? x.filter((y) => y !== s.code) : [...x, s.code])} className={cx("rounded border px-2 py-1 text-xs", on ? "border-brand bg-brand text-white" : "border-line-strong hover:bg-surface-2")}><span className="font-mono font-semibold">{s.code}</span> {t(s.lo, s.en)}</button>; })}</div></div>
          <div>
            <div className="mb-1 flex items-center justify-between"><span className="box-label">{t("ຂະໜາດ ແລະ ນໍ້າໜັກ (ຍາວ x ກວ້າງ x ສູງ cm)", "Dimensions and weight (L x W x H cm)")}</span><Button size="sm" variant="ghost" icon={Plus} onClick={() => setLines((l) => [...l, newLine()])}>{t("ເພີ່ມແຖວ", "Add line")}</Button></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="text-left text-xs text-ink-2"><th className="pb-1 pr-2 font-medium">{t("ຈໍານວນກ່ອງ", "Pieces")}</th><th className="pb-1 pr-2 font-medium">{t("ຍາວ", "L")}</th><th className="pb-1 pr-2 font-medium">{t("ກວ້າງ", "W")}</th><th className="pb-1 pr-2 font-medium">{t("ສູງ", "H")}</th><th className="pb-1 pr-2 font-medium">{t("ນໍ້າໜັກລວມ kg", "Gross kg")}</th><th className="pb-1 pr-2 text-right font-medium">{t("ບໍລິມາດ kg", "Volume kg")}</th><th /></tr></thead>
              <tbody>{lines.map((l) => <tr key={l.id}>{(["pieces", "lengthCm", "widthCm", "heightCm", "weightKg"] as const).map((f) => <td key={f} className="pb-1.5 pr-2"><Input type="number" min={0} aria-label={f} value={l[f] || ""} onChange={(e) => setLine(l.id, { [f]: Number(e.target.value) })} /></td>)}<td className="tnum pb-1.5 pr-2 text-right">{num((l.lengthCm * l.widthCm * l.heightCm * l.pieces) / 6000, 1)}</td><td className="pb-1.5"><IconButton icon={Trash2} label={t("ລຶບແຖວ", "Remove line")} disabled={lines.length === 1} onClick={() => setLines((x) => x.filter((y) => y.id !== l.id))} /></td></tr>)}</tbody></table></div>
            {tried && problems.lines && <p className="text-xs text-bad">{t("ໃສ່ຈໍານວນ, ຂະໜາດ ແລະ ນໍ້າໜັກໃຫ້ຄົບທຸກແຖວ", "Enter pieces, dimensions and weight on every line")}</p>}
          </div>
        </div></Panel>
        <Panel title={t("ໃບຂົນສົ່ງຍ່ອຍ HAWB", "House waybills (HAWB)")} actions={<Button size="sm" variant="ghost" icon={Plus} onClick={() => setHouses((h) => [...h, { id: `h${++k}`, hawb: "", pieces: 1, weightKg: 0, commodity: "", shipper: "", consignee: "" }])}>{t("ເພີ່ມ HAWB", "Add HAWB")}</Button>}>
          {houses.length === 0 ? <p className="text-sm text-ink-2">{t("ໃຊ້ສໍາລັບຕົວແທນທີ່ລວມສິນຄ້າ. ຂໍ້ມູນນີ້ຈະຖືກໃຊ້ສ້າງຂໍ້ຄວາມ FHL.", "For agents consolidating cargo. This data feeds the FHL message.")}</p> : <div className="space-y-2">{houses.map((h) => <div key={h.id} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_70px_80px_1fr_1fr_32px]">{([["hawb", "HAWB"], ["pieces", t("ກ່ອງ", "Pcs")], ["weightKg", "kg"], ["shipper", t("ຜູ້ສົ່ງ", "Shipper")], ["consignee", t("ຜູ້ຮັບ", "Consignee")]] as const).map(([f, lab]) => <Field key={f} label={lab}><Input type={f === "pieces" || f === "weightKg" ? "number" : "text"} value={(h as any)[f] || ""} onChange={(e) => setHouses((x) => x.map((y) => y.id === h.id ? { ...y, [f]: f === "pieces" || f === "weightKg" ? Number(e.target.value) : e.target.value } : y))} /></Field>)}<div className="flex items-end"><IconButton icon={Trash2} label={t("ລຶບ", "Remove")} onClick={() => setHouses((x) => x.filter((y) => y.id !== h.id))} /></div></div>)}</div>}
        </Panel>
      </div>
      <aside className="space-y-4 lg:sticky lg:top-[72px]">
        <Panel title={t("ຄິດໄລ່ນໍ້າໜັກ", "Weight calculation")}>
          <dl className="space-y-1 text-sm"><div className="flex justify-between"><dt>{t("ນໍ້າໜັກຕົວຈິງ (Gross)", "Gross weight")}</dt><dd className={cx("tnum", !c.usesVolume && "font-semibold")}>{num(c.gross, 1)} kg</dd></div><div className="flex justify-between"><dt>{t("ນໍ້າໜັກບໍລິມາດ (÷ 6000)", "Volumetric (÷ 6000)")}</dt><dd className={cx("tnum", c.usesVolume && "font-semibold")}>{num(c.vol, 1)} kg</dd></div></dl>
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3"><span className="text-sm font-medium">{t("ນໍ້າໜັກຄິດເງິນ", "Chargeable weight")}</span><span className="tnum text-2xl font-semibold">{num(c.chargeable, 1)} kg</span></div>
          <p className="mt-1 text-xs text-ink-2">{c.chargeable > 0 ? (c.usesVolume ? t("ໃຊ້ນໍ້າໜັກບໍລິມາດ ເພາະສູງກວ່າ. ປັດຂຶ້ນເປັນ 0.5 kg.", "Volumetric is higher, so it applies. Rounded up to 0.5 kg.") : t("ໃຊ້ນໍ້າໜັກຕົວຈິງ ເພາະສູງກວ່າ. ປັດຂຶ້ນເປັນ 0.5 kg.", "Gross is higher, so it applies. Rounded up to 0.5 kg.")) : t("ໃສ່ຂະໜາດ ແລະ ນໍ້າໜັກເພື່ອຄິດໄລ່.", "Enter dimensions and weight to calculate.")}</p>
        </Panel>
        <Panel title={t("ຄ່າຂົນສົ່ງ", "Charges")}>
          {problems.rate ? <Callout tone="bad" title={t("ບໍ່ພົບອັດຕາຂອງເສັ້ນທາງນີ້", "No rate for this route")}><Link className="underline" to="/master/tariffs">{t("ເພີ່ມອັດຕາ", "Add a tariff")}</Link></Callout> : !freight ? <p className="text-sm text-ink-2">{t("ເລືອກປາຍທາງ ແລະ ໃສ່ນໍ້າໜັກ ເພື່ອຄິດຄ່າຂົນສົ່ງອັດຕະໂນມັດ.", "Choose a destination and enter the weight to price automatically.")}</p> : <>
            <ul className="space-y-1 text-sm">{charges.map((x) => <li key={x.id} className="flex justify-between gap-3"><span className="min-w-0">{name(x)}</span><span className="tnum whitespace-nowrap">{money(x.amount, x.currency)}</span></li>)}</ul>
            <div className="mt-1 text-xs text-ink-2">{rate && <>{rate.code}: <span className="tnum">{rate.currency === "LAK" ? num(rate.rate) : num(rate.rate, 2)}</span> {rate.currency}/kg{freight.amount === rate.minCharge && ` · ${t("ຄ່າຂັ້ນຕໍ່າ", "minimum charge")}`}{rate.category === "special" && <> · <Badge tone="warn" noIcon>{t("ອັດຕາພິເສດ", "Special rate")}</Badge></>}</>}</div>
            <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3"><span className="text-sm font-medium">{t("ລວມ", "Total")}</span><span className="tnum text-2xl font-semibold">{money(total, currency)}</span></div>
          </>}
          {optional.length > 0 && <div className="mt-3 space-y-1 border-t border-line pt-3"><div className="box-label">{t("ບໍລິການເສີມ", "Additional services")}</div>{optional.map((s) => <div key={s.id}><Checkbox label={name(s)} checked={services.includes(s.id)} onChange={(v) => setServices((x) => v ? [...x, s.id] : x.filter((y) => y !== s.id))} /></div>)}</div>}
          <div className="mt-3 border-t border-line pt-3"><Field label={t("ການຊໍາລະ", "Payment")}><Select value={payMode} onChange={(e) => setPayMode(e.target.value as "cash" | "credit")} options={[{ value: "cash", label: t("ຈ່າຍທີ່ແຄັດເຊຍ", "Pay at cashier") }, ...(shipper && shipper.creditLimit > 0 ? [{ value: "credit", label: t("ຕິດໜີ້ (Credit Account)", "Credit account") }] : [])]} /></Field></div>
        </Panel>
        <Button variant="primary" size="lg" className="w-full" onClick={submit} disabled={!stock || !can("awb.issue", d)}>{t("ອອກ AWB", "Issue AWB")}</Button>
        {!can("awb.issue", d) && <p className="text-xs text-ink-2">{t("ບົດບາດຂອງທ່ານບໍ່ມີສິດອອກ AWB.", "Your role cannot issue AWBs.")}</p>}
        {tried && invalid && <p className="text-xs text-bad">{t("ຍັງມີຂໍ້ມູນທີ່ຕ້ອງໃສ່ໃຫ້ຄົບ.", "Some required details are still missing.")}</p>}
      </aside>
    </div>
  </>;
}
