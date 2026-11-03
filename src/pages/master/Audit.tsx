import { useMemo, useState } from "react";
import { FileDown, ShieldCheck } from "lucide-react";
import { useDb } from "@/lib/store";
import { useLang, useT, type T } from "@/lib/i18n";
import { Button, Col, DataTable, Empty, Input, PageHeader, Panel, Select, StatRow, toast } from "@/ui/kit";
import { userName } from "@/ui/cargo";
import type { AuditEntry } from "@/lib/types";
import { fmtDateTime, todayIso } from "@/lib/format";
import { exportExcel } from "@/lib/export";

const ACTIONS: Record<string, [string, string]> = {
  create: ["ສ້າງ", "Create"], update: ["ແກ້ໄຂ", "Update"], delete: ["ລຶບ", "Delete"],
  request_rate: ["ຂໍປ່ຽນອັດຕາແລກປ່ຽນ", "Request exchange rate"], approve_rate: ["ອະນຸມັດອັດຕາແລກປ່ຽນ", "Approve exchange rate"], reject_rate: ["ບໍ່ອະນຸມັດອັດຕາແລກປ່ຽນ", "Reject exchange rate"],
  request_tariff: ["ສະເໜີອັດຕາຄ່າບໍລິການ", "Submit tariff"], approve_tariff: ["ອະນຸມັດອັດຕາຄ່າບໍລິການ", "Approve tariff"], reject_tariff: ["ບໍ່ອະນຸມັດອັດຕາຄ່າບໍລິການ", "Reject tariff"],
  allocate_awb: ["ຈັດສັນຊ່ວງເລກ AWB", "Allocate AWB range"], issue_awb: ["ອອກ AWB", "Issue AWB"], correct_awb: ["ແກ້ໄຂ AWB", "Correct AWB"], void_awb: ["ຍົກເລີກ AWB", "Void AWB"],
  screening: ["ບັນທຶກ X-Ray", "Record X-Ray"], plan_load: ["ເພີ່ມເຂົ້າ Manifest", "Add to manifest"], unplan_load: ["ເອົາອອກຈາກ Manifest", "Remove from manifest"], offload: ["ອ໋ອບໂຫຼດ", "Offload"], draft_message: ["ສ້າງຂໍ້ຄວາມ", "Draft message"], copy_schedule: ["ສໍາເນົາຕາຕະລາງບິນ", "Copy schedule"],
  flight_open: ["ເປີດຖ້ຽວບິນ", "Open flight"], flight_closed: ["ປິດຮັບຖ້ຽວບິນ", "Close flight"], flight_departed: ["ຖ້ຽວບິນອອກ", "Flight departed"], flight_arrived: ["ຖ້ຽວບິນມາຮອດ", "Flight arrived"], flight_cancelled: ["ຍົກເລີກຖ້ຽວບິນ", "Cancel flight"],
  receive: ["ຮັບເຄື່ອງເຂົ້າສາງ", "Receive cargo"], move_zone: ["ຍ້າຍໂຊນ", "Move zone"], transfer: ["ຖ່າຍລໍາ", "Transfer"], customs: ["ບັນທຶກພາສີ", "Customs update"], deliver: ["ມອບສິນຄ້າ", "Deliver"], charge_storage: ["ຄິດຄ່າຝາກສາງ", "Charge storage"],
  mail_received: ["ຮັບຖົງເມ", "Mail received"], mail_manifested: ["ເຂົ້າ Manifest ຖົງເມ", "Mail manifested"], mail_dispatched: ["ສົ່ງຖົງເມ", "Mail dispatched"], mail_arrived: ["ຖົງເມມາຮອດ", "Mail arrived"], mail_delivered: ["ມອບຖົງເມ", "Mail delivered"],
  notify_arrival: ["ແຈ້ງສິນຄ້າມາຮອດ", "Arrival notice"], notify_aging: ["ແຈ້ງສິນຄ້າຄ້າງສາງ", "Aging notice"],
  confirmed: ["ຢືນຢັນການຈອງ", "Confirm booking"], waitlisted: ["ເຂົ້າລາຍຊື່ລໍຖ້າ", "Waitlist booking"], rejected: ["ປະຕິເສດການຈອງ", "Reject booking"], cancelled: ["ຍົກເລີກການຈອງ", "Cancel booking"],
  payment: ["ຮັບຊໍາລະ", "Take payment"], void_receipt: ["ຍົກເລີກໃບຮັບເງິນ", "Void receipt"], refund: ["ຄືນເງິນ", "Refund"], open_shift: ["ເປີດກະ", "Open shift"], close_shift: ["ປິດກະ", "Close shift"], hand_over: ["ສົ່ງມອບກະ", "Hand over shift"],
  issue_invoice: ["ອອກໃບເກັບເງິນ", "Issue invoice"], pay_invoice: ["ຮັບຊໍາລະໃບເກັບເງິນ", "Invoice payment"], cancel_invoice: ["ຍົກເລີກໃບເກັບເງິນ", "Cancel invoice"], update_user: ["ແກ້ໄຂຜູ້ໃຊ້", "Update user"],
};
const actionName = (t: T, a: string) => { const x = ACTIONS[a]; return x ? t(x[0], x[1]) : a.replace(/_/g, " "); };

export default function Audit() {
  const d = useDb(); const t = useT(); const lang = useLang();
  const [user, setUser] = useState(""); const [action, setAction] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const rows = useMemo(() => d.audit.filter((a) => (!user || a.userId === user) && (!action || a.action === action) && (!from || a.ts.slice(0, 10) >= from) && (!to || a.ts.slice(0, 10) <= to)), [d.audit, user, action, from, to]);
  const actions = [...new Set(d.audit.map((a) => a.action))].sort((a, b) => actionName(t, a).localeCompare(actionName(t, b)));
  const filtered = !!(user || action || from || to);
  const badRange = !!from && !!to && from > to;
  const cols: Col<AuditEntry>[] = [
    { key: "ts", header: t("ເວລາ", "Time"), render: (a) => <span className="tnum whitespace-nowrap">{fmtDateTime(a.ts)}</span>, sort: (a) => a.ts },
    { key: "user", header: t("ຜູ້ໃຊ້", "User"), render: (a) => <span className="whitespace-nowrap">{userName(d, a.userId, lang)}</span>, sort: (a) => userName(d, a.userId, lang) },
    { key: "station", header: t("ສະຖານີ", "Station"), mono: true, render: (a) => a.station, sort: (a) => a.station },
    { key: "action", header: t("ການກະທໍາ", "Action"), render: (a) => <span className="whitespace-nowrap">{actionName(t, a.action)}</span>, sort: (a) => actionName(t, a.action) },
    { key: "entity", header: t("ຂໍ້ມູນ", "Entity"), render: (a) => <span className="whitespace-nowrap">{a.entity} <span className="font-mono text-[13px] text-ink-2">{a.entityId}</span></span>, sort: (a) => a.entity },
    { key: "detail", header: t("ລາຍລະອຽດ", "Detail"), render: (a) => { const p = a.detail.split(" / "); return p.length === 2 ? t(p[0], p[1]) : a.detail; } },
  ];
  const doExport = async () => {
    const filters = [user && userName(d, user, "en"), action, from && `from ${from}`, to && `to ${to}`].filter(Boolean).join(", ");
    try {
      await exportExcel(t("ປະຫວັດການເຄື່ອນໄຫວ", "Audit trail"), `Audit-${todayIso()}`, [{ header: "Time", value: (a: AuditEntry) => fmtDateTime(a.ts) }, { header: "User", value: (a) => userName(d, a.userId, "en") }, { header: "Station", value: (a) => a.station }, { header: "Action", value: (a) => a.action }, { header: "Entity", value: (a) => a.entity }, { header: "Record", value: (a) => a.entityId }, { header: "Detail", value: (a) => a.detail }], rows, filters);
      toast(t(`ດາວໂຫຼດ Excel ${rows.length} ແຖວແລ້ວ`, `Excel downloaded with ${rows.length} rows`));
    } catch { toast(t("ສ້າງໄຟລ໌ Excel ບໍ່ສໍາເລັດ. ກະລຸນາລອງໃໝ່", "The Excel file could not be created. Try again."), "bad"); }
  };
  return <>
    <PageHeader title={t("ປະຫວັດການເຄື່ອນໄຫວ", "Audit trail")} subtitle={t("ທຸກການສ້າງ, ແກ້ໄຂ, ລຶບ ແລະ ອະນຸມັດ ຖືກບັນທຶກພ້ອມຜູ້ໃຊ້ ສະຖານີ ແລະ ເວລາ. ບັນທຶກນີ້ແກ້ໄຂບໍ່ໄດ້.", "Every create, change, delete and approval is recorded with the user, station and time. Entries cannot be edited.")} actions={<Button icon={FileDown} disabled={rows.length === 0} onClick={doExport}>{t("Export Excel", "Export Excel")}</Button>} />
    <StatRow items={[
      { label: t("ລາຍການທີ່ສະແດງ", "Entries shown"), value: rows.length, sub: t(`ຈາກທັງໝົດ ${d.audit.length}`, `of ${d.audit.length} in total`) },
      { label: t("ມື້ນີ້", "Today"), value: d.audit.filter((a) => a.ts.slice(0, 10) === todayIso()).length },
      { label: t("ຜູ້ໃຊ້ທີ່ເຄື່ອນໄຫວ", "Users with activity"), value: new Set(rows.map((a) => a.userId)).size },
    ]} />
    <Panel flush>
      <DataTable rows={rows} columns={cols} rowKey={(a) => a.id} minWidth={1000} pageSize={15} defaultSort={{ key: "ts", dir: "desc" }}
        search={(a) => `${a.entity} ${a.entityId} ${a.detail} ${a.station} ${userName(d, a.userId, "en")} ${userName(d, a.userId, "lo")}`}
        filters={<>
          <Select aria-label={t("ຜູ້ໃຊ້", "User")} className="w-auto" value={user} onChange={(e) => setUser(e.target.value)} placeholder={t("ທຸກຜູ້ໃຊ້", "All users")} options={d.users.map((u) => ({ value: u.id, label: t(u.nameLo, u.nameEn) }))} />
          <Select aria-label={t("ການກະທໍາ", "Action")} className="w-auto" value={action} onChange={(e) => setAction(e.target.value)} placeholder={t("ທຸກການກະທໍາ", "All actions")} options={actions.map((a) => ({ value: a, label: actionName(t, a) }))} />
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">{t("ແຕ່", "From")}<Input aria-label={t("ແຕ່ວັນທີ", "From date")} type="date" className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></span>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">{t("ຫາ", "To")}<Input aria-label={t("ຫາວັນທີ", "To date")} type="date" className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></span>
          {filtered && <Button variant="ghost" size="sm" onClick={() => { setUser(""); setAction(""); setFrom(""); setTo(""); }}>{t("ລ້າງຕົວກອງ", "Clear filters")}</Button>}
        </>}
        empty={<Empty icon={ShieldCheck} title={badRange ? t("ຊ່ວງວັນທີບໍ່ຖືກຕ້ອງ", "The date range is reversed") : t("ບໍ່ມີລາຍການຕາມຕົວກອງນີ້", "No entries match these filters")}>{badRange ? t("ວັນທີເລີ່ມຕ້ອງບໍ່ຫຼັງວັນທີສິ້ນສຸດ", "The start date must not be after the end date.") : t("ລອງປ່ຽນຜູ້ໃຊ້ ການກະທໍາ ຫຼື ວັນທີ", "Try another user, action or date.")}</Empty>} />
    </Panel>
  </>;
}
