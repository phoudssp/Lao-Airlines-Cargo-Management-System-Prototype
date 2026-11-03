import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileDown, Plus } from "lucide-react";
import { useDb, useCan } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Button, Col, DataTable, PageHeader, Panel, Select, Badge, StatRow } from "@/ui/kit";
import { AwbLink, AwbStrip, Route, ShcTags, customerName, flightLabel } from "@/ui/cargo";
import type { Awb } from "@/lib/types";
import { kg, money, todayIso } from "@/lib/format";
import { exportExcel } from "@/lib/export";

export default function AwbList() {
  const d = useDb(); const t = useT(); const can = useCan(); const nav = useNavigate();
  const [stage, setStage] = useState(""); const [dest, setDest] = useState(""); const [pay, setPay] = useState("");
  const st = d.session.station;
  const all = useMemo(() => d.awbs.filter((a) => a.direction === "export" && a.origin === st), [d.awbs, st]);
  const rows = useMemo(() => all.filter((a) => (!stage || (stage === "VOID" ? a.status === "voided" : a.stage === stage && a.status === "active")) && (!dest || a.dest === dest) && (!pay || (pay === "unpaid" ? !a.paid : pay === "credit" ? a.payMode === "credit" : a.paid))), [all, stage, dest, pay]);
  const today = all.filter((a) => a.issuedAt.slice(0, 10) === todayIso() && a.status === "active");
  const cols: Col<Awb>[] = [
    { key: "no", header: t("ເລກ AWB", "AWB number"), render: (a) => <AwbLink awb={a} />, sort: (a) => a.issuedAt },
    { key: "route", header: t("ເສັ້ນທາງ", "Route"), render: (a) => <Route from={a.origin} to={a.dest} />, sort: (a) => a.dest },
    { key: "flight", header: t("ຖ້ຽວບິນ", "Flight"), render: (a) => <span className="font-mono text-[13px] whitespace-nowrap">{flightLabel(d, a.flightId)}</span> },
    { key: "shipper", header: t("ຜູ້ສົ່ງ", "Shipper"), render: (a) => <span className="line-clamp-1">{customerName(d, a.shipperId)}</span> },
    { key: "commodity", header: t("ສິນຄ້າ", "Commodity"), render: (a) => <span className="inline-flex items-center gap-1.5"><span className="line-clamp-1">{a.commodity.split(" / ")[t("0", "1") === "0" ? 0 : 1] ?? a.commodity}</span><ShcTags codes={a.shc} /></span> },
    { key: "pcs", header: t("ກ່ອງ", "Pcs"), align: "right", render: (a) => a.pieces, sort: (a) => a.pieces },
    { key: "kg", header: t("ນໍ້າໜັກຄິດເງິນ", "Chargeable"), align: "right", render: (a) => kg(a.chargeableKg), sort: (a) => a.chargeableKg },
    { key: "total", header: t("ຄ່າຂົນສົ່ງ", "Charges"), align: "right", render: (a) => <span className="whitespace-nowrap">{money(a.total, a.currency)}</span>, sort: (a) => a.total },
    { key: "pay", header: t("ການຊໍາລະ", "Payment"), render: (a) => a.payMode === "credit" ? <Badge tone="info" noIcon>{t("ຕິດໜີ້", "Credit")}</Badge> : a.paid ? <Badge tone="ok">{t("ຈ່າຍແລ້ວ", "Paid")}</Badge> : <Badge tone="warn">{t("ຍັງບໍ່ຈ່າຍ", "Unpaid")}</Badge> },
    { key: "stage", header: t("ສະຖານະ", "Status"), render: (a) => <AwbStrip awb={a} />, sort: (a) => a.stage },
  ];
  const dests = [...new Set(all.map((a) => a.dest))].sort();
  return <>
    <PageHeader title={t("ໃບຂົນສົ່ງສິນຄ້າ AWB", "Air waybills")} subtitle={t(`ສິນຄ້າຂາອອກ ຈາກສະຖານີ ${st}`, `Export shipments from ${st}`)} actions={<>
      <Button icon={FileDown} onClick={() => exportExcel(t("ລາຍການ AWB", "AWB list"), `AWB-${st}-${todayIso()}`, [{ header: "AWB", value: (a: Awb) => a.no }, { header: "Origin", value: (a) => a.origin }, { header: "Destination", value: (a) => a.dest }, { header: "Flight", value: (a) => flightLabel(d, a.flightId) }, { header: "Pieces", value: (a) => a.pieces }, { header: "Gross kg", value: (a) => a.grossKg }, { header: "Chargeable kg", value: (a) => a.chargeableKg }, { header: "Total", value: (a) => a.total }, { header: "Currency", value: (a) => a.currency }, { header: "Stage", value: (a) => a.status === "voided" ? "VOID" : a.stage }], rows, st)}>{t("Export Excel", "Export Excel")}</Button>
      {can("awb.issue") && <Link to="/export/awb/new"><Button variant="primary" icon={Plus}>{t("ອອກ AWB ໃໝ່", "Issue new AWB")}</Button></Link>}
    </>} />
    <StatRow items={[
      { label: t("ອອກ AWB ມື້ນີ້", "AWBs issued today"), value: today.length, sub: kg(today.reduce((s, a) => s + a.chargeableKg, 0)) },
      { label: t("ລໍຖ້າກວດ X-Ray", "Waiting for X-Ray"), value: all.filter((a) => a.status === "active" && a.stage === "RCS").length, to: "/export/screening", tone: "warn" },
      { label: t("ຍັງບໍ່ຊໍາລະ", "Not yet paid"), value: all.filter((a) => a.status === "active" && !a.paid && a.payMode === "cash").length, to: "/finance/cashier" },
      { label: t("ເຂົ້າ Manifest ແລ້ວ", "On a manifest"), value: all.filter((a) => a.status === "active" && a.stage === "MAN").length, to: "/export/dispatch" },
    ]} />
    <Panel flush>
      <DataTable rows={rows} columns={cols} rowKey={(a) => a.id} minWidth={1080} defaultSort={{ key: "no", dir: "desc" }} onRowClick={(a) => nav(`/export/awb/${a.id}`)}
        search={(a) => `${a.prefix}${a.serial} ${customerName(d, a.shipperId)} ${customerName(d, a.consigneeId)} ${a.commodity} ${a.dest}`}
        filters={<>
          <Select aria-label={t("ສະຖານະ", "Status")} className="w-auto" value={stage} onChange={(e) => setStage(e.target.value)} placeholder={t("ທຸກສະຖານະ", "All statuses")} options={["BKD", "RCS", "SCR", "MAN", "DEP", "ARR", "DLV", "VOID"].map((s) => ({ value: s, label: s }))} />
          <Select aria-label={t("ປາຍທາງ", "Destination")} className="w-auto" value={dest} onChange={(e) => setDest(e.target.value)} placeholder={t("ທຸກປາຍທາງ", "All destinations")} options={dests.map((s) => ({ value: s, label: s }))} />
          <Select aria-label={t("ການຊໍາລະ", "Payment")} className="w-auto" value={pay} onChange={(e) => setPay(e.target.value)} placeholder={t("ທຸກການຊໍາລະ", "All payments")} options={[{ value: "unpaid", label: t("ຍັງບໍ່ຈ່າຍ", "Unpaid") }, { value: "paid", label: t("ຈ່າຍແລ້ວ", "Paid") }, { value: "credit", label: t("ຕິດໜີ້", "Credit") }]} />
        </>} />
    </Panel>
  </>;
}
